import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubAuthService } from './github-auth.service';
import * as fs from 'fs';

// createAppAuth のモック
vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(() => {
    return vi.fn(async () => ({
      token: 'ghs_mock_installation_token_123456',
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1時間後
    }));
  }),
}));

// fs.readFileSync のモック
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    readFileSync: vi.fn(() => '-----BEGIN RSA PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END RSA PRIVATE KEY-----'),
    existsSync: vi.fn(() => true),
  };
});

describe('GitHubAuthService', () => {
  let service: GitHubAuthService;

  beforeEach(async () => {
    // 環境変数をモック
    process.env.GITHUB_APP_ID = '123456';
    process.env.GITHUB_INSTALLATION_ID = '78901234';
    process.env.GITHUB_PRIVATE_KEY_PATH = './config/mock-key.pem';

    // サービスをインスタンス化
    service = new GitHubAuthService();

    // onModuleInit を手動で呼び出し
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('Installation Token を取得できる', async () => {
    const token = await service.getInstallationToken();

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token).toBe('ghs_mock_installation_token_123456');
  });

  it('キャッシュされたトークンを返す', async () => {
    const token1 = await service.getInstallationToken();
    const token2 = await service.getInstallationToken();

    // 同じトークンが返されることを確認
    expect(token1).toBe(token2);
    expect(token1).toBe('ghs_mock_installation_token_123456');
  });

  it('設定を取得できる', () => {
    const config = service.getConfig();

    expect(config.appId).toBe(123456);
    expect(config.installationId).toBe(78901234);
    expect(config.privateKey).toContain('MOCK_PRIVATE_KEY');
  });

  it('秘密鍵ファイルが読み込まれる', () => {
    const config = service.getConfig();

    expect(fs.readFileSync).toHaveBeenCalled();
    expect(config.privateKey).toBeDefined();
  });

  it('環境変数から設定を読み込む', () => {
    const config = service.getConfig();

    expect(config.appId).toBe(parseInt(process.env.GITHUB_APP_ID!));
    expect(config.installationId).toBe(parseInt(process.env.GITHUB_INSTALLATION_ID!));
  });

  it('環境変数で秘密鍵を直接指定できる', async () => {
    // 秘密鍵を環境変数で指定
    delete process.env.GITHUB_PRIVATE_KEY_PATH;
    process.env.GITHUB_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\\nENV_MOCK_KEY\\n-----END RSA PRIVATE KEY-----';

    const newService = new GitHubAuthService();
    await newService.onModuleInit();

    const config = newService.getConfig();
    expect(config.privateKey).toContain('ENV_MOCK_KEY');
  });

  it('BaseURLを設定できる', async () => {
    process.env.GITHUB_BASE_URL = 'https://github.enterprise.com/api/v3';

    const newService = new GitHubAuthService();
    await newService.onModuleInit();

    const config = newService.getConfig();
    expect(config.baseUrl).toBe('https://github.enterprise.com/api/v3');
  });
});
