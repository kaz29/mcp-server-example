# MCP HTTP認証フローのシーケンス図

## シナリオ1: 初回接続 - OAuth 2.1 Authorization Code + PKCE フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Client as MCPクライアント<br/>(Claude Desktop等)
    participant Browser as ブラウザ
    participant MCPServer as MCPサーバー<br/>(リソースサーバー)
    participant AuthServer as 認証サーバー<br/>(同一サーバー)
    participant Provider as 外部プロバイダー<br/>(GitHub/Google等)

    Note over User,Provider: 1. Discovery & Client Registration

    Client->>MCPServer: GET /.well-known/oauth-protected-resource
    MCPServer-->>Client: authorization_servers, scopes_supported, etc.

    Client->>AuthServer: GET /.well-known/oauth-authorization-server
    AuthServer-->>Client: authorization_endpoint, token_endpoint, etc.

    Client->>AuthServer: POST /oauth/register (Dynamic Client Registration)
    Note right of Client: {<br/>  client_name: "Claude Desktop",<br/>  redirect_uris: ["http://localhost:3000/callback"],<br/>  token_endpoint_auth_method: "none"<br/>}
    AuthServer-->>Client: client_id, client_secret (if applicable)

    Note over User,Provider: 2. Authorization Request

    User->>Client: MCPツールを使おうとする
    Client->>Client: PKCEパラメータ生成<br/>(code_verifier, code_challenge)

    Client->>Browser: ブラウザを開いてリダイレクト
    Browser->>AuthServer: GET /oauth/authorize?<br/>response_type=code&<br/>client_id=xxx&<br/>redirect_uri=http://localhost:3000/callback&<br/>code_challenge=yyy&<br/>code_challenge_method=S256&<br/>scope=mcp:tools:read mcp:tools:execute&<br/>state=zzz

    Note over AuthServer: セッション作成<br/>code_challengeを保存

    AuthServer-->>Browser: Set-Cookie: oauth_session=session_id<br/>Redirect to /login

    Note over User,Provider: 3. User Authentication

    Browser->>AuthServer: GET /login
    AuthServer-->>Browser: ログイン画面表示

    User->>Browser: "GitHubでログイン"をクリック
    Browser->>AuthServer: POST /oauth/authorize (consent)

    AuthServer->>Provider: Redirect to GitHub OAuth
    Provider-->>Browser: GitHubログイン画面

    User->>Browser: GitHub認証情報を入力
    Browser->>Provider: ログイン
    Provider-->>Browser: 認証成功

    Browser->>AuthServer: GET /oauth/callback?code=github_code&state=xxx
    AuthServer->>Provider: POST /token (exchange GitHub code)
    Provider-->>AuthServer: access_token, user_profile

    Note over AuthServer: ユーザープロファイル保存<br/>認可コード生成

    AuthServer-->>Browser: Redirect to redirect_uri?<br/>code=authorization_code&state=zzz

    Note over User,Provider: 4. Token Exchange

    Browser->>Client: http://localhost:3000/callback?<br/>code=authorization_code&state=zzz

    Client->>Client: stateを検証

    Client->>AuthServer: POST /oauth/token
    Note right of Client: {<br/>  grant_type: "authorization_code",<br/>  code: "authorization_code",<br/>  redirect_uri: "http://localhost:3000/callback",<br/>  code_verifier: "original_verifier",<br/>  client_id: "xxx"<br/>}

    Note over AuthServer: PKCE検証:<br/>SHA256(code_verifier) == code_challenge<br/>認可コード検証・削除

    AuthServer-->>Client: {<br/>  access_token: "eyJhbGc...",<br/>  token_type: "Bearer",<br/>  expires_in: 3600,<br/>  refresh_token: "eyJhbGc...",<br/>  scope: "mcp:tools:read mcp:tools:execute"<br/>}

    Note over Client: トークンを安全に保存

    Note over User,Provider: 5. MCP Tool Call (Authenticated)

    User->>Client: "GitHubのデプロイ頻度を教えて"

    Client->>MCPServer: POST /mcp/messages<br/>Authorization: Bearer eyJhbGc...<br/>Content-Type: application/json
    Note right of Client: {<br/>  jsonrpc: "2.0",<br/>  method: "tools/call",<br/>  params: {<br/>    name: "deployment_frequency",<br/>    arguments: {...}<br/>  }<br/>}

    Note over MCPServer: JWT検証<br/>- 署名検証<br/>- 有効期限チェック<br/>- audienceチェック<br/>- scopeチェック

    MCPServer->>MCPServer: ツール実行
    MCPServer-->>Client: {<br/>  jsonrpc: "2.0",<br/>  result: {<br/>    content: [{<br/>      type: "text",<br/>      text: "デプロイ頻度: 15回/日"<br/>    }]<br/>  }<br/>}

    Client-->>User: 結果を表示
```

## シナリオ2: トークン期限切れ - Refresh Token フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Client as MCPクライアント
    participant MCPServer as MCPサーバー
    participant AuthServer as 認証サーバー

    Note over User,AuthServer: Access Tokenが期限切れ

    User->>Client: MCPツールを使おうとする

    Client->>MCPServer: POST /mcp/messages<br/>Authorization: Bearer <expired_token>

    Note over MCPServer: JWT検証失敗<br/>(有効期限切れ)

    MCPServer-->>Client: HTTP 401 Unauthorized<br/>WWW-Authenticate: Bearer error="invalid_token",<br/>error_description="The access token expired"

    Note over Client: Refresh Tokenを使って<br/>新しいAccess Tokenを取得

    Client->>AuthServer: POST /oauth/token
    Note right of Client: {<br/>  grant_type: "refresh_token",<br/>  refresh_token: "eyJhbGc...",<br/>  client_id: "xxx"<br/>}

    Note over AuthServer: Refresh Token検証<br/>- 署名検証<br/>- 有効期限チェック<br/>- client_idチェック

    AuthServer-->>Client: {<br/>  access_token: "eyJhbGc... (new)",<br/>  token_type: "Bearer",<br/>  expires_in: 3600,<br/>  refresh_token: "eyJhbGc... (new)",<br/>  scope: "mcp:tools:read mcp:tools:execute"<br/>}

    Note over Client: 新しいトークンを保存

    Client->>MCPServer: POST /mcp/messages<br/>Authorization: Bearer <new_token>

    MCPServer->>MCPServer: JWT検証成功<br/>ツール実行

    MCPServer-->>Client: 結果を返す
    Client-->>User: 結果を表示
```

## シナリオ3: 権限不足 - Insufficient Scope エラー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Client as MCPクライアント
    participant MCPServer as MCPサーバー
    participant AuthServer as 認証サーバー
    participant Browser as ブラウザ

    Note over User,Browser: 現在のトークンは<br/>scope: "mcp:tools:read"のみ

    User->>Client: "デプロイ頻度を計算して"<br/>(書き込み権限が必要)

    Client->>MCPServer: POST /mcp/messages<br/>Authorization: Bearer eyJhbGc...<br/>(scope: mcp:tools:read)

    Note over MCPServer: JWT検証成功<br/>しかしscopeが不足

    MCPServer-->>Client: HTTP 403 Forbidden<br/>WWW-Authenticate: Bearer error="insufficient_scope",<br/>scope="mcp:tools:read mcp:tools:execute"

    Note over Client: 必要なスコープを認識<br/>再認証が必要

    Client->>User: "追加の権限が必要です。<br/>再度認証してください"
    User->>Client: 承認

    Note over Client,Browser: シナリオ1と同じフローで再認証<br/>(今度は必要なscopeを要求)

    Client->>Browser: Redirect to AuthServer
    Browser->>AuthServer: GET /oauth/authorize?<br/>scope=mcp:tools:read mcp:tools:execute&...

    Note over AuthServer,Browser: 認証・認可フロー

    Browser->>Client: callback with new authorization_code
    Client->>AuthServer: Token exchange
    AuthServer-->>Client: New tokens with required scopes

    Client->>MCPServer: POST /mcp/messages<br/>Authorization: Bearer <new_token><br/>(scope: mcp:tools:read mcp:tools:execute)

    MCPServer->>MCPServer: 検証成功・実行
    MCPServer-->>Client: 結果
    Client-->>User: 結果を表示
```

## シナリオ4: SSE (Server-Sent Events) 接続での認証

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Client as MCPクライアント
    participant MCPServer as MCPサーバー<br/>(SSE)

    Note over User,MCPServer: 既にAccess Tokenを取得済み

    User->>Client: MCPサーバーに接続

    Client->>MCPServer: GET /mcp/sse?sessionId=xxx<br/>Authorization: Bearer eyJhbGc...

    Note over MCPServer: JWT検証<br/>SSEセッション確立

    MCPServer-->>Client: HTTP 200 OK<br/>Content-Type: text/event-stream<br/><br/>event: endpoint<br/>data: /mcp/messages

    Note over Client,MCPServer: SSE接続確立<br/>双方向通信可能

    User->>Client: "ツールを実行"

    Client->>MCPServer: POST /mcp/messages<br/>Authorization: Bearer eyJhbGc...<br/>Mcp-Session-Id: xxx

    Note over MCPServer: セッションID検証<br/>JWT検証<br/>ツール実行

    MCPServer-->>Client: SSE Event<br/>data: {"result": "..."}

    Client-->>User: 結果を表示

    Note over Client,MCPServer: 長時間接続の場合

    Note over MCPServer: Access Token期限切れ間近

    MCPServer-->>Client: SSE Event<br/>event: token_expiring<br/>data: {"expires_in": 300}

    Note over Client: Refresh Tokenで更新

    Client->>MCPServer: Token更新<br/>(シナリオ2参照)

    Note over Client,MCPServer: 接続継続
```

## セキュリティのポイント

### 1. PKCE (Proof Key for Code Exchange)
- **目的**: 認可コード横取り攻撃の防止
- **仕組み**:
  - クライアントが`code_verifier`(ランダム文字列)を生成
  - `code_challenge = SHA256(code_verifier)`を計算
  - 認可リクエスト時に`code_challenge`を送信
  - トークン交換時に元の`code_verifier`を送信
  - サーバーが`SHA256(code_verifier) == code_challenge`を検証

### 2. State Parameter
- **目的**: CSRF攻撃の防止
- **仕組み**:
  - クライアントがランダムな`state`を生成
  - 認可リクエストに含める
  - コールバック時に同じ`state`が返ってくることを確認

### 3. JWT Validation
- **署名検証**: トークンが改ざんされていないか
- **Issuer検証**: 信頼できる発行者か
- **Audience検証**: このMCPサーバー向けのトークンか
- **有効期限**: トークンが期限切れでないか
- **Scope検証**: 必要な権限を持っているか

### 4. Origin Header Validation
- **目的**: DNS rebinding攻撃の防止
- **仕組み**: リクエストの`Origin`ヘッダーが許可されたオリジンか確認

## トークンのライフサイクル

```
Access Token  : 短命 (1時間程度)     → 頻繁に検証が必要な操作に使用
Refresh Token : 長命 (30日〜90日程度) → Access Token更新のみに使用
Authorization Code : 超短命 (10分程度) → 1回のみ使用可能
```

## 実装の優先順位

1. **必須**: OAuth 2.1 Authorization Code + PKCE フロー
2. **必須**: JWT検証 (署名、有効期限、audience、scope)
3. **必須**: Refresh Token フロー
4. **推奨**: Well-known エンドポイント
5. **推奨**: Dynamic Client Registration
6. **推奨**: Insufficient Scope エラーハンドリング
7. **オプション**: Token Revocation
