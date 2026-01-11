# Simple MCP Server

MCPの学習用に作成したシンプルなサーバーです。基本的な機能を理解するための5つのツールを提供します。

**このサーバーはStreamable HTTPトランスポート（最新のMCP仕様）を使用して、HTTPサーバーとして起動し、クライアントから接続する形式です。**

## 提供する機能

1. **get_current_time** - 現在の日時を取得
2. **calculate** - 四則演算（加算、減算、乗算、除算）
3. **save_note** - メモの保存
4. **get_note** - メモの取得
5. **list_notes** - 保存されたメモの一覧表示

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. ビルド

```bash
npm run build
```

### 3. MCPサーバーの起動

**重要：VSCodeから使う前に、まずサーバーを起動しておく必要があります。**

新しいターミナルウィンドウで以下を実行：

```bash
npm start
```

または起動スクリプトを使用：

```bash
./start-server.sh
```

サーバーが起動すると、以下のように表示されます：
```
Simple MCP Server (Streamable HTTP) が http://localhost:3000 で起動しました
MCPエンドポイント: http://localhost:3000/mcp
```

**サーバーは起動したまま、バックグラウンドで動作し続けます。**

### 4. サーバーの動作確認（オプション）

別のターミナルで以下を実行してサーバーが正常に動作していることを確認できます：

```bash
curl http://localhost:3000/health
```

### 5. VSCode Copilotへの統合

VSCodeの設定ファイル（`settings.json`）に以下を追加します：

1. VSCodeで `Cmd + Shift + P` を押してコマンドパレットを開く
2. "Preferences: Open User Settings (JSON)" を選択
3. 以下の設定を追加：

```json
{
  "github.copilot.chat.mcpServers": {
    "simple-mcp": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### 6. VSCodeの再起動

設定を反映するため、VSCodeを再起動します。

## 使い方

### 1. サーバーを起動

```bash
cd /Users/kaz/dev/labo/mcp
npm start
```

### 2. VSCodeでMCPツールを使用

VSCode CopilotのチャットでMCPサーバーのツールを使用できます。例：

- 「現在の時刻を教えて」
- 「123 + 456を計算して」
- 「"meeting"というキーで"明日14時から会議"というメモを保存して」
- 「"meeting"のメモを取得して」
- 「保存されているメモの一覧を表示して」

### 3. サーバーの停止

サーバーを停止するには、サーバーを起動したターミナルで `Ctrl + C` を押します。

## 開発モード

TypeScriptファイルを編集しながら自動ビルドするには：

```bash
npm run watch
```

変更後は、サーバーを再起動する必要があります。

## プロジェクト構造

```
.
├── src/
│   └── index.ts          # MCPサーバーのメインコード
├── build/                # ビルド成果物（自動生成）
├── package.json          # プロジェクト設定
├── tsconfig.json         # TypeScript設定
├── start-server.sh       # サーバー起動スクリプト
└── README.md            # このファイル
```

## MCPについて学ぶポイント

このシンプルなMCPサーバーから学べること：

1. **サーバーの基本構造** - MCPサーバーの初期化方法
2. **ツールの定義** - `ListToolsRequestSchema`でツールを定義する方法
3. **ツールの実装** - `CallToolRequestSchema`でツールのロジックを実装する方法
4. **入出力スキーマ** - JSONスキーマを使った入力検証
5. **エラーハンドリング** - エラーの適切な処理方法

## コードの主要部分の説明

### 1. サーバーの初期化
```typescript
const server = new Server({
  name: "simple-mcp-server",
  version: "1.0.0",
}, {
  capabilities: { tools: {} },
});
```

### 2. ツールの定義
`ListToolsRequestSchema`ハンドラーで、利用可能なツールとそのスキーマを定義します。

### 3. ツールの実行
`CallToolRequestSchema`ハンドラーで、実際のツールのロジックを実装します。

### 4. トランスポート
`StreamableHTTPServerTransport`（最新のMCP SDK）を使用して、HTTP経由でクライアントと通信します。これにより、SSEストリーミングと直接HTTPレスポンスの両方がサポートされます。
