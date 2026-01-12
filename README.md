# NestJS MCP Server

NestJSを使用したModel Context Protocol (MCP)サーバーの実装サンプルです。
DDD/クリーンアーキテクチャを適用しやすい構造で、今後のMCP開発のベースとして利用できます。

## 🎯 特徴

- **NestJS**: エンタープライズグレードのフレームワーク
- **デコレーターベース**: `@Tool`デコレーターで簡潔にツールを定義
- **レイヤー分離**: サービス層とツール層を分離（DDD適用可能）
- **依存性注入**: テスタブルで保守性の高い設計
- **Streamable HTTP**: 最新のMCP仕様に対応
- **Zod**: 型安全なパラメータバリデーション

## 🌿 ブランチ構成

このリポジトリは、学習段階に応じて2つのブランチを提供しています：

### `basic-example` ブランチ（初心者向け）

基本的なMCP実装のサンプルです。以下のシンプルな機能を提供します：

- **get_current_time** - 現在の日時を取得
- **calculate** - 四則演算（加算、減算、乗算、除算）
- **save_note** / **get_note** / **list_notes** - メモの保存・取得・一覧表示

**推奨する利用シーン:**
- MCPの基本的な仕組みを学びたい
- NestJSとMCPの連携方法を理解したい
- シンプルな実装例から始めたい

```bash
git checkout basic-example
```

### `main` ブランチ（実践向け）

実用的なFour Keys (DORA Metrics) 実装を含む、より本格的なサンプルです。

**追加機能:**
- GitHub APIを使用したデプロイメント分析
- Four Keys メトリクス計算（デプロイ頻度、リードタイム、変更失敗率、MTTR）
- 包括的なテストカバレッジ（95%以上）
- モック戦略を含むテスト実装例

**推奨する利用シーン:**
- 実際のプロダクション環境での使用を検討している
- GitHub統合などの外部API連携方法を学びたい
- テスト戦略やカバレッジ改善の参考にしたい

## 📦 提供する機能

### basic-exampleブランチ

1. **get_current_time** - 現在の日時を取得
2. **calculate** - 四則演算（加算、減算、乗算、除算）
3. **save_note** - メモの保存
4. **get_note** - メモの取得
5. **list_notes** - 保存されたメモの一覧表示

### mainブランチ（basic-exampleの機能 + 以下）

#### Four Keys (DORA Metrics) ツール

6. **get_deployment_frequency** - デプロイ頻度の計算
   - GitHub Releases、Git タグ、GitHub Actions ワークフローから検出
   - DORA パフォーマンスレベル評価（Elite/High/Medium/Low）

7. **get_lead_time** - リードタイム（変更のリードタイム）の計算
   - PR作成からマージまでの時間を集計
   - 平均、中央値、95パーセンタイルを算出

8. **get_change_failure_rate** - 変更失敗率の計算
   - ホットフィックスPR、インシデントIssue、ワークフロー失敗から検出
   - デプロイ成功率の分析

9. **get_mttr** - MTTR（平均復旧時間）の計算
   - インシデントの検出から解決までの時間を集計
   - Issue/PRベースのインシデント追跡

10. **get_four_keys_summary** - Four Keys メトリクスの総合サマリー
    - 4つのメトリクスを一度に取得
    - 総合パフォーマンスレベルの評価

## 🚀 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. ビルド

```bash
npm run build
```

### 3. サーバーの起動

```bash
npm start
```

サーバーが起動すると、以下のように表示されます：

```
🚀 NestJS MCP Server running on http://localhost:3000
📡 MCP Endpoint: http://localhost:3000/mcp
```

### 4. テスト実行

```bash
node test-client.mjs
```

### 5. mainブランチ用の追加セットアップ

Four Keys機能を使用する場合、GitHub App認証の設定が必要です。

**📖 詳細な設定手順は [GitHub App 設定ガイド](./docs/GITHUB_APP_SETUP.md) を参照してください。**

#### クイックセットアップ

1. `.env.example`を`.env`にコピー
2. GitHub Appを作成（[詳細手順](./docs/GITHUB_APP_SETUP.md#github-app-の作成手順)）
3. 以下の環境変数を設定：

```bash
GITHUB_APP_ID=your_app_id
GITHUB_INSTALLATION_ID=your_installation_id
GITHUB_PRIVATE_KEY_PATH=path/to/private-key.pem
# または
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
```

**必要なGitHub App権限:**
- Repository permissions:
  - Actions: Read
  - Contents: Read
  - Issues: Read
  - Pull requests: Read
  - Metadata: Read

## 🏗️ プロジェクト構造

### basic-exampleブランチ

```
src/
├── main.ts                          # エントリーポイント
├── app.module.ts                    # ルートモジュール
├── mcp/                             # MCPモジュール
│   ├── mcp.module.ts               # MCP設定・プロバイダー登録
│   ├── tools/                       # ツール層（MCPインターフェース）
│   │   ├── time.tool.ts            # 時刻ツール
│   │   ├── calculator.tool.ts      # 計算ツール
│   │   └── notes.tool.ts           # メモツール
│   └── services/                    # サービス層（ビジネスロジック）
│       ├── time.service.ts
│       ├── calculator.service.ts
│       └── notes.service.ts
└── domain/                          # ドメイン層（将来の拡張用）
    └── notes/
        └── (エンティティ、リポジトリなど)
```

### mainブランチ（追加構造）

```
src/
└── mcp/
    ├── tools/
    │   └── four-keys/               # Four Keysツール層
    │       ├── deployment-frequency.tool.ts
    │       ├── lead-time.tool.ts
    │       ├── change-failure-rate.tool.ts
    │       ├── mttr.tool.ts
    │       └── summary.tool.ts
    ├── services/
    │   ├── github/                  # GitHub統合サービス
    │   │   ├── github-auth.service.ts    # GitHub App認証
    │   │   └── github-api.service.ts     # GitHub API クライアント
    │   └── four-keys/               # Four Keys計算サービス
    │       ├── deployment-frequency.service.ts
    │       ├── lead-time.service.ts
    │       ├── change-failure-rate.service.ts
    │       └── mttr.service.ts
    └── types/
        ├── github.types.ts          # GitHub API型定義
        └── four-keys.types.ts       # Four Keys型定義
```

## 📝 実装例

### ツール定義（デコレーターベース）

```typescript
// src/mcp/tools/time.tool.ts
import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { TimeService } from '../services/time.service';

@Injectable()
export class TimeTool {
  constructor(private readonly timeService: TimeService) {}

  @Tool({
    name: 'get_current_time',
    description: '現在の日時を取得します',
    parameters: z.object({}),
  })
  async getCurrentTime() {
    const time = this.timeService.getCurrentTime();
    return `現在の日時: ${time}`;
  }
}
```

### サービス層（ビジネスロジック）

```typescript
// src/mcp/services/time.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class TimeService {
  getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  }
}
```

### モジュール設定

```typescript
// src/mcp/mcp.module.ts
import { Module } from '@nestjs/common';
import { TimeService } from './services/time.service';
import { TimeTool } from './tools/time.tool';

@Module({
  providers: [
    // サービス層
    TimeService,
    // ツール層
    TimeTool,
  ],
})
export class McpToolsModule {}
```

## 🔧 開発

### 開発モード（ホットリロード）

```bash
npm run start:dev
```

### ビルドのみ

```bash
npm run build
```

## 🎓 学習ポイント

### basic-exampleブランチ

#### 1. レイヤー分離

- **ツール層**: MCPプロトコルとのインターフェース（`@Tool`デコレーター）
- **サービス層**: ビジネスロジック（`@Injectable()`）
- **ドメイン層**: エンティティ、リポジトリ（将来の拡張）

#### 2. 依存性注入

```typescript
constructor(private readonly timeService: TimeService) {}
```

コンストラクタインジェクションで疎結合を実現し、テストが容易。

#### 3. 型安全なパラメータ

```typescript
parameters: z.object({
  operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
  a: z.number(),
  b: z.number(),
})
```

Zodによる実行時バリデーションとTypeScript型推論。

#### 4. MCPモジュール設定

```typescript
McpModule.forRoot({
  name: 'nestjs-mcp-server',
  version: '1.0.0',
  transport: McpTransportType.STREAMABLE_HTTP,
  mcpEndpoint: '/mcp',
})
```

### mainブランチ（追加の学習ポイント）

#### 5. 外部API統合（GitHub API）

```typescript
@Injectable()
export class GitHubApiService {
  private octokit: Octokit | null = null;

  constructor(private readonly authService: GitHubAuthService) {}

  async listReleases(owner: string, repo: string) {
    const client = await this.getClient();
    const { data } = await client.rest.repos.listReleases({ owner, repo });
    return data;
  }
}
```

#### 6. 包括的なテスト戦略（カバレッジ95%以上）

```typescript
// Vitestを使用したモックベースのテスト
describe('DeploymentFrequencyService', () => {
  let service: DeploymentFrequencyService;
  let mockGitHubApiService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGitHubApiService = {
      listReleases: vi.fn().mockResolvedValue(mockReleases),
    };
    service = new DeploymentFrequencyService(mockGitHubApiService as any);
  });

  it('リリースベースでデプロイを検出できる', async () => {
    const result = await service.calculate('owner', 'repo', 'week', {
      method: 'release',
    });
    expect(result.totalDeployments).toBe(2);
  });
});
```

#### 7. GitHub App認証

```typescript
@Injectable()
export class GitHubAuthService {
  async getInstallationToken(): Promise<string> {
    const auth = createAppAuth({
      appId: this.config.appId,
      privateKey: this.config.privateKey,
      installationId: this.config.installationId,
    });

    const { token } = await auth({ type: 'installation' });
    return token;
  }
}
```

#### 8. CI/CD統合

- GitHub Actionsでの自動テスト実行
- カバレッジレポートのPRコメント投稿
- ビルドとテストの自動化

## 🌟 今後の拡張例

### データベース統合

```typescript
// TypeORM
@Module({
  imports: [
    TypeOrmModule.forRoot({...}),
    TypeOrmModule.forFeature([Note]),
  ],
})

// Prisma
@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}
}
```

### 外部API統合

```typescript
@Module({
  imports: [HttpModule],
})

@Injectable()
export class ExternalApiService {
  constructor(private http: HttpService) {}
}
```

### 認証・認可

```typescript
@Tool({...})
@UseGuards(AuthGuard)
async protectedTool() {...}
```

## 📚 参考リンク

- [NestJS Documentation](https://docs.nestjs.com/)
- [@rekog/mcp-nest](https://github.com/rekog-labs/MCP-Nest)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Zod Documentation](https://zod.dev/)

## 📄 ライセンス

MIT
