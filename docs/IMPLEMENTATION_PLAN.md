# Four Keys MCP 実装計画

## 概要

GitHub App を使用して GitHub API から Four Keys（DORA メトリクス）を収集する MCP サーバーを実装します。
NestJS ベースの既存の雛形を活用し、段階的に機能を追加していきます。

## アーキテクチャ設計

```
┌─────────────────────────────────────────────────────────────┐
│                        MCP Client                           │
│                    (Claude Desktop等)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP Protocol
┌────────────────────────▼────────────────────────────────────┐
│                   Four Keys MCP Server                      │
│                      (NestJS)                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Tool Layer (MCP Tools)                  │  │
│  │  - DeploymentFrequencyTool                          │  │
│  │  - LeadTimeTool                                     │  │
│  │  - ChangeFailureRateTool                            │  │
│  │  - MTTRTool                                         │  │
│  │  - FourKeysSummaryTool                              │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │           Service Layer (Business Logic)            │  │
│  │  - GitHubAuthService (認証)                         │  │
│  │  - GitHubApiService (API クライアント)              │  │
│  │  - DeploymentFrequencyService                       │  │
│  │  - LeadTimeService                                  │  │
│  │  - ChangeFailureRateService                         │  │
│  │  - MTTRService                                      │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │            Infrastructure Layer                      │  │
│  │  - ConfigModule (環境変数管理)                      │  │
│  │  - CacheModule (API レート制限対策)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      GitHub API                             │
│            (GitHub App 認証で アクセス)                     │
└─────────────────────────────────────────────────────────────┘
```

## 必要なパッケージ

### 依存関係の追加

```bash
npm install @octokit/rest @octokit/auth-app dotenv date-fns
npm install -D @types/node
```

### パッケージの説明

| パッケージ | 用途 |
|-----------|------|
| `@octokit/rest` | GitHub REST API クライアント |
| `@octokit/auth-app` | GitHub App 認証 |
| `dotenv` | 環境変数管理 |
| `date-fns` | 日付計算（期間指定、集計） |

## ディレクトリ構成

```
src/
├── mcp/
│   ├── services/
│   │   ├── github/
│   │   │   ├── github-auth.service.ts       # GitHub App 認証
│   │   │   ├── github-auth.service.spec.ts
│   │   │   ├── github-api.service.ts        # GitHub API クライアント
│   │   │   └── github-api.service.spec.ts
│   │   │
│   │   ├── four-keys/
│   │   │   ├── deployment-frequency.service.ts
│   │   │   ├── deployment-frequency.service.spec.ts
│   │   │   ├── lead-time.service.ts
│   │   │   ├── lead-time.service.spec.ts
│   │   │   ├── change-failure-rate.service.ts
│   │   │   ├── change-failure-rate.service.spec.ts
│   │   │   ├── mttr.service.ts
│   │   │   └── mttr.service.spec.ts
│   │   │
│   │   └── (既存のサービス...)
│   │
│   ├── tools/
│   │   ├── four-keys/
│   │   │   ├── deployment-frequency.tool.ts
│   │   │   ├── deployment-frequency.tool.spec.ts
│   │   │   ├── lead-time.tool.ts
│   │   │   ├── lead-time.tool.spec.ts
│   │   │   ├── change-failure-rate.tool.ts
│   │   │   ├── change-failure-rate.tool.spec.ts
│   │   │   ├── mttr.tool.ts
│   │   │   ├── mttr.tool.spec.ts
│   │   │   ├── four-keys-summary.tool.ts
│   │   │   └── four-keys-summary.tool.spec.ts
│   │   │
│   │   └── (既存のツール...)
│   │
│   ├── types/
│   │   ├── github.types.ts          # GitHub API のレスポンス型
│   │   └── four-keys.types.ts       # Four Keys の型定義
│   │
│   └── mcp.module.ts
│
├── config/
│   └── github-app-private-key.pem   # GitHub App の秘密鍵 (gitignore)
│
└── main.ts

docs/
├── GITHUB_APP_SETUP.md              # GitHub App 設定ガイド
└── IMPLEMENTATION_PLAN.md           # 本ドキュメント
```

## データモデル

### Four Keys の型定義

```typescript
// src/mcp/types/four-keys.types.ts

/**
 * 期間指定
 */
export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * リポジトリ指定
 */
export interface RepositoryInput {
  owner: string;
  repo: string;
}

/**
 * デプロイ頻度の結果
 */
export interface DeploymentFrequency {
  repository: string;
  period: Period;
  dateRange: DateRange;
  totalDeployments: number;
  deploymentsPerDay: number;
  deploymentDates: Date[];
}

/**
 * リードタイムの結果
 */
export interface LeadTime {
  repository: string;
  period: Period;
  dateRange: DateRange;
  averageLeadTimeHours: number;
  medianLeadTimeHours: number;
  p95LeadTimeHours: number;
  samples: LeadTimeSample[];
}

export interface LeadTimeSample {
  prNumber: number;
  title: string;
  createdAt: Date;
  mergedAt: Date;
  leadTimeHours: number;
}

/**
 * 変更失敗率の結果
 */
export interface ChangeFailureRate {
  repository: string;
  period: Period;
  dateRange: DateRange;
  totalDeployments: number;
  failedDeployments: number;
  failureRate: number; // 0-100 (%)
  failures: FailureIncident[];
}

export interface FailureIncident {
  type: 'workflow_failure' | 'hotfix_pr' | 'incident_issue';
  identifier: string; // PR番号、Issue番号、Workflow Run ID
  date: Date;
  title: string;
}

/**
 * MTTR（平均復旧時間）の結果
 */
export interface MTTR {
  repository: string;
  period: Period;
  dateRange: DateRange;
  averageMTTRHours: number;
  medianMTTRHours: number;
  incidents: MTTRIncident[];
}

export interface MTTRIncident {
  issueNumber?: number;
  prNumber?: number;
  title: string;
  detectedAt: Date;
  resolvedAt: Date;
  mttrHours: number;
}

/**
 * Four Keys サマリー
 */
export interface FourKeysSummary {
  repository: string;
  period: Period;
  dateRange: DateRange;
  deploymentFrequency: {
    deploymentsPerDay: number;
    total: number;
  };
  leadTime: {
    averageHours: number;
    medianHours: number;
  };
  changeFailureRate: {
    rate: number; // %
    total: number;
    failed: number;
  };
  mttr: {
    averageHours: number;
    medianHours: number;
  };
  performanceLevel: PerformanceLevel;
}

/**
 * DORA パフォーマンスレベル
 */
export type PerformanceLevel = 'elite' | 'high' | 'medium' | 'low';
```

### GitHub API の型定義

```typescript
// src/mcp/types/github.types.ts

/**
 * デプロイ検出の設定
 */
export interface DeploymentConfig {
  method: 'workflow' | 'release' | 'tag';

  // workflow の場合
  workflowName?: string;
  workflowFile?: string;

  // tag の場合
  tagPattern?: string; // 例: /^v\d+\.\d+\.\d+$/
}

/**
 * 障害検出の設定
 */
export interface FailureConfig {
  // Issue ベースの検出
  issueLabels?: string[]; // 例: ['bug', 'incident', 'hotfix']

  // PR ベースの検出
  prLabels?: string[]; // 例: ['hotfix']
  prBranchPattern?: string; // 例: /^hotfix\//

  // Workflow ベースの検出
  detectWorkflowFailures?: boolean;
}

/**
 * GitHub App 設定
 */
export interface GitHubAppConfig {
  appId: number;
  installationId: number;
  privateKey: string;
  baseUrl?: string; // GitHub Enterprise Server の場合
}
```

## 実装する機能

### Phase 1: 基盤実装

#### 1. GitHub App 認証 (GitHubAuthService)

**責務**: GitHub App として認証し、Installation Token を取得・管理

**主要メソッド**:
```typescript
class GitHubAuthService {
  // Installation Token の取得（キャッシュ付き）
  async getInstallationToken(): Promise<string>

  // JWT の生成（内部用）
  private generateJWT(): string

  // トークンの有効性チェック
  async validateToken(): Promise<boolean>
}
```

**実装のポイント**:
- JWT を生成して Installation Token を取得
- トークンは1時間有効なのでキャッシュ（有効期限の5分前に再取得）
- 秘密鍵はファイルまたは環境変数から読み込み

#### 2. GitHub API クライアント (GitHubApiService)

**責務**: GitHub REST API への統一的なアクセスを提供

**主要メソッド**:
```typescript
class GitHubApiService {
  // Octokit インスタンスの取得
  async getOctokit(): Promise<Octokit>

  // ワークフロー実行履歴の取得
  async listWorkflowRuns(owner: string, repo: string, options: {...}): Promise<WorkflowRun[]>

  // PR 一覧の取得
  async listPullRequests(owner: string, repo: string, options: {...}): Promise<PullRequest[]>

  // Issue 一覧の取得
  async listIssues(owner: string, repo: string, options: {...}): Promise<Issue[]>

  // リリース一覧の取得
  async listReleases(owner: string, repo: string, options: {...}): Promise<Release[]>

  // タグ一覧の取得
  async listTags(owner: string, repo: string): Promise<Tag[]>
}
```

**実装のポイント**:
- GitHubAuthService を依存性注入
- ページネーション対応（すべてのデータを取得）
- エラーハンドリング（Rate Limit、403、404 など）

### Phase 2: Four Keys 指標実装

#### 3. デプロイ頻度 (DeploymentFrequencyService)

**計算ロジック**:
1. 設定に基づいてデプロイイベントを検出
   - Workflow: 特定ワークフローの成功実行
   - Release: GitHub Releases の作成
   - Tag: 特定パターンのタグ作成
2. 期間内のデプロイ回数をカウント
3. 1日あたりの平均デプロイ回数を計算

**主要メソッド**:
```typescript
class DeploymentFrequencyService {
  async calculate(
    owner: string,
    repo: string,
    period: Period,
    config: DeploymentConfig
  ): Promise<DeploymentFrequency>
}
```

#### 4. リードタイム (LeadTimeService)

**計算ロジック**:
1. 期間内にマージされた PR を取得
2. 各 PR の作成日時とマージ日時の差を計算
3. 平均値、中央値、95パーセンタイルを算出

**主要メソッド**:
```typescript
class LeadTimeService {
  async calculate(
    owner: string,
    repo: string,
    period: Period
  ): Promise<LeadTime>
}
```

**実装のポイント**:
- ドラフト PR は除外するかオプションで選択可能に
- `main` または `master` ブランチへのマージのみを対象

#### 5. 変更失敗率 (ChangeFailureRateService)

**計算ロジック**:
1. デプロイ総数を取得（DeploymentFrequencyService を再利用）
2. 失敗を検出:
   - デプロイワークフローの失敗
   - `hotfix` ラベル付き PR
   - `incident` / `bug` ラベル付き Issue（デプロイ後に作成）
3. 失敗率 = 失敗数 / デプロイ総数 × 100

**主要メソッド**:
```typescript
class ChangeFailureRateService {
  async calculate(
    owner: string,
    repo: string,
    period: Period,
    deploymentConfig: DeploymentConfig,
    failureConfig: FailureConfig
  ): Promise<ChangeFailureRate>
}
```

#### 6. MTTR (MTTRService)

**計算ロジック**:
1. 障害 Issue / hotfix PR を取得
2. 作成日時から解決日時（クローズ日時）までの時間を計算
3. 平均値、中央値を算出

**主要メソッド**:
```typescript
class MTTRService {
  async calculate(
    owner: string,
    repo: string,
    period: Period,
    failureConfig: FailureConfig
  ): Promise<MTTR>
}
```

### Phase 3: MCP Tool 実装

各 Service に対応する MCP Tool を実装します。

#### 7. Four Keys MCP Tools

```typescript
// deployment-frequency.tool.ts
@Tool({
  name: 'get_deployment_frequency',
  description: 'リポジトリのデプロイ頻度を取得します',
  parameters: z.object({
    owner: z.string().describe('リポジトリオーナー'),
    repo: z.string().describe('リポジトリ名'),
    period: z.enum(['day', 'week', 'month', 'quarter', 'year']),
    method: z.enum(['workflow', 'release', 'tag']).default('workflow'),
    workflowName: z.string().optional(),
  })
})
async getDeploymentFrequency({ ... }) { ... }

// lead-time.tool.ts
@Tool({
  name: 'get_lead_time',
  description: 'リポジトリのリードタイムを取得します',
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    period: z.enum(['day', 'week', 'month', 'quarter', 'year']),
  })
})
async getLeadTime({ ... }) { ... }

// change-failure-rate.tool.ts
@Tool({
  name: 'get_change_failure_rate',
  description: '変更失敗率を取得します',
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    period: z.enum(['day', 'week', 'month', 'quarter', 'year']),
    issueLabels: z.array(z.string()).optional(),
    prLabels: z.array(z.string()).optional(),
  })
})
async getChangeFailureRate({ ... }) { ... }

// mttr.tool.ts
@Tool({
  name: 'get_mttr',
  description: '平均復旧時間（MTTR）を取得します',
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    period: z.enum(['day', 'week', 'month', 'quarter', 'year']),
    issueLabels: z.array(z.string()).optional(),
  })
})
async getMTTR({ ... }) { ... }

// four-keys-summary.tool.ts
@Tool({
  name: 'get_four_keys_summary',
  description: 'Four Keys 指標のサマリーを取得します',
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    period: z.enum(['day', 'week', 'month', 'quarter', 'year']),
  })
})
async getFourKeysSummary({ ... }) { ... }
```

## 環境変数の設計

```bash
# .env.example

# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_INSTALLATION_ID=12345678
GITHUB_PRIVATE_KEY_PATH=./config/github-app-private-key.pem
# または
# GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."

# GitHub Enterprise Server (optional)
# GITHUB_BASE_URL=https://github.your-company.com/api/v3

# Server Configuration
PORT=3000
NODE_ENV=development

# デフォルト設定（オプション）
DEFAULT_DEPLOYMENT_METHOD=workflow
DEFAULT_DEPLOYMENT_WORKFLOW_NAME=Deploy to Production
DEFAULT_FAILURE_ISSUE_LABELS=bug,incident,hotfix
DEFAULT_FAILURE_PR_LABELS=hotfix
```

## 実装の優先順位

### ステップ 1: 基盤（1-2日）
1. ✅ GitHub App 設定ガイド作成
2. パッケージインストール
3. 環境変数設定
4. GitHubAuthService 実装
5. GitHubApiService 実装

### ステップ 2: デプロイ頻度（1日）
1. DeploymentFrequencyService 実装
2. DeploymentFrequencyTool 実装
3. テスト・動作確認

### ステップ 3: リードタイム（1日）
1. LeadTimeService 実装
2. LeadTimeTool 実装
3. テスト・動作確認

### ステップ 4: 変更失敗率 & MTTR（2日）
1. ChangeFailureRateService 実装
2. ChangeFailureRateTool 実装
3. MTTRService 実装
4. MTTRTool 実装
5. テスト・動作確認

### ステップ 5: サマリー機能（1日）
1. FourKeysSummaryTool 実装
2. パフォーマンスレベル判定ロジック
3. テスト・動作確認

### ステップ 6: 最適化 & ドキュメント（1-2日）
1. エラーハンドリング強化
2. キャッシュ実装（API Rate Limit 対策）
3. README・使い方ガイド作成
4. デモシナリオ作成

## パフォーマンスレベルの判定基準

DORA の基準に基づいて判定:

```typescript
function determinePerformanceLevel(summary: FourKeysSummary): PerformanceLevel {
  // Elite:
  //   - デプロイ頻度: 1日複数回
  //   - リードタイム: < 1日
  //   - 変更失敗率: < 15%
  //   - MTTR: < 1時間

  // High:
  //   - デプロイ頻度: 週1回〜月1回
  //   - リードタイム: < 1週間
  //   - 変更失敗率: < 20%
  //   - MTTR: < 1日

  // Medium:
  //   - デプロイ頻度: 月1回〜半年1回
  //   - リードタイム: < 1ヶ月
  //   - 変更失敗率: < 30%
  //   - MTTR: < 1週間

  // Low: 上記以外
}
```

## エラーハンドリング

### Rate Limit 対策
- Installation Token は1時間に5000リクエストまで
- レスポンスヘッダーの `X-RateLimit-Remaining` を監視
- 残り10%未満になったら警告ログ
- 429 エラー時は `Retry-After` ヘッダーに従って待機

### リトライロジック
- ネットワークエラー: 3回まで exponential backoff でリトライ
- 500番台エラー: 2回までリトライ
- 404 エラー: リトライしない（リポジトリが存在しない）

### ユーザーフレンドリーなエラーメッセージ
```typescript
// 権限不足
"GitHub App に必要な権限がありません。GITHUB_APP_SETUP.md を参照して Actions の Read 権限を付与してください。"

// リポジトリが見つからない
"リポジトリ 'owner/repo' が見つかりません。リポジトリ名とオーナー名を確認してください。"

// ワークフローが見つからない
"ワークフロー 'Deploy to Production' が見つかりません。.github/workflows/ 配下のワークフロー名を確認してください。"
```

## テスト戦略

### 単体テスト
- Service 層: ビジネスロジックのテスト
- GitHub API のモック化（`@octokit/rest` をモック）

### 統合テスト
- 実際の GitHub リポジトリを使ったテスト
- テスト用の public リポジトリを用意

### E2E テスト
- MCP クライアントからの実際の呼び出しをテスト
- Claude Desktop との接続テスト

## 次のステップ

1. **GitHub App の作成**: `docs/GITHUB_APP_SETUP.md` に従って作成
2. **パッケージのインストール**: 必要な npm パッケージをインストール
3. **基盤実装**: GitHubAuthService と GitHubApiService から開始
4. **段階的な機能追加**: デプロイ頻度 → リードタイム → その他の順で実装

---

## 参考資料

- [DORA Metrics](https://dora.dev/research/)
- [GitHub REST API](https://docs.github.com/en/rest)
- [Octokit.js](https://github.com/octokit/octokit.js)
- [GitHub App Authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app)
