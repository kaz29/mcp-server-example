# GitHub Copilot Instructions for NestJS MCP Server

このドキュメントは、GitHub Copilotがこのコードベースで効果的に作業するための指示を提供します。

---

## ⚠️ 最重要事項: ターミナルコマンド実行時の注意

**`run_in_terminal`でコマンドを実行した後、必ず`terminal_last_command`を使用して実行結果を取得してください。**

```
❌ 間違い: run_in_terminalを実行して、結果を確認せずに次の作業に進む
✅ 正解: run_in_terminalを実行後、terminal_last_commandで出力を取得してから判断する
```

### 理由
- `run_in_terminal`はコマンドを実行するだけで、実行結果（stdout/stderr）を返さない場合があります
- テスト結果、ビルドエラー、その他の重要な情報は`terminal_last_command`で取得する必要があります
- 実行結果を確認せずに次の作業に進むと、エラーを見逃す可能性があります

### 推奨ワークフロー
1. `run_in_terminal`でコマンドを実行
2. `terminal_last_command`で実行結果を取得
3. 結果を確認してから次のアクションを決定

---

## 📋 プロジェクト概要

このプロジェクトはNestJSを使用したModel Context Protocol (MCP)サーバーの実装です。

### 技術スタック
- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **MCP Library**: @rekog/mcp-nest
- **Validation**: Zod
- **Testing**: Vitest
- **GitHub API**: Octokit

### 主要機能
- 基本ツール: 時刻取得、計算機、メモ管理
- Four Keys（DORAメトリクス）: デプロイ頻度、リードタイム、変更失敗率、MTTR

---

## 🏗️ アーキテクチャ

### レイヤー構造

```
src/mcp/
├── tools/          # ツール層（MCPインターフェース）
│   ├── *.tool.ts   # @Toolデコレーターを使用
│   └── four-keys/  # Four Keys関連ツール
├── services/       # サービス層（ビジネスロジック）
│   ├── *.service.ts
│   ├── four-keys/  # Four Keys関連サービス
│   └── github/     # GitHub API関連サービス
└── types/          # 型定義
```

### 命名規則
- **ツール**: `*.tool.ts` - MCPツールのエンドポイント定義
- **サービス**: `*.service.ts` - ビジネスロジック
- **テスト**: `*.spec.ts` - 対応するファイルと同じディレクトリに配置
- **型定義**: `*.types.ts` - 共有型定義

---

## 🔧 開発ガイドライン

### 新しいツールの追加

1. **サービスを作成** (`src/mcp/services/`)
```typescript
@Injectable()
export class MyService {
  myMethod(): string {
    return 'result';
  }
}
```

2. **ツールを作成** (`src/mcp/tools/`)
```typescript
@Injectable()
export class MyTool {
  constructor(private readonly myService: MyService) {}

  @Tool({
    name: 'my_tool',
    description: '説明',
    parameters: z.object({...}),
  })
  async execute(params: { ... }) {
    return this.myService.myMethod();
  }
}
```

3. **モジュールに登録** (`src/mcp/mcp.module.ts`)

### テスト作成

- 各ツール/サービスに対して`.spec.ts`ファイルを作成
- モックを使用してサービスの依存関係を分離
- Vitestを使用

```bash
# テスト実行
npm run test

# カバレッジ付きテスト
npm run test:cov

# ウォッチモード
npm run test:watch
```

---

## 📝 コーディング規約

### TypeScript
- 厳格な型付けを使用
- `any`型は避ける
- インターフェースと型エイリアスを適切に使い分ける

### NestJS
- 依存性注入（DI）を活用
- `@Injectable()`デコレーターを使用
- コンストラクタインジェクションを使用

### Zod バリデーション
- MCPツールのパラメータは必ずZodスキーマで定義
- 日本語の説明を`description`に含める

```typescript
parameters: z.object({
  owner: z.string().describe('リポジトリのオーナー名'),
  repo: z.string().describe('リポジトリ名'),
})
```

---

## 🚀 よく使うコマンド

```bash
# 開発
npm run start:dev     # 開発モード（ホットリロード）
npm run build         # ビルド
npm start             # プロダクション起動

# テスト
npm run test          # 単体テスト
npm run test:cov      # カバレッジ付きテスト
npm run test:watch    # ウォッチモード
npm run test:integration  # 統合テスト
npm run test:e2e      # E2Eテスト
```

---

## ⚠️ 注意事項

1. **GitHub認証**: Four Keys機能にはGitHub認証が必要（環境変数または`.env`ファイル）
2. **テスト**: 変更後は必ずテストを実行して確認
3. **型安全性**: Zodスキーマと TypeScript型を一致させる

---

## 📂 重要なファイル

- `src/mcp/mcp.module.ts` - MCPモジュール設定
- `src/main.ts` - アプリケーションエントリーポイント
- `vitest.config.ts` - テスト設定
- `tsconfig.json` - TypeScript設定
