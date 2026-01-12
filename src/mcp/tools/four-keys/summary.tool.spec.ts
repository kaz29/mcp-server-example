import { Test, TestingModule } from '@nestjs/testing';
import { FourKeysSummaryTool } from './summary.tool';
import { DeploymentFrequencyService } from '../../services/four-keys/deployment-frequency.service';
import { LeadTimeService } from '../../services/four-keys/lead-time.service';
import { ChangeFailureRateService } from '../../services/four-keys/change-failure-rate.service';
import { MTTRService } from '../../services/four-keys/mttr.service';
import { GitHubApiService } from '../../services/github/github-api.service';
import { GitHubAuthService } from '../../services/github/github-auth.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('FourKeysSummaryTool', () => {
  let tool: FourKeysSummaryTool;

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
        FourKeysSummaryTool,
        DeploymentFrequencyService,
        LeadTimeService,
        ChangeFailureRateService,
        MTTRService,
        GitHubApiService,
        GitHubAuthService,
      ],
    }).compile();

    tool = module.get<FourKeysSummaryTool>(FourKeysSummaryTool);
  });

  it('should be defined', () => {
    if (skipIfNoConfig()) {
      console.log('⚠ GitHub App の環境変数が設定されていないためスキップ');
      return;
    }
    expect(tool).toBeDefined();
  });

  // 実際のリポジトリを使ったテストは統合テストで実施
});
