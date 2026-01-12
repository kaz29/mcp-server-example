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

## 📦 提供する機能

1. **get_current_time** - 現在の日時を取得
2. **calculate** - 四則演算（加算、減算、乗算、除算）
3. **save_note** - メモの保存
4. **get_note** - メモの取得
5. **list_notes** - 保存されたメモの一覧表示

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

## 🏗️ プロジェクト構造

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

### 1. レイヤー分離

- **ツール層**: MCPプロトコルとのインターフェース（`@Tool`デコレーター）
- **サービス層**: ビジネスロジック（`@Injectable()`）
- **ドメイン層**: エンティティ、リポジトリ（将来の拡張）

### 2. 依存性注入

```typescript
constructor(private readonly timeService: TimeService) {}
```

コンストラクタインジェクションで疎結合を実現し、テストが容易。

### 3. 型安全なパラメータ

```typescript
parameters: z.object({
  operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
  a: z.number(),
  b: z.number(),
})
```

Zodによる実行時バリデーションとTypeScript型推論。

### 4. MCPモジュール設定

```typescript
McpModule.forRoot({
  name: 'nestjs-mcp-server',
  version: '1.0.0',
  transport: McpTransportType.STREAMABLE_HTTP,
  mcpEndpoint: '/mcp',
})
```

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
