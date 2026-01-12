import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AppModule } from '../../src/app.module';

describe('MCP Tools Integration Test', () => {
  let app: INestApplication;
  let client: Client;
  let transport: StreamableHTTPClientTransport;

  beforeAll(async () => {
    // NestJSアプリケーションの起動
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // 将来的に外部APIサービスをモックする場合はここで.overrideProvider()を使用
      // .overrideProvider(ExternalApiService)
      // .useValue({ fetchData: vi.fn().mockResolvedValue({ data: 'mocked' }) })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // アプリケーションが起動したポートを取得
    await app.listen(0); // ポート0で自動的に空きポートを割り当て
    const server = app.getHttpServer();
    const address = server.address();
    const port = typeof address === 'string' ? 3000 : address?.port || 3000;

    // MCP Clientの初期化
    transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${port}/mcp`),
    );

    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      { capabilities: {} },
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
    if (app) {
      await app.close();
    }
  });

  describe('get_current_time', () => {
    it('should return current time', async () => {
      const result = await client.callTool({
        name: 'get_current_time',
        arguments: {},
      });

      expect(result.content).toBeDefined();
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('現在の日時');
      expect(result.content[0].text).toMatch(/\d{4}\/\d{1,2}\/\d{1,2}/);
    });
  });

  describe('calculate', () => {
    it('should perform addition', async () => {
      const result = await client.callTool({
        name: 'calculate',
        arguments: {
          operation: 'add',
          a: 123,
          b: 456,
        },
      });

      expect(result.content[0].text).toBe('加算: 123 + 456 = 579');
    });

    it('should perform subtraction', async () => {
      const result = await client.callTool({
        name: 'calculate',
        arguments: {
          operation: 'subtract',
          a: 100,
          b: 25,
        },
      });

      expect(result.content[0].text).toBe('減算: 100 - 25 = 75');
    });

    it('should perform multiplication', async () => {
      const result = await client.callTool({
        name: 'calculate',
        arguments: {
          operation: 'multiply',
          a: 12,
          b: 5,
        },
      });

      expect(result.content[0].text).toBe('乗算: 12 × 5 = 60');
    });

    it('should perform division', async () => {
      const result = await client.callTool({
        name: 'calculate',
        arguments: {
          operation: 'divide',
          a: 100,
          b: 4,
        },
      });

      expect(result.content[0].text).toBe('除算: 100 ÷ 4 = 25');
    });

    it('should handle division by zero error', async () => {
      await expect(
        client.callTool({
          name: 'calculate',
          arguments: {
            operation: 'divide',
            a: 10,
            b: 0,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('notes operations', () => {
    it('should save and retrieve a note', async () => {
      // 保存
      const saveResult = await client.callTool({
        name: 'save_note',
        arguments: {
          key: 'integration-test-key',
          value: 'integration-test-value',
        },
      });

      expect(saveResult.content[0].text).toBe('メモを保存しました: integration-test-key');

      // 取得
      const getResult = await client.callTool({
        name: 'get_note',
        arguments: {
          key: 'integration-test-key',
        },
      });

      expect(getResult.content[0].text).toBe('integration-test-key: integration-test-value');
    });

    it('should return not found message for non-existing note', async () => {
      const result = await client.callTool({
        name: 'get_note',
        arguments: {
          key: 'non-existing-key',
        },
      });

      expect(result.content[0].text).toBe('メモが見つかりません: non-existing-key');
    });

    it('should list all saved notes', async () => {
      // 複数のメモを保存
      await client.callTool({
        name: 'save_note',
        arguments: { key: 'note1', value: 'value1' },
      });
      await client.callTool({
        name: 'save_note',
        arguments: { key: 'note2', value: 'value2' },
      });

      // リスト取得
      const result = await client.callTool({
        name: 'list_notes',
        arguments: {},
      });

      expect(result.content[0].text).toContain('保存されているメモのキー');
      expect(result.content[0].text).toContain('note1');
      expect(result.content[0].text).toContain('note2');
    });
  });

  describe('tools list', () => {
    it('should list all available tools', async () => {
      const tools = await client.listTools();

      expect(tools.tools).toHaveLength(5);

      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).toContain('get_current_time');
      expect(toolNames).toContain('calculate');
      expect(toolNames).toContain('save_note');
      expect(toolNames).toContain('get_note');
      expect(toolNames).toContain('list_notes');
    });
  });
});
