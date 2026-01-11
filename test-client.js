#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function testMCPServer() {
  console.log("MCPサーバーのテストを開始します...\n");

  try {
    // MCPクライアントを作成
    const client = new Client(
      {
        name: "test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    // Streamable HTTP トランスポートで接続
    console.log("サーバーに接続中...");
    const transport = new StreamableHTTPClientTransport(
      new URL("http://localhost:3000/mcp")
    );

    await client.connect(transport);
    console.log("✓ サーバーに接続しました\n");

    // ツールリストを取得
    console.log("利用可能なツールを取得中...");
    const toolsResult = await client.listTools();
    console.log("✓ ツールリスト取得成功:");
    toolsResult.tools.forEach((tool) => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log();

    // テスト1: get_current_time
    console.log("テスト1: get_current_time を実行");
    const timeResult = await client.callTool({
      name: "get_current_time",
      arguments: {},
    });
    console.log("✓ 結果:", timeResult.content[0].text);
    console.log();

    // テスト2: calculate (加算)
    console.log("テスト2: calculate (123 + 456) を実行");
    const calcResult = await client.callTool({
      name: "calculate",
      arguments: {
        operation: "add",
        a: 123,
        b: 456,
      },
    });
    console.log("✓ 結果:", calcResult.content[0].text);
    console.log();

    // テスト3: save_note
    console.log("テスト3: save_note を実行");
    const saveResult = await client.callTool({
      name: "save_note",
      arguments: {
        key: "test",
        value: "これはテストメモです",
      },
    });
    console.log("✓ 結果:", saveResult.content[0].text);
    console.log();

    // テスト4: get_note
    console.log("テスト4: get_note を実行");
    const getResult = await client.callTool({
      name: "get_note",
      arguments: {
        key: "test",
      },
    });
    console.log("✓ 結果:", getResult.content[0].text);
    console.log();

    // テスト5: list_notes
    console.log("テスト5: list_notes を実行");
    const listResult = await client.callTool({
      name: "list_notes",
      arguments: {},
    });
    console.log("✓ 結果:", listResult.content[0].text);
    console.log();

    // クリーンアップ
    await client.close();
    console.log("✓ 接続をクローズしました");
    console.log("\n✅ すべてのテストが成功しました！");
    process.exit(0);
  } catch (error) {
    console.error("❌ エラーが発生しました:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testMCPServer();
