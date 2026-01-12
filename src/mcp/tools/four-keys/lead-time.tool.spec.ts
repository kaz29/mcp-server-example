import { describe, it, expect, beforeEach } from 'vitest';
import { LeadTimeTool } from './lead-time.tool';
import { LeadTimeService } from '../../services/four-keys/lead-time.service';

describe('LeadTimeTool', () => {
  let tool: LeadTimeTool;
  let service: LeadTimeService;

  beforeEach(() => {
    // GitHub API の環境変数が設定されていない場合はスキップ
    if (!process.env.GITHUB_APP_ID) {
      console.warn('⚠ GitHub App の環境変数が設定されていないためスキップ');
      return;
    }

    // 実際のサービスをインスタンス化（統合テスト）
    // 単体テストの場合は LeadTimeService をモック化する
  });

  it('should be defined', () => {
    if (!process.env.GITHUB_APP_ID) {
      console.warn('⚠ GitHub App の環境変数が設定されていないためスキップ');
      return;
    }

    expect(LeadTimeTool).toBeDefined();
  });
});
