import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeFailureRateTool } from './change-failure-rate.tool';

describe('ChangeFailureRateTool', () => {
  let tool: ChangeFailureRateTool;
  let mockChangeFailureRateService: any;

  // モックデータ
  const mockResult = {
    repository: 'owner/repo',
    period: 'week' as const,
    dateRange: {
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      to: new Date(),
    },
    totalDeployments: 10,
    failedDeployments: 2,
    failureRate: 20.0,
    failures: [
      {
        type: 'hotfix_pr' as const,
        identifier: '#123',
        title: 'Hotfix: Fix critical bug',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        type: 'incident_issue' as const,
        identifier: '#456',
        title: 'Production outage',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // ChangeFailureRateService のモック
    mockChangeFailureRateService = {
      calculate: vi.fn().mockResolvedValue(mockResult),
    };

    // ツールを直接インスタンス化
    tool = new ChangeFailureRateTool(mockChangeFailureRateService as any);
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  describe('getChangeFailureRate', () => {
    it('変更失敗率を取得できる', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
        period: 'week',
      });

      expect(mockChangeFailureRateService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'week',
        expect.objectContaining({ method: 'release' }),
        expect.any(Object),
      );
      expect(result).toContain('owner/repo');
      expect(result).toContain('変更失敗率');
    });

    it('結果にパフォーマンスレベルが含まれる', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('パフォーマンスレベル');
      expect(result).toContain('High'); // 20%
    });

    it('障害一覧が含まれる', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('検出された障害');
      expect(result).toContain('#123');
      expect(result).toContain('Hotfix: Fix critical bug');
    });

    it('障害が0件の場合のメッセージ', async () => {
      mockChangeFailureRateService.calculate.mockResolvedValue({
        ...mockResult,
        failedDeployments: 0,
        failureRate: 0,
        failures: [],
      });

      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('障害は検出されませんでした');
    });

    it('デフォルト値が適用される', async () => {
      await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(mockChangeFailureRateService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'month', // デフォルト
        expect.objectContaining({ method: 'release' }), // デフォルト
        expect.objectContaining({ detectWorkflowFailures: false }), // デフォルト
      );
    });

    it('障害検出設定を指定できる', async () => {
      await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
        issueLabels: ['bug', 'incident'],
        prLabels: ['hotfix'],
        prBranchPattern: '^hotfix/',
        detectWorkflowFailures: true,
      });

      expect(mockChangeFailureRateService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'month',
        expect.any(Object),
        expect.objectContaining({
          issueLabels: ['bug', 'incident'],
          prLabels: ['hotfix'],
          prBranchPattern: '^hotfix/',
          detectWorkflowFailures: true,
        }),
      );
    });
  });

  describe('パフォーマンスレベル評価', () => {
    it('Elite: 0-15%', async () => {
      mockChangeFailureRateService.calculate.mockResolvedValue({
        ...mockResult,
        failureRate: 10.0,
      });

      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('⭐ Elite');
    });

    it('High: 16-30%', async () => {
      mockChangeFailureRateService.calculate.mockResolvedValue({
        ...mockResult,
        failureRate: 25.0,
      });

      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('🟢 High');
    });

    it('Medium: 31-45%', async () => {
      mockChangeFailureRateService.calculate.mockResolvedValue({
        ...mockResult,
        failureRate: 40.0,
      });

      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('🟡 Medium');
    });

    it('Low: 46%以上', async () => {
      mockChangeFailureRateService.calculate.mockResolvedValue({
        ...mockResult,
        failureRate: 60.0,
      });

      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('🔴 Low');
    });
  });

  describe('障害タイプラベル', () => {
    it('ホットフィックスPR', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('ホットフィックスPR');
    });

    it('インシデントIssue', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('インシデントIssue');
    });

    it('ワークフロー失敗', async () => {
      mockChangeFailureRateService.calculate.mockResolvedValue({
        ...mockResult,
        failures: [
          {
            type: 'workflow_failure' as const,
            identifier: 'Run #789',
            title: 'Deploy to Production',
            date: new Date(),
          },
        ],
      });

      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('ワークフロー失敗');
    });
  });

  describe('フォーマット', () => {
    it('Markdown形式で結果を返す', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      // Markdownヘッダーが含まれる
      expect(result).toContain('##');
      expect(result).toContain('**');
      expect(result).toContain('###');
    });

    it('統計値が表示される', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('総デプロイ数');
      expect(result).toContain('失敗したデプロイ数');
      expect(result).toContain('変更失敗率');
    });

    it('最新10件の障害のみ表示する', async () => {
      const manyFailures = Array.from({ length: 20 }, (_, i) => ({
        type: 'hotfix_pr' as const,
        identifier: `#${i + 1}`,
        title: `Hotfix ${i + 1}`,
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      }));

      mockChangeFailureRateService.calculate.mockResolvedValue({
        ...mockResult,
        failedDeployments: 20,
        failures: manyFailures,
      });

      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      // 障害IDが含まれる（最大10件）
      const failureMatches = result.match(/#\d+/g);
      expect(failureMatches?.length).toBeLessThanOrEqual(10);
    });

    it('障害詳細に発生日時が含まれる', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('発生日時:');
    });

    it('DORAパフォーマンスレベルの説明が含まれる', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('DORA パフォーマンスレベル');
      expect(result).toContain('Elite: 0-15%');
      expect(result).toContain('High: 16-30%');
      expect(result).toContain('Medium: 31-45%');
      expect(result).toContain('Low: 46%以上');
    });
  });

  describe('期間ラベル', () => {
    it('day: 今日', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
        period: 'day',
      });

      expect(result).toContain('今日');
    });

    it('week: 過去7日間', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
        period: 'week',
      });

      expect(result).toContain('過去7日間');
    });

    it('month: 過去30日間', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
        period: 'month',
      });

      expect(result).toContain('過去30日間');
    });
  });

  describe('デプロイ検出方法ラベル', () => {
    it('workflow: GitHub Actions ワークフロー', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
        deploymentMethod: 'workflow',
      });

      expect(result).toContain('GitHub Actions ワークフロー');
    });

    it('release: GitHub Releases', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
        deploymentMethod: 'release',
      });

      expect(result).toContain('GitHub Releases');
    });

    it('tag: Git タグ', async () => {
      const result = await tool.getChangeFailureRate({
        owner: 'owner',
        repo: 'repo',
        deploymentMethod: 'tag',
      });

      expect(result).toContain('Git タグ');
    });
  });
});
