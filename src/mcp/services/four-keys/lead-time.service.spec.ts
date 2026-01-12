import { describe, it, expect, beforeEach } from 'vitest';
import { LeadTimeService } from './lead-time.service';
import { GitHubApiService } from '../github/github-api.service';

describe('LeadTimeService', () => {
  let service: LeadTimeService;
  let githubApiService: GitHubApiService;

  beforeEach(() => {
    // GitHub API の環境変数が設定されていない場合はスキップ
    if (!process.env.GITHUB_APP_ID) {
      console.warn('⚠ GitHub App の環境変数が設定されていないためスキップ');
      return;
    }

    // 実際のサービスをインスタンス化（統合テスト）
    // 単体テストの場合は GitHubApiService をモック化する
  });

  it('should be defined', () => {
    if (!process.env.GITHUB_APP_ID) {
      console.warn('⚠ GitHub App の環境変数が設定されていないためスキップ');
      return;
    }

    expect(LeadTimeService).toBeDefined();
  });
});
