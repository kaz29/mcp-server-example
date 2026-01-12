# GitHub App 設定ガイド

Four Keys MCP サーバーは GitHub App を使用して GitHub API にアクセスします。
このガイドでは、GitHub App の作成から設定までの手順を説明します。

## GitHub App とは

GitHub App は、GitHub の機能にアクセスするための推奨される認証方法です。Personal Access Token (PAT) と比較して以下のメリットがあります：

- **きめ細かい権限管理**: 必要な権限だけを付与可能
- **組織レベルでの管理**: 個人アカウントに依存しない
- **セキュリティ**: トークンの自動更新、短命なアクセストークン
- **監査ログ**: アプリの動作を追跡可能

## GitHub App の作成手順

### 1. GitHub App の新規作成

#### GitHub.com の場合
1. GitHub にログイン
2. 設定画面に移動:
   - **個人用**: `Settings` → `Developer settings` → `GitHub Apps` → `New GitHub App`
   - **Organization用**: `Organization Settings` → `Developer settings` → `GitHub Apps` → `New GitHub App`

#### GitHub Enterprise Server の場合
1. GitHub Enterprise Server にログイン
2. `Settings` → `Developer settings` → `GitHub Apps` → `New GitHub App`

### 2. 基本情報の入力

| 項目 | 設定値 |
|------|--------|
| **GitHub App name** | `Four Keys MCP` (任意の名前) |
| **Homepage URL** | `https://github.com/yourusername/four-keys-mcp` |
| **Webhook** | Active のチェックを外す（不要） |

### 3. 権限の設定

Four Keys 指標を取得するために必要な権限を設定します。

#### Repository permissions（リポジトリ権限）

| 権限 | アクセスレベル | 用途 |
|------|---------------|------|
| **Actions** | Read-only | ワークフロー実行履歴の取得（デプロイ頻度、リードタイム） |
| **Contents** | Read-only | コミット情報、リリース情報の取得 |
| **Issues** | Read-only | 障害Issue の取得（変更失敗率、MTTR） |
| **Metadata** | Read-only | リポジトリの基本情報（自動で付与） |
| **Pull requests** | Read-only | PRデータの取得（リードタイム） |

#### Organization permissions（組織権限）

必要に応じて以下を設定:

| 権限 | アクセスレベル | 用途 |
|------|---------------|------|
| **Members** | Read-only | チームメンバー情報の取得（オプション） |

### 4. インストール先の設定

**Where can this GitHub App be installed?**
- `Only on this account`: 自分のアカウント/組織のみ
- `Any account`: 任意のアカウント（公開する場合）

通常は `Only on this account` を選択してください。

### 5. アプリの作成

`Create GitHub App` ボタンをクリックして作成します。

## 認証情報の取得

### 1. App ID の確認

作成後、アプリの詳細画面で **App ID** を確認します。

```
App ID: 123456
```

この値を `.env` ファイルの `GITHUB_APP_ID` に設定します。

### 2. Private Key の生成

1. アプリの詳細画面の下部にある **Private keys** セクションに移動
2. `Generate a private key` ボタンをクリック
3. `.pem` ファイルがダウンロードされます（例: `four-keys-mcp.2024-01-15.private-key.pem`）

**重要**: このファイルは再ダウンロードできません。安全に保管してください。

### 3. リポジトリへのインストール

GitHub App を作成しただけでは使えません。対象のリポジトリにインストールする必要があります。

1. アプリの詳細画面で `Install App` をクリック
2. インストール先のアカウント/組織を選択
3. リポジトリの選択:
   - `All repositories`: すべてのリポジトリ
   - `Only select repositories`: 特定のリポジトリのみ

4. `Install` をクリック

### 4. Installation ID の確認

インストール後、URLから Installation ID を確認できます:

```
https://github.com/settings/installations/12345678
                                         ^^^^^^^^
                                    この数字が Installation ID
```

または、以下の API で確認:

```bash
# App としての認証が必要（後述）
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://api.github.com/app/installations
```

## 環境変数の設定

`.env` ファイルに以下の情報を設定します:

```bash
# GitHub App ID（アプリ詳細画面で確認）
GITHUB_APP_ID=123456

# GitHub App Installation ID（インストール後に確認）
GITHUB_INSTALLATION_ID=12345678

# Private Key のパス（相対パスまたは絶対パス）
GITHUB_PRIVATE_KEY_PATH=./config/github-app-private-key.pem

# または、Private Key を直接設定（改行を \n に置換）
# GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKC..."

# GitHub Enterprise Server を使う場合のベースURL（オプション）
# GITHUB_BASE_URL=https://github.your-company.com/api/v3
```

## Private Key の配置

### 方法1: ファイルとして配置（推奨）

```bash
# config ディレクトリを作成
mkdir -p config

# Private Key をコピー
cp ~/Downloads/four-keys-mcp.*.private-key.pem config/github-app-private-key.pem

# パーミッションを制限（重要）
chmod 600 config/github-app-private-key.pem
```

`.gitignore` に追加:
```
config/*.pem
```

### 方法2: 環境変数として設定

CI/CD 環境などでファイル配置が難しい場合:

```bash
# Private Key の内容を環境変数に設定（改行を \n に変換）
export GITHUB_PRIVATE_KEY="$(cat four-keys-mcp.*.private-key.pem | tr '\n' '|' | sed 's/|/\\n/g')"
```

## 動作確認

サーバーを起動して、認証が正しく動作するか確認します:

```bash
npm run start:dev
```

ログに以下のように表示されれば成功:

```
✓ GitHub App authenticated successfully
✓ Installation ID: 12345678
✓ Authenticated as: Four Keys MCP
```

## トラブルシューティング

### エラー: "Bad credentials"

- App ID が正しいか確認
- Private Key のパスが正しいか確認
- Private Key の形式が正しいか確認（改行コードなど）

### エラー: "Resource not accessible by integration"

- 必要な権限が付与されているか確認
- リポジトリにアプリがインストールされているか確認

### エラー: "This installation has been suspended"

- アプリのインストールが有効か確認
- Organization の設定で無効化されていないか確認

## セキュリティのベストプラクティス

1. **Private Key の管理**
   - Git リポジトリにコミットしない
   - ファイルのパーミッションを 600 に制限
   - 定期的にローテーション（年1回程度）

2. **最小権限の原則**
   - 必要な権限のみを付与
   - Read-only で十分な場合は Write 権限を付与しない

3. **アクセストークンのキャッシュ**
   - Installation Token は1時間で期限切れ
   - サーバー側で適切にキャッシュして API 呼び出しを削減

4. **監査ログの確認**
   - GitHub App の動作を定期的に確認
   - 異常なアクセスがないかチェック

## 参考リンク

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Authenticating with GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/about-authentication-with-a-github-app)
- [GitHub App Permissions](https://docs.github.com/en/apps/creating-github-apps/setting-permissions-for-github-apps/choosing-permissions-for-a-github-app)
