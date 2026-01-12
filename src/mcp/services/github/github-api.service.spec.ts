import { Test, TestingModule } from '@nestjs/testing';
import { GitHubApiService } from './github-api.service';
import { GitHubAuthService } from './github-auth.service';

describe('GitHubApiService', () => {
  let service: GitHubApiService;

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
      providers: [GitHubApiService, GitHubAuthService],
    }).compile();

    service = module.get<GitHubApiService>(GitHubApiService);
  });

  it('should be defined', () => {
    if (skipIfNoConfig()) {
      console.log('⚠ GitHub App の環境変数が設定されていないためスキップ');
      return;
    }
    expect(service).toBeDefined();
  });

  it('Octokit インスタンスを取得できる', async () => {
    if (skipIfNoConfig()) {
      console.log('⚠ GitHub App の環境変数が設定されていないためスキップ');
      return;
    }

    const octokit = await service.getOctokit();
    expect(octokit).toBeDefined();
  });

  // 実際のリポジトリを使ったテストは統合テストで実施
  // ここでは基本的な動作のみをテスト
});
