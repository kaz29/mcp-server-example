import { Injectable, Logger } from '@nestjs/common';
import { GitHubApiService } from '../github/github-api.service';
import {
  DeploymentFrequency,
  Period,
  DateRange,
} from '../../types/four-keys.types';
import { DeploymentConfig } from '../../types/github.types';
import {
  subDays,
  subMonths,
  subYears,
  differenceInDays,
  startOfDay,
  endOfDay,
} from 'date-fns';

/**
 * デプロイ頻度算出サービス
 *
 * GitHub API からデプロイイベントを収集し、デプロイ頻度を計算します。
 */
@Injectable()
export class DeploymentFrequencyService {
  private readonly logger = new Logger(DeploymentFrequencyService.name);

  constructor(private readonly githubApiService: GitHubApiService) {}

  /**
   * デプロイ頻度を計算
   *
   * @param owner リポジトリオーナー
   * @param repo リポジトリ名
   * @param period 期間
   * @param config デプロイ検出設定
   */
  async calculate(
    owner: string,
    repo: string,
    period: Period,
    config: DeploymentConfig,
  ): Promise<DeploymentFrequency> {
    this.logger.log(
      `デプロイ頻度を計算中: ${owner}/${repo} (${period}, method: ${config.method})`,
    );

    // 期間の計算
    const dateRange = this.calculateDateRange(period);

    // デプロイイベントの収集
    const deploymentDates = await this.collectDeployments(
      owner,
      repo,
      dateRange,
      config,
    );

    // 指標の計算
    const totalDeployments = deploymentDates.length;
    const days = differenceInDays(dateRange.to, dateRange.from) + 1; // +1 で両端を含む
    const deploymentsPerDay = days > 0 ? totalDeployments / days : 0;

    this.logger.log(
      `デプロイ頻度計算完了: ${totalDeployments} deployments in ${days} days (${deploymentsPerDay.toFixed(2)}/day)`,
    );

    return {
      repository: `${owner}/${repo}`,
      period,
      dateRange,
      totalDeployments,
      deploymentsPerDay: parseFloat(deploymentsPerDay.toFixed(4)),
      deploymentDates: deploymentDates.sort((a, b) => a.getTime() - b.getTime()),
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
   * デプロイイベントを収集
   */
  private async collectDeployments(
    owner: string,
    repo: string,
    dateRange: DateRange,
    config: DeploymentConfig,
  ): Promise<Date[]> {
    switch (config.method) {
      case 'workflow':
        return this.collectWorkflowDeployments(owner, repo, dateRange, config);
      case 'release':
        return this.collectReleaseDeployments(owner, repo, dateRange);
      case 'tag':
        return this.collectTagDeployments(owner, repo, dateRange, config);
      default:
        throw new Error(`未知のデプロイ検出方法: ${config.method}`);
    }
  }

  /**
   * ワークフローベースのデプロイ検出
   */
  private async collectWorkflowDeployments(
    owner: string,
    repo: string,
    dateRange: DateRange,
    config: DeploymentConfig,
  ): Promise<Date[]> {
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
      this.logger.log(`ワークフロー '${targetWorkflow.name}' (ID: ${workflowId}) を検出`);
    }

    // 成功したワークフロー実行を取得
    const runs = await this.githubApiService.listWorkflowRuns(owner, repo, {
      workflowId,
      status: 'success',
      created: `>=${dateRange.from.toISOString()}`,
    });

    // 期間内のワークフロー実行をフィルタリング
    const deployments = runs
      .filter((run) => {
        const createdAt = new Date(run.created_at);
        return createdAt >= dateRange.from && createdAt <= dateRange.to;
      })
      .map((run) => new Date(run.created_at));

    this.logger.log(`ワークフローベースで ${deployments.length} 件のデプロイを検出`);
    return deployments;
  }

  /**
   * リリースベースのデプロイ検出
   */
  private async collectReleaseDeployments(
    owner: string,
    repo: string,
    dateRange: DateRange,
  ): Promise<Date[]> {
    const releases = await this.githubApiService.listReleases(owner, repo);

    const deployments = releases
      .filter((release) => {
        // ドラフトやプレリリースは除外
        if (release.draft || release.prerelease) {
          return false;
        }

        const publishedAt = new Date(release.published_at!);
        return publishedAt >= dateRange.from && publishedAt <= dateRange.to;
      })
      .map((release) => new Date(release.published_at!));

    this.logger.log(`リリースベースで ${deployments.length} 件のデプロイを検出`);
    return deployments;
  }

  /**
   * タグベースのデプロイ検出
   */
  private async collectTagDeployments(
    owner: string,
    repo: string,
    dateRange: DateRange,
    config: DeploymentConfig,
  ): Promise<Date[]> {
    const tags = await this.githubApiService.listTags(owner, repo);
    const { tagPattern, tagPrefix } = config;

    // タグパターンの正規表現
    const pattern = tagPattern ? new RegExp(tagPattern) : null;

    // タグのコミット情報を取得してフィルタリング
    const octokit = await this.githubApiService.getOctokit();
    const deployments: Date[] = [];

    for (const tag of tags) {
      // タグprefixでフィルタリング（prefixが指定されている場合）
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
          deployments.push(commitDate);
        }
      } catch (error) {
        this.logger.warn(`タグ ${tag.name} のコミット情報取得に失敗`, error);
      }
    }

    this.logger.log(`タグベースで ${deployments.length} 件のデプロイを検出`);
    return deployments;
  }
}
