#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// メモを保存するためのシンプルなストレージ（全接続で共有）
const notes: Map<string, string> = new Map();

// MCPサーバーインスタンスを作成する関数
function createServer() {
  const server = new Server(
    {
      name: "simple-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 利用可能なツールのリストを返す
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_current_time",
          description: "現在の日時を取得します",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "calculate",
          description: "簡単な計算を実行します（加算、減算、乗算、除算）",
          inputSchema: {
            type: "object",
            properties: {
              operation: {
                type: "string",
                enum: ["add", "subtract", "multiply", "divide"],
                description: "実行する演算（add: 加算, subtract: 減算, multiply: 乗算, divide: 除算）",
              },
              a: {
                type: "number",
                description: "最初の数値",
              },
              b: {
                type: "number",
                description: "2番目の数値",
              },
            },
            required: ["operation", "a", "b"],
          },
        },
        {
          name: "save_note",
          description: "キーと値のペアでメモを保存します",
          inputSchema: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description: "メモのキー",
              },
              value: {
                type: "string",
                description: "保存する内容",
              },
            },
            required: ["key", "value"],
          },
        },
        {
          name: "get_note",
          description: "保存されたメモを取得します",
          inputSchema: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description: "取得するメモのキー",
              },
            },
            required: ["key"],
          },
        },
        {
          name: "list_notes",
          description: "保存されているすべてのメモのキーを一覧表示します",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    };
  });

  // ツールの実行を処理
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "get_current_time") {
        const now = new Date();
        return {
          content: [
            {
              type: "text",
              text: `現在の日時: ${now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
            },
          ],
        };
      }

      if (name === "calculate") {
        const { operation, a, b } = args as { operation: string; a: number; b: number };
        let result: number;
        let operationName: string;

        switch (operation) {
          case "add":
            result = a + b;
            operationName = "加算";
            break;
          case "subtract":
            result = a - b;
            operationName = "減算";
            break;
          case "multiply":
            result = a * b;
            operationName = "乗算";
            break;
          case "divide":
            if (b === 0) {
              throw new Error("0で割ることはできません");
            }
            result = a / b;
            operationName = "除算";
            break;
          default:
            throw new Error(`未知の演算: ${operation}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `${operationName}: ${a} ${operation === "add" ? "+" : operation === "subtract" ? "-" : operation === "multiply" ? "×" : "÷"} ${b} = ${result}`,
            },
          ],
        };
      }

      if (name === "save_note") {
        const { key, value } = args as { key: string; value: string };
        notes.set(key, value);
        return {
          content: [
            {
              type: "text",
              text: `メモを保存しました: ${key}`,
            },
          ],
        };
      }

      if (name === "get_note") {
        const { key } = args as { key: string };
        const value = notes.get(key);
        if (value === undefined) {
          return {
            content: [
              {
                type: "text",
                text: `メモが見つかりません: ${key}`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `${key}: ${value}`,
            },
          ],
        };
      }

      if (name === "list_notes") {
        const keys = Array.from(notes.keys());
        if (keys.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "保存されているメモはありません",
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `保存されているメモのキー: ${keys.join(", ")}`,
            },
          ],
        };
      }

      throw new Error(`未知のツール: ${name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `エラー: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// SSEサーバーの設定と起動
async function main() {
  const PORT = process.env.PORT || 3000;

  // MCP用に設定されたExpressアプリを作成（DNS rebinding保護が自動適用される）
  const app = createMcpExpressApp();

  // MCPサーバーインスタンスを作成
  const server = createServer();

  // StreamableHTTPServerTransportを作成
  // sessionIdGeneratorを提供することでステートフルモードになる
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => `session_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  });

  // サーバーとトランスポートを接続
  await server.connect(transport);

  // ヘルスチェックエンドポイント
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // MCPエンドポイント - GETとPOSTの両方を処理
  app.all("/mcp", async (req, res) => {
    console.error(`MCPリクエストを受信: ${req.method}`);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(PORT, () => {
    console.error(`Simple MCP Server (Streamable HTTP) が http://localhost:${PORT} で起動しました`);
    console.error(`MCPエンドポイント: http://localhost:${PORT}/mcp`);
  });
}

main().catch((error) => {
  console.error("サーバーエラー:", error);
  process.exit(1);
});
