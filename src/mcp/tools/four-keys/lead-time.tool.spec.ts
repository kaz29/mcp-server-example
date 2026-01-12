import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LeadTimeTool } from './lead-time.tool';

describe('LeadTimeTool', () => {
  let tool: LeadTimeTool;
  let mockLeadTimeService: any;

  // モックデータ
  const mockResult = {
    repository: 'owner/repo',
    period: 'week' as const,
    dateRange: {
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      to: new Date(),
    },
    averageLeadTimeHours: 48, // 2日
    medianLeadTimeHours: 36, // 1.5日
    p95LeadTimeHours: 96, // 4日
    samples: [
      {
        prNumber: 10,
        title: 'Feature A',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        mergedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        leadTimeHours: 48,
      },
      {
        prNumber: 11,
        title: 'Feature B',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        mergedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        leadTimeHours: 36,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // LeadTimeService のモック
    mockLeadTimeService = {
      calculate: vi.fn().mockResolvedValue(mockResult),
    };

    // ツールを直接インスタンス化
    tool = new LeadTimeTool(mockLeadTimeService as any);
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  describe('getLeadTime', () => {
    it('リードタイムを取得できる', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
        period: 'week',
      });

      expect(mockLeadTimeService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'week',
      );
      expect(result).toContain('owner/repo');
      expect(result).toContain('平均リードタイム');
    });

    it('結果にパフォーマンスレベルが含まれる', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('パフォーマンスレベル');
    });

    it('PR一覧が含まれる', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('最新のPR');
      expect(result).toContain('PR #10');
      expect(result).toContain('Feature A');
    });

    it('PRが0件の場合のメッセージ', async () => {
      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockResult,
        samples: [],
        averageLeadTimeHours: 0,
        medianLeadTimeHours: 0,
        p95LeadTimeHours: 0,
      });

      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('マージされたPRが見つかりませんでした');
    });

    it('デフォルト値が適用される', async () => {
      await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(mockLeadTimeService.calculate).toHaveBeenCalledWith(
        'owner',
        'repo',
        'month', // デフォルト
      );
    });
  });

  describe('パフォーマンスレベル評価', () => {
    it('Elite: 1日未満（< 24時間）', async () => {
      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockResult,
        averageLeadTimeHours: 12, // 12時間
      });

      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('⭐ Elite');
    });

    it('High: 1日〜1週間（24時間〜168時間）', async () => {
      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockResult,
        averageLeadTimeHours: 72, // 3日
      });

      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('🟢 High');
    });

    it('Medium: 1週間〜1ヶ月（168時間〜720時間）', async () => {
      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockResult,
        averageLeadTimeHours: 336, // 14日
      });

      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('🟡 Medium');
    });

    it('Low: 1ヶ月以上（>= 720時間）', async () => {
      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockResult,
        averageLeadTimeHours: 800, // 33日
      });

      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('🔴 Low');
    });
  });

  describe('時間フォーマット', () => {
    it('24時間未満は時間のみ表示', async () => {
      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockResult,
        averageLeadTimeHours: 18.5,
        samples: [],
      });

      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('18.5時間');
    });

    it('24時間以上は日数と時間を表示', async () => {
      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockResult,
        averageLeadTimeHours: 50.0, // 2日2時間
        samples: [],
      });

      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('2日2時間');
      expect(result).toContain('50.0時間');
    });

    it('PR詳細で時間が正しくフォーマットされる', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      // 48時間 = 2日0時間
      expect(result).toContain('2日0時間');
      // 36時間 = 1日12時間
      expect(result).toContain('1日12時間');
    });
  });

  describe('期間ラベル', () => {
    it('day: 今日', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
        period: 'day',
      });

      expect(result).toContain('今日');
    });

    it('week: 過去7日間', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
        period: 'week',
      });

      expect(result).toContain('過去7日間');
    });

    it('month: 過去30日間', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
        period: 'month',
      });

      expect(result).toContain('過去30日間');
    });

    it('quarter: 過去3ヶ月', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
        period: 'quarter',
      });

      expect(result).toContain('過去3ヶ月');
    });

    it('year: 過去1年', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
        period: 'year',
      });

      expect(result).toContain('過去1年');
    });
  });

  describe('フォーマット', () => {
    it('Markdown形式で結果を返す', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      // Markdownヘッダーが含まれる
      expect(result).toContain('##');
      expect(result).toContain('**');
      expect(result).toContain('###');
    });

    it('統計値が表示される', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('平均リードタイム');
      expect(result).toContain('中央値リードタイム');
      expect(result).toContain('95パーセンタイル');
      expect(result).toContain('サンプル数');
    });

    it('最新10件のPRのみ表示する', async () => {
      const manySamples = Array.from({ length: 20 }, (_, i) => ({
        prNumber: i + 1,
        title: `PR ${i + 1}`,
        createdAt: new Date(Date.now() - (i + 2) * 24 * 60 * 60 * 1000),
        mergedAt: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
        leadTimeHours: 24,
      }));

      mockLeadTimeService.calculate.mockResolvedValue({
        ...mockResult,
        samples: manySamples,
      });

      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      // PR番号が含まれる（最大10件）
      const prMatches = result.match(/PR #\d+/g);
      expect(prMatches?.length).toBeLessThanOrEqual(10);
    });

    it('PR詳細に作成日時とマージ日時が含まれる', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('作成:');
      expect(result).toContain('マージ:');
      expect(result).toContain('リードタイム:');
    });

    it('DORAパフォーマンスレベルの説明が含まれる', async () => {
      const result = await tool.getLeadTime({
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toContain('DORA パフォーマンスレベル');
      expect(result).toContain('Elite: 1日未満');
      expect(result).toContain('High: 1日〜1週間');
      expect(result).toContain('Medium: 1週間〜1ヶ月');
      expect(result).toContain('Low: 1ヶ月以上');
    });
  });
});
