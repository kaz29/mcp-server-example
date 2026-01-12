import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MTTRTool } from './mttr.tool';

describe('MTTRTool', () => {
  let tool: MTTRTool;
  let mockMTTRService: any;

  // モックデータ
  const mockResult = {
    repository: 'owner/repo',
    period: 'week' as const,
    dateRange: {
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      to: new Date(),
    },
    averageMTTRHours: 12.5, // 12.5時間
    medianMTTRHours: 10.0, // 10時間
    incidents: [
      {
        issueNumber: 123,
        title: 'Production outage',
        detectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 - 12 * 60 * 60 * 1000),
        mttrHours: 12.0,
      },
      {
        prNumber: 456,
        title: 'Hotfix: Fix critical bug',
        detectedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 14 * 60 * 60 * 1000),
        mttrHours: 10.0,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // MTTRService のモック
    mockMTTRService = {
      calculate: vi.fn().mockResolvedValue(mockResult),
    };

    // ツールを直接インスタンス化
    tool = new MTTRTool(mockMTTRService as any);
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  describe('getMTTR', () => {
    it('MTTRを取得できる', async () => {
      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
        period: 'week',
      });

      expect(mockMTTRService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'week',
        expect.any(Object),
      );
      expect(result).toContain('owner/repo');
      expect(result).toContain('平均MTTR');
    });

    it('結果にパフォーマンスレベルが含まれる', async () => {
      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('パフォーマンスレベル');
      expect(result).toContain('High'); // 12.5時間 < 24時間
    });

    it('インシデント一覧が含まれる', async () => {
      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('インシデント');
      expect(result).toContain('Issue #123');
      expect(result).toContain('PR #456');
      expect(result).toContain('Production outage');
    });

    it('インシデントが0件の場合のメッセージ', async () => {
      mockMTTRService.calculate.mockResolvedValue({
        ...mockResult,
        averageMTTRHours: 0,
        medianMTTRHours: 0,
        incidents: [],
      });

      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('インシデントは検出されませんでした');
    });

    it('デフォルト値が適用される', async () => {
      await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(mockMTTRService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'month', // デフォルト
        expect.any(Object),
      );
    });

    it('障害検出設定を指定できる', async () => {
      await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
        issueLabels: ['bug', 'incident'],
        prLabels: ['hotfix'],
        prBranchPattern: '^hotfix/',
      });

      expect(mockMTTRService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'month',
        expect.objectContaining({
          issueLabels: ['bug', 'incident'],
          prLabels: ['hotfix'],
          prBranchPattern: '^hotfix/',
        }),
      );
    });
  });

  describe('パフォーマンスレベル評価', () => {
    it('Elite: 1時間未満', async () => {
      mockMTTRService.calculate.mockResolvedValue({
        ...mockResult,
        averageMTTRHours: 0.5, // 30分
      });

      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('⭐ Elite');
    });

    it('High: 1日未満', async () => {
      mockMTTRService.calculate.mockResolvedValue({
        ...mockResult,
        averageMTTRHours: 12.0, // 12時間
      });

      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('🟢 High');
    });

    it('Medium: 1週間未満', async () => {
      mockMTTRService.calculate.mockResolvedValue({
        ...mockResult,
        averageMTTRHours: 72.0, // 3日
      });

      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('🟡 Medium');
    });

    it('Low: 1週間以上', async () => {
      mockMTTRService.calculate.mockResolvedValue({
        ...mockResult,
        averageMTTRHours: 200.0, // 8日以上
      });

      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('🔴 Low');
    });
  });

  describe('時間フォーマット', () => {
    it('24時間未満は時間のみ表示', async () => {
      mockMTTRService.calculate.mockResolvedValue({
        ...mockResult,
        averageMTTRHours: 18.5,
        medianMTTRHours: 15.0,
        incidents: [],
      });

      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('18時間');
      expect(result).toContain('15時間');
    });

    it('24時間以上は日数と時間を表示', async () => {
      mockMTTRService.calculate.mockResolvedValue({
        ...mockResult,
        averageMTTRHours: 50.0, // 2日2時間
        medianMTTRHours: 30.0, // 1日6時間
        incidents: [],
      });

      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('2日2時間');
      expect(result).toContain('1日6時間');
    });

    it('インシデント詳細で時間が正しくフォーマットされる', async () => {
      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      // 12時間と10時間
      expect(result).toContain('12時間');
      expect(result).toContain('10時間');
    });

    it('長時間のインシデントは日数表示される', async () => {
      mockMTTRService.calculate.mockResolvedValue({
        ...mockResult,
        incidents: [
          {
            issueNumber: 999,
            title: 'Long incident',
            detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            mttrHours: 72.0, // 3日
          },
        ],
      });

      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('3日0時間');
    });
  });

  describe('フォーマット', () => {
    it('Markdown形式で結果を返す', async () => {
      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      // Markdownヘッダーが含まれる
      expect(result).toContain('##');
      expect(result).toContain('**');
      expect(result).toContain('###');
    });

    it('統計値が表示される', async () => {
      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('平均MTTR');
      expect(result).toContain('中央値MTTR');
      expect(result).toContain('インシデント数');
    });

    it('最新10件のインシデントのみ表示する', async () => {
      const manyIncidents = Array.from({ length: 20 }, (_, i) => ({
        issueNumber: i + 1,
        title: `Incident ${i + 1}`,
        detectedAt: new Date(Date.now() - (i + 2) * 24 * 60 * 60 * 1000),
        resolvedAt: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
        mttrHours: 24.0,
      }));

      mockMTTRService.calculate.mockResolvedValue({
        ...mockResult,
        incidents: manyIncidents,
      });

      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      // Issue番号が含まれる（最大10件）
      const issueMatches = result.match(/Issue #\d+/g);
      expect(issueMatches?.length).toBeLessThanOrEqual(10);
    });

    it('インシデント詳細に検出日時と解決日時が含まれる', async () => {
      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('検出:');
      expect(result).toContain('解決:');
      expect(result).toContain('復旧時間:');
    });

    it('IssueベースとPRベースのインシデントが区別される', async () => {
      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('Issue #123');
      expect(result).toContain('PR #456');
    });

    it('DORAパフォーマンスレベルの説明が含まれる', async () => {
      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('DORA パフォーマンスレベル');
      expect(result).toContain('Elite: 1時間未満');
      expect(result).toContain('High: 1日未満');
      expect(result).toContain('Medium: 1週間未満');
      expect(result).toContain('Low: 1週間以上');
    });
  });

  describe('期間ラベル', () => {
    it('day: 今日', async () => {
      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
        period: 'day',
      });

      expect(result).toContain('今日');
    });

    it('week: 過去7日間', async () => {
      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
        period: 'week',
      });

      expect(result).toContain('過去7日間');
    });

    it('month: 過去30日間', async () => {
      const result = await tool.getMTTR({
        owner: 'owner',
        repo: 'repo',
        period: 'month',
      });

      expect(result).toContain('過去30日間');
    });
  });
});
