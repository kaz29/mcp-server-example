import { Injectable, Logger } from '@nestjs/common';
import { GitHubApiService } from '../github/github-api.service';
import {
  MTTR,
  Period,
  DateRange,
  MTTRIncident,
} from '../../types/four-keys.types';
import { FailureConfig } from '../../types/github.types';
import {
  subDays,
  subMonths,
  subYears,
  startOfDay,
  endOfDay,
  differenceInHours,
} from 'date-fns';

/**
 * MTTR (平均復旧時間) 算出サービス
 *
 * GitHub API から障害情報を収集し、平均復旧時間を計算します。
 */
@Injectable()
export class MTTRService {
  private readonly logger = new Logger(MTTRService.name);

  constructor(private readonly githubApiService: GitHubApiService) {}

  /**
   * MTTRを計算
   *
   * @param owner リポジトリオーナー
   * @param repo リポジトリ名
   * @param period 期間
   * @param failureConfig 障害検出設定
   */
  async calculate(
    owner: string,
    repo: string,
    period: Period,
    failureConfig: FailureConfig,
  ): Promise<MTTR> {
    this.logger.log(`MTTRを計算中: ${owner}/${repo} (${period})`);

    // 期間の計算
    const dateRange = this.calculateDateRange(period);

    // インシデントを収集
    const incidents = await this.collectIncidents(
      owner,
      repo,
      dateRange,
      failureConfig,
    );

    // MTTRを計算
    const mttrHours = incidents.map((i) => i.mttrHours);
    const averageMTTRHours =
      mttrHours.length > 0
        ? mttrHours.reduce((a, b) => a + b, 0) / mttrHours.length
        : 0;

    // 中央値を計算
    const sortedMTTR = [...mttrHours].sort((a, b) => a - b);
    const medianMTTRHours =
      sortedMTTR.length > 0
        ? sortedMTTR[Math.floor(sortedMTTR.length / 2)]
        : 0;

    this.logger.log(
      `MTTR計算完了: 平均 ${averageMTTRHours.toFixed(2)} hours (${incidents.length} incidents)`,
    );

    return {
      repository: `${owner}/${repo}`,
      period,
      dateRange,
      averageMTTRHours: parseFloat(averageMTTRHours.toFixed(2)),
      medianMTTRHours: parseFloat(medianMTTRHours.toFixed(2)),
      incidents: incidents.sort(
        (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime(),
      ),
    };
  }

  /**
   * 期間から日付範囲を計算
   */
  private calculateDateRange(period: Period): DateRange {
    const now = new Date();
    const to = endOfDay(now);
    let from: Date;

    switch (period) {
      case 'day':
        from = startOfDay(now);
        break;
      case 'week':
        from = startOfDay(subDays(now, 7));
        break;
      case 'month':
        from = startOfDay(subMonths(now, 1));
        break;
      case 'quarter':
        from = startOfDay(subMonths(now, 3));
        break;
      case 'year':
        from = startOfDay(subYears(now, 1));
        break;
      default:
        throw new Error(`未知の期間: ${period}`);
    }

    return { from, to };
  }

  /**
   * インシデントを収集
   */
  private async collectIncidents(
    owner: string,
    repo: string,
    dateRange: DateRange,
    config: FailureConfig,
  ): Promise<MTTRIncident[]> {
    const incidents: MTTRIncident[] = [];

    // Issueベースのインシデント収集
    if (config.issueLabels && config.issueLabels.length > 0) {
      const issueIncidents = await this.collectIssueIncidents(
        owner,
        repo,
        dateRange,
        config,
      );
      incidents.push(...issueIncidents);
    }

    // Hotfix PRベースのインシデント収集
    if (config.prLabels || config.prBranchPattern) {
      const prIncidents = await this.collectPRIncidents(
        owner,
        repo,
        dateRange,
        config,
      );
      incidents.push(...prIncidents);
    }

    this.logger.log(`${incidents.length} 件のインシデントを検出`);
    return incidents;
  }

  /**
   * Issueベースのインシデント収集
   */
  private async collectIssueIncidents(
    owner: string,
    repo: string,
    dateRange: DateRange,
    config: FailureConfig,
  ): Promise<MTTRIncident[]> {
    const octokit = await this.githubApiService.getOctokit();
    const incidents: MTTRIncident[] = [];

    // クローズされたIssueを取得
    const { data: issues } = await octokit.issues.listForRepo({
      owner,
      repo,
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
    });

    for (const issue of issues) {
      // PRは除外
      if (issue.pull_request) continue;

      if (!issue.closed_at) continue;

      const createdAt = new Date(issue.created_at);
      const closedAt = new Date(issue.closed_at);

      // 期間内にクローズされたもの
      if (closedAt < dateRange.from || closedAt > dateRange.to) continue;

      // インシデントラベルを持つかチェック
      const hasIncidentLabel = issue.labels.some((label) =>
        config.issueLabels!.includes(
          typeof label === 'string'
            ? label.toLowerCase()
            : label.name.toLowerCase(),
        ),
      );

      if (hasIncidentLabel) {
        const mttrHours = differenceInHours(closedAt, createdAt);
        incidents.push({
          issueNumber: issue.number,
          title: issue.title,
          detectedAt: createdAt,
          resolvedAt: closedAt,
          mttrHours,
        });
      }
    }

    this.logger.log(`${incidents.length} 件のIssueベースインシデントを検出`);
    return incidents;
  }

  /**
   * PRベースのインシデント収集
   */
  private async collectPRIncidents(
    owner: string,
    repo: string,
    dateRange: DateRange,
    config: FailureConfig,
  ): Promise<MTTRIncident[]> {
    const octokit = await this.githubApiService.getOctokit();
    const incidents: MTTRIncident[] = [];

    // マージされたPRを取得
    const { data: prs } = await octokit.pulls.list({
      owner,
      repo,
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
    });

    const branchPattern = config.prBranchPattern
      ? new RegExp(config.prBranchPattern)
      : null;

    for (const pr of prs) {
      if (!pr.merged_at) continue;

      const createdAt = new Date(pr.created_at);
      const mergedAt = new Date(pr.merged_at);

      // 期間内にマージされたもの
      if (mergedAt < dateRange.from || mergedAt > dateRange.to) continue;

      // ラベルでチェック
      const hasHotfixLabel =
        config.prLabels &&
        pr.labels.some((label) =>
          config.prLabels!.includes(label.name.toLowerCase()),
        );

      // ブランチ名でチェック
      const hasHotfixBranch =
        branchPattern && branchPattern.test(pr.head.ref);

      if (hasHotfixLabel || hasHotfixBranch) {
        const mttrHours = differenceInHours(mergedAt, createdAt);
        incidents.push({
          prNumber: pr.number,
          title: pr.title,
          detectedAt: createdAt,
          resolvedAt: mergedAt,
          mttrHours,
        });
      }
    }

    this.logger.log(`${incidents.length} 件のPRベースインシデントを検出`);
    return incidents;
  }
}
