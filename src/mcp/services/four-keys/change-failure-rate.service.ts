import { Injectable, Logger } from '@nestjs/common';
import { GitHubApiService } from '../github/github-api.service';
import {
  ChangeFailureRate,
  Period,
  DateRange,
  FailureIncident,
} from '../../types/four-keys.types';
import { DeploymentConfig, FailureConfig } from '../../types/github.types';
import {
  subDays,
  subMonths,
  subYears,
  startOfDay,
  endOfDay,
} from 'date-fns';

/**
 * 変更失敗率算出サービス
 *
 * GitHub API から障害情報を収集し、変更失敗率を計算します。
 */
@Injectable()
export class ChangeFailureRateService {
  private readonly logger = new Logger(ChangeFailureRateService.name);

  constructor(private readonly githubApiService: GitHubApiService) {}

  /**
   * 変更失敗率を計算
   *
   * @param owner リポジトリオーナー
   * @param repo リポジトリ名
   * @param period 期間
   * @param deploymentConfig デプロイ検出設定
   * @param failureConfig 障害検出設定
   */
  async calculate(
    owner: string,
    repo: string,
    period: Period,
    deploymentConfig: DeploymentConfig,
    failureConfig: FailureConfig,
  ): Promise<ChangeFailureRate> {
    this.logger.log(
      `変更失敗率を計算中: ${owner}/${repo} (${period})`,
    );

    // 期間の計算
    const dateRange = this.calculateDateRange(period);

    // 総デプロイ数を取得（deployment-frequency.service.tsと同じロジックを使用）
    const totalDeployments = await this.countDeployments(
      owner,
      repo,
      dateRange,
      deploymentConfig,
    );

    // 障害を検出
    const failures = await this.collectFailures(
      owner,
      repo,
      dateRange,
      failureConfig,
    );

    // 失敗率を計算
    const failedDeployments = failures.length;
    const failureRate =
      totalDeployments > 0 ? (failedDeployments / totalDeployments) * 100 : 0;

    this.logger.log(
      `変更失敗率計算完了: ${failedDeployments}/${totalDeployments} = ${failureRate.toFixed(2)}%`,
    );

    return {
      repository: `${owner}/${repo}`,
      period,
      dateRange,
      totalDeployments,
      failedDeployments,
      failureRate: parseFloat(failureRate.toFixed(2)),
      failures: failures.sort((a, b) => b.date.getTime() - a.date.getTime()),
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
   * デプロイ数をカウント（deployment-frequency.serviceと同じロジック）
   */
  private async countDeployments(
    owner: string,
    repo: string,
    dateRange: DateRange,
    config: DeploymentConfig,
  ): Promise<number> {
    switch (config.method) {
      case 'release':
        return this.countReleaseDeployments(owner, repo, dateRange);
      case 'tag':
        return this.countTagDeployments(owner, repo, dateRange, config);
      case 'workflow':
        return this.countWorkflowDeployments(owner, repo, dateRange, config);
      default:
        throw new Error(`未知のデプロイ検出方法: ${config.method}`);
    }
  }

  /**
   * リリースベースのデプロイ数カウント
   */
  private async countReleaseDeployments(
    owner: string,
    repo: string,
    dateRange: DateRange,
  ): Promise<number> {
    const releases = await this.githubApiService.listReleases(owner, repo);

    return releases.filter((release) => {
      if (release.draft || release.prerelease) {
        return false;
      }
      const publishedAt = new Date(release.published_at!);
      return publishedAt >= dateRange.from && publishedAt <= dateRange.to;
    }).length;
  }

  /**
   * タグベースのデプロイ数カウント
   */
  private async countTagDeployments(
    owner: string,
    repo: string,
    dateRange: DateRange,
    config: DeploymentConfig,
  ): Promise<number> {
    const tags = await this.githubApiService.listTags(owner, repo);
    const { tagPattern, tagPrefix } = config;
    const pattern = tagPattern ? new RegExp(tagPattern) : null;
    const octokit = await this.githubApiService.getOctokit();

    let count = 0;

    for (const tag of tags) {
      // タグprefixでフィルタリング
      if (tagPrefix && !tag.name.startsWith(tagPrefix)) {
        continue;
      }

      // タグパターンでフィルタリング
      if (pattern && !pattern.test(tag.name)) {
        continue;
      }

      // コミット情報を取得
      try {
        const { data: commit } = await octokit.repos.getCommit({
          owner,
          repo,
          ref: tag.commit.sha,
        });

        const commitDate = new Date(commit.commit.committer!.date!);
        if (commitDate >= dateRange.from && commitDate <= dateRange.to) {
          count++;
        }
      } catch (error) {
        this.logger.warn(`タグ ${tag.name} のコミット情報取得に失敗`, error);
      }
    }

    return count;
  }

  /**
   * ワークフローベースのデプロイ数カウント
   */
  private async countWorkflowDeployments(
    owner: string,
    repo: string,
    dateRange: DateRange,
    config: DeploymentConfig,
  ): Promise<number> {
    const { workflowName, workflowFile } = config;

    // ワークフローIDを取得
    let workflowId: number | undefined;
    if (workflowName || workflowFile) {
      const workflows = await this.githubApiService.listWorkflows(owner, repo);
      const targetWorkflow = workflows.find(
        (w) => w.name === workflowName || w.path.includes(workflowFile || ''),
      );

      if (!targetWorkflow) {
        throw new Error(
          `ワークフロー '${workflowName || workflowFile}' が見つかりません`,
        );
      }
      workflowId = targetWorkflow.id;
    }

    // 成功したワークフロー実行を取得
    const runs = await this.githubApiService.listWorkflowRuns(owner, repo, {
      workflowId,
      status: 'success',
      created: `>=${dateRange.from.toISOString()}`,
    });

    return runs.filter((run) => {
      const createdAt = new Date(run.created_at);
      return createdAt >= dateRange.from && createdAt <= dateRange.to;
    }).length;
  }

  /**
   * 障害を検出
   */
  private async collectFailures(
    owner: string,
    repo: string,
    dateRange: DateRange,
    config: FailureConfig,
  ): Promise<FailureIncident[]> {
    const failures: FailureIncident[] = [];

    // Hotfix PRの検出
    if (config.prLabels || config.prBranchPattern) {
      const prFailures = await this.detectHotfixPRs(
        owner,
        repo,
        dateRange,
        config,
      );
      failures.push(...prFailures);
    }

    // インシデントIssueの検出
    if (config.issueLabels && config.issueLabels.length > 0) {
      const issueFailures = await this.detectIncidentIssues(
        owner,
        repo,
        dateRange,
        config,
      );
      failures.push(...issueFailures);
    }

    // ワークフロー失敗の検出
    if (config.detectWorkflowFailures) {
      const workflowFailures = await this.detectWorkflowFailures(
        owner,
        repo,
        dateRange,
      );
      failures.push(...workflowFailures);
    }

    this.logger.log(`${failures.length} 件の障害を検出`);
    return failures;
  }

  /**
   * Hotfix PRを検出
   */
  private async detectHotfixPRs(
    owner: string,
    repo: string,
    dateRange: DateRange,
    config: FailureConfig,
  ): Promise<FailureIncident[]> {
    const octokit = await this.githubApiService.getOctokit();
    const failures: FailureIncident[] = [];

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

      const mergedAt = new Date(pr.merged_at);
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
        failures.push({
          type: 'hotfix_pr',
          identifier: `#${pr.number}`,
          date: mergedAt,
          title: pr.title,
        });
      }
    }

    this.logger.log(`${failures.length} 件のHotfix PRを検出`);
    return failures;
  }

  /**
   * インシデントIssueを検出
   */
  private async detectIncidentIssues(
    owner: string,
    repo: string,
    dateRange: DateRange,
    config: FailureConfig,
  ): Promise<FailureIncident[]> {
    const octokit = await this.githubApiService.getOctokit();
    const failures: FailureIncident[] = [];

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

      const closedAt = new Date(issue.closed_at);
      if (closedAt < dateRange.from || closedAt > dateRange.to) continue;

      // インシデントラベルを持つかチェック
      const hasIncidentLabel = issue.labels.some((label) =>
        config.issueLabels!.includes(
          typeof label === 'string' ? label.toLowerCase() : label.name.toLowerCase(),
        ),
      );

      if (hasIncidentLabel) {
        failures.push({
          type: 'incident_issue',
          identifier: `#${issue.number}`,
          date: closedAt,
          title: issue.title,
        });
      }
    }

    this.logger.log(`${failures.length} 件のインシデントIssueを検出`);
    return failures;
  }

  /**
   * ワークフロー失敗を検出
   */
  private async detectWorkflowFailures(
    owner: string,
    repo: string,
    dateRange: DateRange,
  ): Promise<FailureIncident[]> {
    const failures: FailureIncident[] = [];

    // 失敗したワークフロー実行を取得
    const runs = await this.githubApiService.listWorkflowRuns(owner, repo, {
      status: 'failure',
      created: `>=${dateRange.from.toISOString()}`,
    });

    for (const run of runs) {
      const createdAt = new Date(run.created_at);
      if (createdAt >= dateRange.from && createdAt <= dateRange.to) {
        failures.push({
          type: 'workflow_failure',
          identifier: `Run #${run.id}`,
          date: createdAt,
          title: `${run.name} - ${run.head_branch}`,
        });
      }
    }

    this.logger.log(`${failures.length} 件のワークフロー失敗を検出`);
    return failures;
  }
}
