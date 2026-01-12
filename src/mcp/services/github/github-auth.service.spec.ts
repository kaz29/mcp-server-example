import { Test, TestingModule } from '@nestjs/testing';
import { GitHubAuthService } from './github-auth.service';

describe('GitHubAuthService', () => {
  let service: GitHubAuthService;

  // 環境変数が設定されていない場合はスキップ
  const skipIfNoConfig = () => {
    if (
      !process.env.GITHUB_APP_ID ||
      !process.env.GITHUB_INSTALLATION_ID ||
      (!process.env.GITHUB_PRIVATE_KEY_PATH && !process.env.GITHUB_PRIVATE_KEY)
    ) {
      return true;
    }
    return false;
  };

  beforeEach(async () => {
    if (skipIfNoConfig()) {
      return;
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [GitHubAuthService],
    }).compile();

    service = module.get<GitHubAuthService>(GitHubAuthService);
  });

  it('should be defined', () => {
    if (skipIfNoConfig()) {
      console.log('⚠ GitHub App の環境変数が設定されていないためスキップ');
      return;
    }
    expect(service).toBeDefined();
  });

  it('Installation Token を取得できる', async () => {
    if (skipIfNoConfig()) {
      console.log('⚠ GitHub App の環境変数が設定されていないためスキップ');
      return;
    }

    const token = await service.getInstallationToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('キャッシュされたトークンを返す', async () => {
    if (skipIfNoConfig()) {
      console.log('⚠ GitHub App の環境変数が設定されていないためスキップ');
      return;
    }

    const token1 = await service.getInstallationToken();
    const token2 = await service.getInstallationToken();

    // 同じトークンが返されることを確認
    expect(token1).toBe(token2);
  });

  it('設定を取得できる', () => {
    if (skipIfNoConfig()) {
      console.log('⚠ GitHub App の環境変数が設定されていないためスキップ');
      return;
    }

    const config = service.getConfig();
    expect(config.appId).toBeDefined();
    expect(config.installationId).toBeDefined();
    expect(config.privateKey).toBeDefined();
  });
});
