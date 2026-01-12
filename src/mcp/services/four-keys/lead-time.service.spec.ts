import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LeadTimeService } from './lead-time.service';

describe('LeadTimeService', () => {
  let service: LeadTimeService;
  let mockGitHubApiService: any;

  // モックデータ - マージされたPR
  const mockMergedPRs = [
    {
      id: 1,
      number: 10,
      title: 'Feature A',
      state: 'closed',
      draft: false,
      created_at: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(), // 4日前
      merged_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2日前
    },
    {
      id: 2,
      number: 11,
      title: 'Feature B',
      state: 'closed',
      draft: false,
      created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 3日前
      merged_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1日前
    },
    {
      id: 3,
      number: 12,
      title: 'Draft PR',
      state: 'closed',
      draft: true, // ドラフトPRは除外される
      created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      merged_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 4,
      number: 13,
      title: 'Quick Fix',
      state: 'closed',
      draft: false,
      created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12時間前
      merged_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6時間前
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // GitHubApiService のモック
    mockGitHubApiService = {
      listMergedPullRequests: vi.fn().mockResolvedValue(mockMergedPRs),
    };

    // サービスを直接インスタンス化
    service = new LeadTimeService(mockGitHubApiService as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculate', () => {
    it('リードタイムを計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'week');

      expect(result.repository).toBe('owner/repo');
      expect(result.period).toBe('week');
      expect(result.averageLeadTimeHours).toBeGreaterThan(0);
      expect(result.medianLeadTimeHours).toBeGreaterThan(0);
      expect(result.p95LeadTimeHours).toBeGreaterThan(0);
      expect(result.samples.length).toBe(3); // ドラフトPRを除く3件
      expect(mockGitHubApiService.listMergedPullRequests).toHaveBeenCalled();
    });

    it('ドラフトPRを除外する', async () => {
      const result = await service.calculate('owner', 'repo', 'week');

      // ドラフトPR (number: 12) が除外されていることを確認
      const prNumbers = result.samples.map(s => s.prNumber);
      expect(prNumbers).not.toContain(12);
      expect(prNumbers).toContain(10);
      expect(prNumbers).toContain(11);
      expect(prNumbers).toContain(13);
    });

    it('リードタイムが正しく計算される', async () => {
      // モックデータの期待値:
      // PR#10: 96h - 48h = 48h
      // PR#11: 72h - 24h = 48h
      // PR#13: 12h - 6h = 6h
      // 平均: (48 + 48 + 6) / 3 = 34h

      const result = await service.calculate('owner', 'repo', 'week');

      expect(result.averageLeadTimeHours).toBeCloseTo(34, 0);
      expect(result.medianLeadTimeHours).toBe(48); // 中央値は48
    });

    it('PRが0件の場合', async () => {
      mockGitHubApiService.listMergedPullRequests.mockResolvedValue([]);

      const result = await service.calculate('owner', 'repo', 'week');

      expect(result.averageLeadTimeHours).toBe(0);
      expect(result.medianLeadTimeHours).toBe(0);
      expect(result.p95LeadTimeHours).toBe(0);
      expect(result.samples).toHaveLength(0);
    });

    it('異なる期間で計算できる', async () => {
      const periods: Array<'day' | 'week' | 'month' | 'quarter' | 'year'> = [
        'day',
        'week',
        'month',
        'quarter',
        'year',
      ];

      for (const period of periods) {
        const result = await service.calculate('owner', 'repo', period);
        expect(result.period).toBe(period);
        expect(result.dateRange).toBeDefined();
      }
    });
  });

  describe('統計計算', () => {
    it('中央値を正しく計算する（奇数個）', async () => {
      const oddNumberPRs = [
        {
          id: 1,
          number: 1,
          title: 'PR 1',
          state: 'closed',
          draft: false,
          created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
          merged_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5h
        },
        {
          id: 2,
          number: 2,
          title: 'PR 2',
          state: 'closed',
          draft: false,
          created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
          merged_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 10h
        },
        {
          id: 3,
          number: 3,
          title: 'PR 3',
          state: 'closed',
          draft: false,
          created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
          merged_at: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(), // 15h
        },
      ];

      mockGitHubApiService.listMergedPullRequests.mockResolvedValue(oddNumberPRs);

      const result = await service.calculate('owner', 'repo', 'week');

      // 5h, 10h, 15h の中央値は 10h
      expect(result.medianLeadTimeHours).toBe(10);
    });

    it('中央値を正しく計算する（偶数個）', async () => {
      const evenNumberPRs = [
        {
          id: 1,
          number: 1,
          title: 'PR 1',
          state: 'closed',
          draft: false,
          created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
          merged_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5h
        },
        {
          id: 2,
          number: 2,
          title: 'PR 2',
          state: 'closed',
          draft: false,
          created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
          merged_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 10h
        },
        {
          id: 3,
          number: 3,
          title: 'PR 3',
          state: 'closed',
          draft: false,
          created_at: new Date(Date.now() - 35 * 60 * 60 * 1000).toISOString(),
          merged_at: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(), // 20h
        },
        {
          id: 4,
          number: 4,
          title: 'PR 4',
          state: 'closed',
          draft: false,
          created_at: new Date(Date.now() - 55 * 60 * 60 * 1000).toISOString(),
          merged_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), // 35h
        },
      ];

      mockGitHubApiService.listMergedPullRequests.mockResolvedValue(evenNumberPRs);

      const result = await service.calculate('owner', 'repo', 'week');

      // 5h, 10h, 20h, 35h の中央値は (10 + 20) / 2 = 15h
      expect(result.medianLeadTimeHours).toBe(15);
    });

    it('95パーセンタイルを計算する', async () => {
      const result = await service.calculate('owner', 'repo', 'week');

      expect(result.p95LeadTimeHours).toBeGreaterThan(0);
      expect(result.p95LeadTimeHours).toBeGreaterThanOrEqual(result.medianLeadTimeHours);
    });
  });

  describe('edge cases', () => {
    it('リードタイムが負の値のPRをスキップする', async () => {
      const invalidPRs = [
        {
          id: 1,
          number: 1,
          title: 'Invalid PR',
          state: 'closed',
          draft: false,
          created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
          merged_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), // マージ日時が作成日時より前（異常データ）
        },
        {
          id: 2,
          number: 2,
          title: 'Valid PR',
          state: 'closed',
          draft: false,
          created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
          merged_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 10h
        },
      ];

      mockGitHubApiService.listMergedPullRequests.mockResolvedValue(invalidPRs);

      const result = await service.calculate('owner', 'repo', 'week');

      // 異常データは除外され、有効なPRのみがカウントされる
      expect(result.samples.length).toBe(1);
      expect(result.samples[0].prNumber).toBe(2);
    });

    it('最新20件のみ返す', async () => {
      const manyPRs = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        number: i + 1,
        title: `PR ${i + 1}`,
        state: 'closed',
        draft: false,
        created_at: new Date(Date.now() - (100 - i) * 60 * 60 * 1000).toISOString(),
        merged_at: new Date(Date.now() - (50 - i) * 60 * 60 * 1000).toISOString(),
      }));

      mockGitHubApiService.listMergedPullRequests.mockResolvedValue(manyPRs);

      const result = await service.calculate('owner', 'repo', 'month');

      // samplesは最新20件のみ
      expect(result.samples.length).toBe(20);
      // 平均値などは全50件から計算される
      expect(result.averageLeadTimeHours).toBeGreaterThan(0);
    });
  });
});
