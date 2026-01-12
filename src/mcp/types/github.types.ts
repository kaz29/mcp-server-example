/**
 * GitHub API 関連の型定義
 */

/**
 * デプロイ検出の設定
 */
export interface DeploymentConfig {
  /**
   * デプロイ検出方法
   */
  method: 'workflow' | 'release' | 'tag';

  /**
   * ワークフロー名（method='workflow'の場合）
   */
  workflowName?: string;

  /**
   * ワークフローファイル名（method='workflow'の場合）
   * 例: 'deploy.yml'
   */
  workflowFile?: string;

  /**
   * タグprefix（method='tag'の場合）
   * このprefixで始まるタグのみを対象とする
   * 例: 'prodv' (prodvX.X.XrX形式の場合), 'v' (vX.X.X形式の場合), 'release-'
   */
  tagPrefix?: string;

  /**
   * タグパターン（method='tag'の場合）
   * 正規表現でタグ名をフィルタリング
   * 例: /^v\d+\.\d+\.\d+$/
   * 注: tagPrefixとの併用可能。その場合、prefixで先にフィルタしてからpatternを適用
   */
  tagPattern?: string;
}

/**
 * 障害検出の設定
 */
export interface FailureConfig {
  /**
   * Issue ベースの検出
   * 例: ['bug', 'incident', 'hotfix']
   */
  issueLabels?: string[];

  /**
   * PR ベースの検出
   * 例: ['hotfix']
   */
  prLabels?: string[];

  /**
   * PRブランチパターン
   * 例: /^hotfix\//
   */
  prBranchPattern?: string;

  /**
   * Workflow失敗を検出するか
   */
  detectWorkflowFailures?: boolean;
}

/**
 * GitHub App 設定
 */
export interface GitHubAppConfig {
  /**
   * GitHub App ID
   */
  appId: number;

  /**
   * Installation ID
   */
  installationId: number;

  /**
   * Private Key (PEM形式)
   */
  privateKey: string;

  /**
   * ベースURL (GitHub Enterprise Serverの場合)
   * 例: 'https://github.your-company.com/api/v3'
   */
  baseUrl?: string;
}
