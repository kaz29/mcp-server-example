import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeploymentFrequencyTool } from './deployment-frequency.tool';

describe('DeploymentFrequencyTool', () => {
  let tool: DeploymentFrequencyTool;
  let mockDeploymentFrequencyService: any;

  // モックデータ
  const mockResult = {
    repository: 'owner/repo',
    period: 'week' as const,
    dateRange: {
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      to: new Date(),
    },
    totalDeployments: 10,
    deploymentsPerDay: 1.25, // 10 / 8 = 1.25
    deploymentDates: [
      new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // DeploymentFrequencyService のモック
    mockDeploymentFrequencyService = {
      calculate: vi.fn().mockResolvedValue(mockResult),
    };

    // ツールを直接インスタンス化
    tool = new DeploymentFrequencyTool(mockDeploymentFrequencyService as any);
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  describe('getDeploymentFrequency', () => {
    it('デプロイ頻度を取得できる', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
        period: 'week',
        method: 'release',
      });

      expect(mockDeploymentFrequencyService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'week',
        expect.objectContaining({ method: 'release' }),
      );
      expect(result).toContain('owner/repo');
      expect(result).toContain('総デプロイ数');
    });

    it('結果にパフォーマンスレベルが含まれる', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('パフォーマンスレベル');
      expect(result).toContain('Elite'); // deploymentsPerDay >= 1
    });

    it('デプロイ日時のリストが含まれる', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('最新のデプロイ');
    });

    it('デプロイが0件の場合のメッセージ', async () => {
      mockDeploymentFrequencyService.calculate.mockResolvedValue({
        ...mockResult,
        totalDeployments: 0,
        deploymentDates: [],
      });

      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('デプロイが見つかりませんでした');
    });

    it('デフォルト値が適用される', async () => {
      await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
      });

      expect(mockDeploymentFrequencyService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'month', // デフォルト
        expect.objectContaining({ method: 'workflow' }), // デフォルト
      );
    });

    it('workflowNameを指定できる', async () => {
      await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
        method: 'workflow',
        workflowName: 'Deploy to Production',
      });

      expect(mockDeploymentFrequencyService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'month',
        expect.objectContaining({
          method: 'workflow',
          workflowName: 'Deploy to Production',
        }),
      );
    });

    it('tagPrefixを指定できる', async () => {
      await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
        method: 'tag',
        tagPrefix: 'prodv',
      });

      expect(mockDeploymentFrequencyService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'month',
        expect.objectContaining({
          method: 'tag',
          tagPrefix: 'prodv',
        }),
      );
    });
  });

  describe('パフォーマンスレベル評価', () => {
    it('Elite: 1日に複数回（deploymentsPerDay >= 1）', async () => {
      mockDeploymentFrequencyService.calculate.mockResolvedValue({
        ...mockResult,
        deploymentsPerDay: 2.0,
      });

      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('⭐ Elite');
    });

    it('High: 週に1回以上（deploymentsPerDay >= 1/7）', async () => {
      mockDeploymentFrequencyService.calculate.mockResolvedValue({
        ...mockResult,
        deploymentsPerDay: 0.5, // 3.5回/週
      });

      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('🟢 High');
    });

    it('Medium: 月に1回以上（deploymentsPerDay >= 1/30）', async () => {
      mockDeploymentFrequencyService.calculate.mockResolvedValue({
        ...mockResult,
        deploymentsPerDay: 0.1, // 3回/月
      });

      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('🟡 Medium');
    });

    it('Low: 月に1回未満（deploymentsPerDay < 1/30）', async () => {
      mockDeploymentFrequencyService.calculate.mockResolvedValue({
        ...mockResult,
        deploymentsPerDay: 0.01, // 0.3回/月
      });

      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('🔴 Low');
    });
  });

  describe('期間ラベル', () => {
    it('day: 今日', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
        period: 'day',
      });

      expect(result).toContain('今日');
    });

    it('week: 過去7日間', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
        period: 'week',
      });

      expect(result).toContain('過去7日間');
    });

    it('month: 過去30日間', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
        period: 'month',
      });

      expect(result).toContain('過去30日間');
    });

    it('quarter: 過去3ヶ月', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
        period: 'quarter',
      });

      expect(result).toContain('過去3ヶ月');
    });

    it('year: 過去1年', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
        period: 'year',
      });

      expect(result).toContain('過去1年');
    });
  });

  describe('デプロイ検出方法ラベル', () => {
    it('workflow: GitHub Actions ワークフロー', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
        method: 'workflow',
      });

      expect(result).toContain('GitHub Actions ワークフロー');
    });

    it('release: GitHub Releases', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
        method: 'release',
      });

      expect(result).toContain('GitHub Releases');
    });

    it('tag: Git タグ', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
        method: 'tag',
      });

      expect(result).toContain('Git タグ');
    });
  });

  describe('フォーマット', () => {
    it('Markdown形式で結果を返す', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
      });

      // Markdownヘッダーが含まれる
      expect(result).toContain('##');
      expect(result).toContain('**');
      expect(result).toContain('###');
    });

    it('最新10件のデプロイのみ表示する', async () => {
      const manyDeployments = Array.from({ length: 20 }, (_, i) =>
        new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      );

      mockDeploymentFrequencyService.calculate.mockResolvedValue({
        ...mockResult,
        totalDeployments: 20,
        deploymentDates: manyDeployments,
      });

      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
      });

      // ISO形式の日付が含まれる（最大10件）
      const dateMatches = result.match(/\d{4}-\d{2}-\d{2}T/g);
      expect(dateMatches?.length).toBeLessThanOrEqual(10);
    });

    it('DORAパフォーマンスレベルの説明が含まれる', async () => {
      const result = await tool.getDeploymentFrequency({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('DORA パフォーマンスレベル');
      expect(result).toContain('Elite');
      expect(result).toContain('High');
      expect(result).toContain('Medium');
      expect(result).toContain('Low');
    });
  });
});
