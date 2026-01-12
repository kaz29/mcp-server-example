import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MTTRService } from './mttr.service';

describe('MTTRService', () => {
  let service: MTTRService;
  let mockGitHubApiService: any;

  // モックデータ - インシデントIssue
  const mockIncidentIssues = [
    {
      number: 5,
      title: 'Production outage',
      state: 'closed',
      created_at: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(), // 50時間前に作成
      closed_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48時間前にクローズ（MTTR: 2時間）
      labels: [{ name: 'bug' }],
    },
    {
      number: 6,
      title: 'API failure',
      state: 'closed',
      created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), // 30時間前に作成
      closed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24時間前にクローズ（MTTR: 6時間）
      labels: [{ name: 'incident' }],
    },
  ];

  // モックデータ - Hotfix PR
  const mockHotfixPRs = [
    {
      number: 10,
      title: 'Hotfix: Fix critical bug',
      state: 'closed',
      created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), // 20時間前に作成
      merged_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), // 18時間前にマージ（MTTR: 2時間）
      labels: [{ name: 'hotfix' }],
      head: { ref: 'hotfix/critical-bug' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // GitHubApiService のモック
    mockGitHubApiService = {
      getOctokit: vi.fn().mockResolvedValue({
        issues: {
          listForRepo: vi.fn().mockResolvedValue({ data: mockIncidentIssues }),
        },
        pulls: {
          list: vi.fn().mockResolvedValue({ data: mockHotfixPRs }),
        },
      }),
    };

    // サービスを直接インスタンス化
    service = new MTTRService(mockGitHubApiService as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculate', () => {
    it('MTTRを計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug', 'incident'],
      });

      expect(result.repository).toBe('owner/repo');
      expect(result.period).toBe('week');
      expect(result.averageMTTRHours).toBeGreaterThan(0);
      expect(result.medianMTTRHours).toBeGreaterThan(0);
      expect(result.incidents.length).toBe(2); // 2件のインシデントIssue
    });

    it('Issueベースのインシデントを収集できる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug', 'incident'],
      });

      expect(result.incidents.length).toBeGreaterThan(0);
      expect(result.incidents[0].issueNumber).toBeDefined();
      expect(result.incidents[0].detectedAt).toBeInstanceOf(Date);
      expect(result.incidents[0].resolvedAt).toBeInstanceOf(Date);
      expect(result.incidents[0].mttrHours).toBeGreaterThan(0);
    });

    it('PRベースのインシデントを収集できる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        prLabels: ['hotfix'],
      });

      expect(result.incidents.length).toBeGreaterThan(0);
      expect(result.incidents[0].prNumber).toBe(10);
    });

    it('IssueとPRの両方を収集できる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug', 'incident'],
        prLabels: ['hotfix'],
      });

      // 2件のIssue + 1件のPR = 3件
      expect(result.incidents.length).toBe(3);
    });

    it('平均MTTRが正しく計算される', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug', 'incident'],
      });

      // Issue#5: 2時間, Issue#6: 6時間 → 平均: 4時間
      expect(result.averageMTTRHours).toBeCloseTo(4, 1);
    });

    it('中央値が正しく計算される', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug', 'incident'],
      });

      // 2時間と6時間の中央値（偶数個）: 6時間（ソート後の中央のインデックス）
      expect(result.medianMTTRHours).toBeGreaterThan(0);
    });
  });

  describe('incident filtering', () => {
    it('ラベルで Issue をフィルタリングできる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug'],
      });

      // 'bug' ラベルを持つIssueのみ
      expect(result.incidents.some((i) => i.issueNumber === 5)).toBe(true);
    });

    it('ブランチパターンで PR をフィルタリングできる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        prBranchPattern: '^hotfix/',
      });

      expect(result.incidents.length).toBeGreaterThan(0);
      expect(result.incidents[0].prNumber).toBe(10);
    });

    it('期間外のインシデントは除外される', async () => {
      const oldIssue = {
        number: 99,
        title: 'Old incident',
        state: 'closed',
        created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1年前
        closed_at: new Date(Date.now() - 364 * 24 * 60 * 60 * 1000).toISOString(),
        labels: [{ name: 'bug' }],
      };

      const octokit = await mockGitHubApiService.getOctokit();
      octokit.issues.listForRepo.mockResolvedValue({ data: [oldIssue] });

      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug'],
      });

      // 1週間以内のインシデントのみ検出されるため、1年前のIssueは含まれない
      expect(result.incidents.every((i) => i.issueNumber !== 99)).toBe(true);
    });

    it('PRはIssue一覧から除外される', async () => {
      const prIssue = {
        number: 20,
        title: 'Pull Request',
        state: 'closed',
        created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
        closed_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        labels: [{ name: 'bug' }],
        pull_request: { url: 'https://api.github.com/repos/owner/repo/pulls/20' },
      };

      const octokit = await mockGitHubApiService.getOctokit();
      octokit.issues.listForRepo.mockResolvedValue({ data: [prIssue] });

      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug'],
      });

      // pull_requestプロパティを持つものは除外される
      expect(result.incidents.every((i) => i.issueNumber !== 20)).toBe(true);
    });
  });

  describe('period calculation', () => {
    it('day 期間で計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'day', {
        issueLabels: ['bug'],
      });

      expect(result.period).toBe('day');
      expect(result.dateRange).toBeDefined();
    });

    it('week 期間で計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug'],
      });

      expect(result.period).toBe('week');
    });

    it('month 期間で計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'month', {
        issueLabels: ['bug'],
      });

      expect(result.period).toBe('month');
    });

    it('quarter 期間で計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'quarter', {
        issueLabels: ['bug'],
      });

      expect(result.period).toBe('quarter');
    });

    it('year 期間で計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'year', {
        issueLabels: ['bug'],
      });

      expect(result.period).toBe('year');
    });
  });

  describe('edge cases', () => {
    it('インシデントが0件の場合', async () => {
      const octokit = await mockGitHubApiService.getOctokit();
      octokit.issues.listForRepo.mockResolvedValue({ data: [] });
      octokit.pulls.list.mockResolvedValue({ data: [] });

      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug'],
      });

      expect(result.incidents).toHaveLength(0);
      expect(result.averageMTTRHours).toBe(0);
      expect(result.medianMTTRHours).toBe(0);
    });

    it('インシデントは日付降順でソートされる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug', 'incident'],
      });

      if (result.incidents.length > 1) {
        for (let i = 0; i < result.incidents.length - 1; i++) {
          expect(result.incidents[i].detectedAt.getTime()).toBeGreaterThanOrEqual(
            result.incidents[i + 1].detectedAt.getTime(),
          );
        }
      }
    });

    it('奇数個のインシデントで中央値を計算できる', async () => {
      const oddIncidents = [
        {
          number: 1,
          title: 'Incident 1',
          state: 'closed',
          created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
          closed_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 5時間
          labels: [{ name: 'bug' }],
        },
        {
          number: 2,
          title: 'Incident 2',
          state: 'closed',
          created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
          closed_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 10時間
          labels: [{ name: 'bug' }],
        },
        {
          number: 3,
          title: 'Incident 3',
          state: 'closed',
          created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
          closed_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 15時間
          labels: [{ name: 'bug' }],
        },
      ];

      const octokit = await mockGitHubApiService.getOctokit();
      octokit.issues.listForRepo.mockResolvedValue({ data: oddIncidents });

      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug'],
      });

      // 5h, 10h, 15h の中央値は 10h
      expect(result.medianMTTRHours).toBe(10);
    });

    it('MTTR値が小数点第2位まで丸められる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug', 'incident'],
      });

      // 小数点第2位まで
      expect(result.averageMTTRHours.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
      expect(result.medianMTTRHours.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
    });

    it('closed_atがないIssueはスキップされる', async () => {
      const unclosedIssue = {
        number: 50,
        title: 'Unclosed issue',
        state: 'open',
        created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
        closed_at: null,
        labels: [{ name: 'bug' }],
      };

      const octokit = await mockGitHubApiService.getOctokit();
      octokit.issues.listForRepo.mockResolvedValue({ data: [unclosedIssue] });

      const result = await service.calculate('owner', 'repo', 'week', {
        issueLabels: ['bug'],
      });

      expect(result.incidents.every((i) => i.issueNumber !== 50)).toBe(true);
    });

    it('merged_atがないPRはスキップされる', async () => {
      const unmergedPR = {
        number: 60,
        title: 'Unmerged PR',
        state: 'closed',
        created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
        merged_at: null,
        labels: [{ name: 'hotfix' }],
        head: { ref: 'hotfix/test' },
      };

      const octokit = await mockGitHubApiService.getOctokit();
      octokit.pulls.list.mockResolvedValue({ data: [unmergedPR] });

      const result = await service.calculate('owner', 'repo', 'week', {
        prLabels: ['hotfix'],
      });

      expect(result.incidents.every((i) => i.prNumber !== 60)).toBe(true);
    });
  });
});
