# GitHub Copilot から Four Keys MCP を使う方法

このガイドでは、GitHub Copilot（VS Code）から Four Keys MCPサーバーを使う方法を説明します。

## 前提条件

1. **MCPサーバーが起動していること**
   ```bash
   npm run build
   npm start
   ```
   `🚀 NestJS MCP Server running on http://localhost:3000` が表示されていればOK

2. **GitHub Copilot Chatが有効であること**
   - VS Codeで GitHub Copilot拡張がインストール済み
   - GitHub Copilot Chatが使える状態

3. **MCP設定が正しいこと**
   - `.vscode/mcp.json` が正しく設定されている（本リポジトリに含まれています）

## MCP設定の確認

`.vscode/mcp.json`:
```json
{
  "servers": {
    "four-keys-mcp": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "description": "Four Keys MCP Server"
    }
  }
}
```

## GitHub Copilot での基本的な使い方

### 1. Copilot Chatを開く

- VS Codeで `Cmd+Shift+I` (Mac) または `Ctrl+Shift+I` (Windows/Linux)
- またはサイドバーの Copilot アイコンをクリック

### 2. MCPサーバーが認識されているか確認

Copilot Chatに以下を入力:
```
@workspace どのMCPツールが使えますか？
```

または:
```
利用可能なMCPツールを教えて
```

`get_deployment_frequency` が表示されればOKです。

## プロンプト例

### 基本: デプロイ頻度を取得

```
j-com-dev/owner-management-serviceのデプロイ頻度を教えて
```

または:

```
@workspace #mcp get_deployment_frequency を使って、j-com-dev/owner-management-service の過去1ヶ月のデプロイ頻度を取得して
```

### 期間を指定

#### 過去1週間
```
j-com-dev/owner-management-serviceの過去1週間のデプロイ頻度は？
```

#### 過去3ヶ月
```
j-com-dev/owner-management-serviceの過去3ヶ月（quarter）のデプロイ頻度を教えて
```

### デプロイ検出方法を指定

#### GitHub Releases（デフォルト）
```
j-com-dev/owner-management-serviceのリリースベースでデプロイ頻度を取得
```

#### GitHub Actions ワークフロー
```
j-com-dev/owner-management-serviceのワークフロー「Deploy to Production」のデプロイ頻度を教えて
```

#### Git タグ
```
j-com-dev/owner-management-serviceのタグ（v*.*.*パターン）でデプロイ頻度を計算して
```

## 実用的なシナリオ

### シナリオ1: 基本的なデプロイ頻度の確認

**プロンプト**:
```
j-com-dev/owner-management-serviceの今月のデプロイ頻度を教えてください。
結果をもとに、チームのパフォーマンスレベルを評価してください。
```

**期待される結果**:
- デプロイ頻度の数値
- DORAパフォーマンスレベル（Elite/High/Medium/Low）
- 改善のためのアドバイス

### シナリオ2: トレンド分析

**プロンプト**:
```
j-com-dev/owner-management-serviceの以下の期間でデプロイ頻度を比較してください:
1. 過去1週間
2. 過去1ヶ月
3. 過去3ヶ月

トレンドを分析して、改善しているか悪化しているか教えてください。
```

**使い方**:
Copilotが複数回MCPツールを呼び出して比較分析します。

### シナリオ3: 改善提案

**プロンプト**:
```
j-com-dev/owner-management-serviceの現在のデプロイ頻度を取得して、
DORAのベストプラクティスに基づいて改善提案をしてください。
```

**期待される結果**:
- 現在の状況分析
- Eliteレベルに到達するための具体的なステップ
- 参考資料やツールの提案

### シナリオ4: 複数リポジトリの比較

**プロンプト**:
```
以下のリポジトリのデプロイ頻度を比較してください:
- j-com-dev/owner-management-service
- anthropics/anthropic-sdk-python

どちらがより高いデプロイ頻度を維持していますか？
```

### シナリオ5: レポート作成

**プロンプト**:
```
j-com-dev/owner-management-serviceの過去1ヶ月のデプロイ頻度を取得して、
経営層向けのサマリーレポートを作成してください。
以下を含めてください:
- 主要な指標
- パフォーマンスレベル
- 他社との比較
- 推奨事項
```

## プロンプトのコツ

### 1. 明確なリポジトリ指定
```
✅ 良い例: j-com-dev/owner-management-serviceの...
❌ 悪い例: リポジトリの...
```

### 2. 期間の明示
```
✅ 良い例: 過去1週間のデプロイ頻度
❌ 悪い例: 最近のデプロイ頻度
```

### 3. 期待する出力形式を指定
```
✅ 良い例: 結果を表形式で表示してください
✅ 良い例: グラフにできるようなデータ形式で
❌ 悪い例: （出力形式の指定なし）
```

## よくあるエラーと解決方法

### エラー1: "MCP server is not running"

**原因**: MCPサーバーが起動していない

**解決方法**:
```bash
npm start
```

サーバーが起動したら、再度プロンプトを試してください。

### エラー2: "Repository not found (404)"

**原因**:
- GitHub Appがそのリポジトリにインストールされていない
- リポジトリ名が間違っている

**解決方法**:
1. GitHub App設定で対象リポジトリへのアクセスを許可
2. リポジトリ名のスペルを確認

### エラー3: "Workflow not found"

**原因**: 指定したワークフロー名が存在しない

**解決方法**:
```
j-com-dev/owner-management-serviceで利用可能なワークフローを一覧表示して
```

まずワークフロー名を確認してから、正しい名前で再試行。

### エラー4: Copilotが MCP ツールを認識しない

**原因**:
- `.vscode/mcp.json` の設定が間違っている
- サーバーURLが正しくない
- Copilotが最新でない

**解決方法**:
1. `.vscode/mcp.json` のURLを確認: `http://localhost:3000/mcp`
2. VS Code を再起動
3. GitHub Copilot 拡張を最新版に更新

## 高度な使い方

### カスタムパラメータの指定

```
j-com-dev/owner-management-serviceのデプロイ頻度を以下の条件で取得:
- 期間: 過去1ヶ月
- メソッド: ワークフロー
- ワークフロー名: "CI/CD Pipeline"
```

### JSONで直接指定

```
MCPツール get_deployment_frequency を以下のパラメータで実行してください:
{
  "owner": "j-com-dev",
  "repo": "owner-management-service",
  "period": "month",
  "method": "release"
}
```

### 結果の加工

```
j-com-dev/owner-management-serviceのデプロイ頻度を取得して、
結果をExcelにインポートできるCSV形式に変換してください。
```

## ベストプラクティス

### 1. 定期的なモニタリング

週次でデプロイ頻度を確認する習慣をつけましょう:
```
今週のj-com-dev/owner-management-serviceのデプロイ頻度は先週と比べてどうですか？
```

### 2. チーム間での比較

複数チームがある場合、リポジトリ間で比較:
```
チームAとチームBのリポジトリのデプロイ頻度を比較して、
ベストプラクティスを見つけてください
```

### 3. 目標設定と追跡

```
現在のデプロイ頻度からEliteレベルに到達するには、
どのくらいの改善が必要ですか？具体的な数値目標を設定してください
```

## プロンプトテンプレート

コピー&ペーストで使えるテンプレート集:

### 基本テンプレート
```
[リポジトリ名]の[期間]のデプロイ頻度を[メソッド]で取得してください
```

### 分析テンプレート
```
[リポジトリ名]のデプロイ頻度を分析して、以下の質問に答えてください:
1. 現在のパフォーマンスレベルは？
2. 業界標準と比べてどうか？
3. 改善するための3つの提案は？
```

### レポートテンプレート
```
[リポジトリ名]の[期間]のデプロイメトリクスレポートを作成:
- デプロイ頻度
- トレンド分析
- パフォーマンス評価
- 推奨事項
```

## 参考資料

- [DORA Metrics](https://dora.dev/research/)
- [Four Keys Project](https://github.com/dora-team/fourkeys)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [GitHub App設定ガイド](./GITHUB_APP_SETUP.md)

## トラブルシューティングチェックリスト

問題が発生した場合、以下を確認:

- [ ] MCPサーバーが起動している (`npm start`)
- [ ] `.vscode/mcp.json` が正しく設定されている
- [ ] GitHub Appが対象リポジトリにインストールされている
- [ ] `.env` ファイルの設定が正しい
- [ ] VS Code / Copilot拡張が最新版
- [ ] ネットワーク接続が正常

それでも解決しない場合は、サーバーログ（ターミナル）を確認してください。
