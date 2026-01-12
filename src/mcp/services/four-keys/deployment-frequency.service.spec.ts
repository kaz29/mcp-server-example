import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentFrequencyService } from './deployment-frequency.service';
import { GitHubApiService } from '../github/github-api.service';
import { GitHubAuthService } from '../github/github-auth.service';

describe('DeploymentFrequencyService', () => {
  let service: DeploymentFrequencyService;

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
      providers: [
        DeploymentFrequencyService,
        GitHubApiService,
        GitHubAuthService,
      ],
    }).compile();

    service = module.get<DeploymentFrequencyService>(
      DeploymentFrequencyService,
    );
  });

  it('should be defined', () => {
    if (skipIfNoConfig()) {
      console.log('⚠ GitHub App の環境変数が設定されていないためスキップ');
      return;
    }
    expect(service).toBeDefined();
  });

  // 実際のリポジトリを使ったテストは統合テストで実施
});
