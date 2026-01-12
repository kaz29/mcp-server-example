import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FourKeysSummaryTool } from './summary.tool';

describe('FourKeysSummaryTool', () => {
  let tool: FourKeysSummaryTool;
  let mockDeploymentFrequencyService: any;
  let mockLeadTimeService: any;
  let mockChangeFailureRateService: any;
  let mockMTTRService: any;

  // モックデータ
  const mockDeploymentFrequency = {
    repository: 'owner/repo',
    period: 'month' as const,
    dateRange: { from: new Date(), to: new Date() },
    totalDeployments: 30,
    deploymentsPerDay: 1.0,
    deploymentDates: [],
  };

  const mockLeadTime = {
    repository: 'owner/repo',
    period: 'month' as const,
    dateRange: { from: new Date(), to: new Date() },
    averageLeadTimeHours: 12.0,
    medianLeadTimeHours: 10.0,
    p95LeadTimeHours: 20.0,
    samples: [],
  };

  const mockChangeFailureRate = {
    repository: 'owner/repo',
    period: 'month' as const,
    dateRange: { from: new Date(), to: new Date() },
    totalDeployments: 30,
    failedDeployments: 3,
    failureRate: 10.0,
    failures: [],
  };

  const mockMTTR = {
    repository: 'owner/repo',
    period: 'month' as const,
    dateRange: { from: new Date(), to: new Date() },
    averageMTTRHours: 2.0,
    medianMTTRHours: 1.5,
    incidents: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // 各サービスのモック
    mockDeploymentFrequencyService = {
      calculate: vi.fn().mockResolvedValue(mockDeploymentFrequency),
    };

    mockLeadTimeService = {
      calculate: vi.fn().mockResolvedValue(mockLeadTime),
    };

    mockChangeFailureRateService = {
      calculate: vi.fn().mockResolvedValue(mockChangeFailureRate),
    };

    mockMTTRService = {
      calculate: vi.fn().mockResolvedValue(mockMTTR),
    };

    // ツールを直接インスタンス化
    tool = new FourKeysSummaryTool(
      mockDeploymentFrequencyService as any,
      mockLeadTimeService as any,
      mockChangeFailureRateService as any,
      mockMTTRService as any,
    );
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  describe('getFourKeysSummary', () => {
    it('Four Keysサマリーを取得できる', async () => {
      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('owner/repo');
      expect(result).toContain('Four Keys サマリー');
      expect(result).toContain('総合パフォーマンスレベル');
    });

    it('全4つのサービスが並列で呼ばれる', async () => {
      await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
        period: 'week',
      });

      expect(mockDeploymentFrequencyService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'week',
        expect.any(Object),
      );
      expect(mockLeadTimeService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'week',
      );
      expect(mockChangeFailureRateService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'week',
        expect.any(Object),
        expect.any(Object),
      );
      expect(mockMTTRService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'week',
        expect.any(Object),
      );
    });

    it('4つ全てのメトリクスが含まれる', async () => {
      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('デプロイ頻度');
      expect(result).toContain('リードタイム');
      expect(result).toContain('変更失敗率');
      expect(result).toContain('MTTR');
    });

    it('各メトリクスの値が表示される', async () => {
      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
      });

      // デプロイ頻度
      expect(result).toContain('1.00'); // deploymentsPerDay
      expect(result).toContain('30'); // totalDeployments

      // リードタイム
      expect(result).toContain('12.00'); // averageLeadTimeHours

      // 変更失敗率
      expect(result).toContain('10.00'); // failureRate

      // MTTR
      expect(result).toContain('2.00'); // averageMTTRHours
    });
  });

  describe('総合パフォーマンスレベル評価', () => {
    it('Elite: 全てEliteまたはHighで、Eliteが3つ以上', async () => {
      // deploymentsPerDay >= 1 (Elite)
      // leadTimeHours < 24 (Elite)
      // failureRate <= 15 (Elite)
      // mttrHours < 1 (Elite)
      mockDeploymentFrequencyService.calculate.mockResolvedValue({
        ...mockDeploymentFrequency,
        deploymentsPerDay: 2.0,
      });
      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockLeadTime,
        averageLeadTimeHours: 12.0,
      });
      mockChangeFailureRateService.calculate.mockResolvedValue({
        ...mockChangeFailureRate,
        failureRate: 10.0,
      });
      mockMTTRService.calculate.mockResolvedValue({
        ...mockMTTR,
        averageMTTRHours: 0.5,
      });

      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('総合パフォーマンスレベル**: ⭐ Elite');
    });

    it('High: 全てEliteまたはHighで、Eliteが3未満', async () => {
      mockDeploymentFrequencyService.calculate.mockResolvedValue({
        ...mockDeploymentFrequency,
        deploymentsPerDay: 2.0, // Elite
      });
      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockLeadTime,
        averageLeadTimeHours: 12.0, // Elite
      });
      mockChangeFailureRateService.calculate.mockResolvedValue({
        ...mockChangeFailureRate,
        failureRate: 20.0, // High
      });
      mockMTTRService.calculate.mockResolvedValue({
        ...mockMTTR,
        averageMTTRHours: 12.0, // High
      });

      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('総合パフォーマンスレベル**: 🟢 High');
    });

    it('Medium: Lowが1つ以下で、EliteまたはHighが4つ未満', async () => {
      mockDeploymentFrequencyService.calculate.mockResolvedValue({
        ...mockDeploymentFrequency,
        deploymentsPerDay: 0.5, // High
      });
      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockLeadTime,
        averageLeadTimeHours: 200.0, // Medium
      });
      mockChangeFailureRateService.calculate.mockResolvedValue({
        ...mockChangeFailureRate,
        failureRate: 40.0, // Medium
      });
      mockMTTRService.calculate.mockResolvedValue({
        ...mockMTTR,
        averageMTTRHours: 48.0, // Medium
      });

      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('総合パフォーマンスレベル**: 🟡 Medium');
    });

    it('Low: Lowが2つ以上', async () => {
      mockDeploymentFrequencyService.calculate.mockResolvedValue({
        ...mockDeploymentFrequency,
        deploymentsPerDay: 0.01, // Low
      });
      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockLeadTime,
        averageLeadTimeHours: 800.0, // Low
      });
      mockChangeFailureRateService.calculate.mockResolvedValue({
        ...mockChangeFailureRate,
        failureRate: 10.0, // Elite
      });
      mockMTTRService.calculate.mockResolvedValue({
        ...mockMTTR,
        averageMTTRHours: 2.0, // High
      });

      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('総合パフォーマンスレベル**: 🔴 Low');
    });
  });

  describe('フォーマット', () => {
    it('Markdown形式で結果を返す', async () => {
      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
      });

      // Markdownヘッダーが含まれる
      expect(result).toContain('#');
      expect(result).toContain('##');
      expect(result).toContain('**');
      expect(result).toContain('---');
    });

    it('各メトリクスがセクションで区切られている', async () => {
      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('## 1. デプロイ頻度');
      expect(result).toContain('## 2. リードタイム');
      expect(result).toContain('## 3. 変更失敗率');
      expect(result).toContain('## 4. MTTR');
    });

    it('DORAパフォーマンスレベル基準が含まれる', async () => {
      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('DORAパフォーマンスレベル基準');
      expect(result).toContain('Elite');
      expect(result).toContain('High');
      expect(result).toContain('Medium');
      expect(result).toContain('Low');
    });

    it('時間が読みやすくフォーマットされる', async () => {
      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockLeadTime,
        averageLeadTimeHours: 50.0, // 2日2時間
        medianLeadTimeHours: 30.0, // 1日6時間
      });

      mockMTTRService.calculate.mockResolvedValue({
        ...mockMTTR,
        averageMTTRHours: 25.0, // 1日1時間
      });

      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('2日2時間');
      expect(result).toContain('1日1時間');
    });
  });

  describe('期間ラベル', () => {
    it('day: 今日', async () => {
      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
        period: 'day',
      });

      expect(result).toContain('今日');
    });

    it('week: 過去7日間', async () => {
      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
        period: 'week',
      });

      expect(result).toContain('過去7日間');
    });

    it('month: 過去30日間', async () => {
      const result = await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
        period: 'month',
      });

      expect(result).toContain('過去30日間');
    });
  });

  describe('設定の引き渡し', () => {
    it('デプロイ検出設定が正しく渡される', async () => {
      await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
        deploymentMethod: 'tag',
        tagPrefix: 'prodv',
        workflowName: 'Deploy',
      });

      expect(mockDeploymentFrequencyService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'month',
        expect.objectContaining({
          method: 'tag',
          tagPrefix: 'prodv',
          workflowName: 'Deploy',
        }),
      );
    });

    it('障害検出設定が正しく渡される', async () => {
      await tool.getFourKeysSummary({
        owner: 'owner',
        repo: 'repo',
        issueLabels: ['bug'],
        prLabels: ['hotfix'],
        detectWorkflowFailures: true,
      });

      expect(mockChangeFailureRateService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'month',
        expect.any(Object),
        expect.objectContaining({
          issueLabels: ['bug'],
          prLabels: ['hotfix'],
          detectWorkflowFailures: true,
        }),
      );

      expect(mockMTTRService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'month',
        expect.objectContaining({
          issueLabels: ['bug'],
          prLabels: ['hotfix'],
        }),
      );
    });
  });
});
