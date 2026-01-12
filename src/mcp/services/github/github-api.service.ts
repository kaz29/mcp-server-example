import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { GitHubAuthService } from './github-auth.service';

/**
 * GitHub API クライアントサービス
 *
 * GitHub REST API への統一的なアクセスを提供します。
 * ページネーション、エラーハンドリング、Rate Limit対策などを実装しています。
 */
@Injectable()
export class GitHubApiService {
  private readonly logger = new Logger(GitHubApiService.name);

  constructor(private readonly authService: GitHubAuthService) {}

  /**
   * Octokit インスタンスを取得
   */
  async getOctokit(): Promise<Octokit> {
    const token = await this.authService.getInstallationToken();
    const config = this.authService.getConfig();

    return new Octokit({
      auth: token,
      baseUrl: config.baseUrl,
    });
  }

  /**
   * ワークフロー実行履歴を取得
   *
   * @param owner リポジトリオーナー
   * @param repo リポジトリ名
   * @param options オプション（ワークフロー名、ステータス、日付範囲など）
   */
  async listWorkflowRuns(
    owner: string,
    repo: string,
    options: {
      workflowId?: string | number;
      status?: 'success' | 'failure' | 'cancelled';
      created?: string; // ISO 8601形式: >=2024-01-01
      perPage?: number;
    } = {},
  ) {
    const octokit = await this.getOctokit();
    const { workflowId, status, created, perPage = 100 } = options;

    try {
      if (workflowId) {
        // 特定のワークフローの実行履歴を取得
        const runs = await octokit.paginate(
          octokit.actions.listWorkflowRuns,
          {
            owner,
            repo,
            workflow_id: workflowId,
            status,
            created,
            per_page: perPage,
          },
        );
        return runs;
      } else {
        // すべてのワークフロー実行を取得
        const runs = await octokit.paginate(
          octokit.actions.listWorkflowRunsForRepo,
          {
            owner,
            repo,
            status,
            created,
            per_page: perPage,
          },
        );
        return runs;
      }
    } catch (error) {
      this.handleError(error, 'ワークフロー実行履歴の取得');
      throw error;
    }
  }

  /**
   * ワークフロー一覧を取得
   */
  async listWorkflows(owner: string, repo: string) {
    const octokit = await this.getOctokit();

    try {
      const { data } = await octokit.actions.listRepoWorkflows({
        owner,
        repo,
      });
      return data.workflows;
    } catch (error) {
      this.handleError(error, 'ワークフロー一覧の取得');
      throw error;
    }
  }

  /**
   * PR 一覧を取得
   *
   * @param owner リポジトリオーナー
   * @param repo リポジトリ名
   * @param options オプション（状態、ソートなど）
   */
  async listPullRequests(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      sort?: 'created' | 'updated' | 'popularity' | 'long-running';
      direction?: 'asc' | 'desc';
      base?: string; // ベースブランチ名
      perPage?: number;
    } = {},
  ) {
    const octokit = await this.getOctokit();
    const { state = 'all', sort = 'created', direction = 'desc', base, perPage = 100 } = options;

    try {
      const pulls = await octokit.paginate(octokit.pulls.list, {
        owner,
        repo,
        state,
        sort,
        direction,
        base,
        per_page: perPage,
      });
      return pulls;
    } catch (error) {
      this.handleError(error, 'PR一覧の取得');
      throw error;
    }
  }

  /**
   * マージされたPRを取得（期間指定可能）
   */
  async listMergedPullRequests(
    owner: string,
    repo: string,
    options: {
      since?: Date;
      until?: Date;
      base?: string;
    } = {},
  ) {
    const allPulls = await this.listPullRequests(owner, repo, {
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      base: options.base,
    });

    // マージされたPRのみをフィルタリング
    let mergedPulls = allPulls.filter((pr) => pr.merged_at !== null);

    // 期間でフィルタリング
    if (options.since) {
      mergedPulls = mergedPulls.filter(
        (pr) => new Date(pr.merged_at!) >= options.since!,
      );
    }
    if (options.until) {
      mergedPulls = mergedPulls.filter(
        (pr) => new Date(pr.merged_at!) <= options.until!,
      );
    }

    return mergedPulls;
  }

  /**
   * Issue 一覧を取得
   *
   * @param owner リポジトリオーナー
   * @param repo リポジトリ名
   * @param options オプション（状態、ラベルなど）
   */
  async listIssues(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      labels?: string; // カンマ区切り
      since?: string; // ISO 8601形式
      sort?: 'created' | 'updated' | 'comments';
      direction?: 'asc' | 'desc';
      perPage?: number;
    } = {},
  ) {
    const octokit = await this.getOctokit();
    const {
      state = 'all',
      labels,
      since,
      sort = 'created',
      direction = 'desc',
      perPage = 100,
    } = options;

    try {
      const issues = await octokit.paginate(octokit.issues.listForRepo, {
        owner,
        repo,
        state,
        labels,
        since,
        sort,
        direction,
        per_page: perPage,
      });

      // Pull Requestを除外（GitHub APIではPRもIssueとして返される）
      return issues.filter((issue) => !issue.pull_request);
    } catch (error) {
      this.handleError(error, 'Issue一覧の取得');
      throw error;
    }
  }

  /**
   * リリース一覧を取得
   */
  async listReleases(
    owner: string,
    repo: string,
    options: {
      perPage?: number;
    } = {},
  ) {
    const octokit = await this.getOctokit();
    const { perPage = 100 } = options;

    try {
      const releases = await octokit.paginate(octokit.repos.listReleases, {
        owner,
        repo,
        per_page: perPage,
      });
      return releases;
    } catch (error) {
      this.handleError(error, 'リリース一覧の取得');
      throw error;
    }
  }

  /**
   * タグ一覧を取得
   */
  async listTags(owner: string, repo: string) {
    const octokit = await this.getOctokit();

    try {
      const tags = await octokit.paginate(octokit.repos.listTags, {
        owner,
        repo,
        per_page: 100,
      });
      return tags;
    } catch (error) {
      this.handleError(error, 'タグ一覧の取得');
      throw error;
    }
  }

  /**
   * リポジトリ情報を取得
   */
  async getRepository(owner: string, repo: string) {
    const octokit = await this.getOctokit();

    try {
      const { data } = await octokit.repos.get({
        owner,
        repo,
      });
      return data;
    } catch (error) {
      this.handleError(error, 'リポジトリ情報の取得');
      throw error;
    }
  }

  /**
   * エラーハンドリング
   */
  private handleError(error: any, operation: string): void {
    if (error.status === 404) {
      this.logger.error(
        `${operation}に失敗: リソースが見つかりません (404)`,
        error,
      );
    } else if (error.status === 403) {
      this.logger.error(
        `${operation}に失敗: 権限がありません (403)`,
        error,
      );
      this.logger.warn(
        'GitHub App に必要な権限が付与されているか確認してください。',
      );
    } else if (error.status === 401) {
      this.logger.error(`${operation}に失敗: 認証エラー (401)`, error);
    } else if (error.status === 429) {
      this.logger.error(
        `${operation}に失敗: Rate Limit に到達しました (429)`,
        error,
      );
    } else {
      this.logger.error(`${operation}に失敗`, error);
    }
  }
}
