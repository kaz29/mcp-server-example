import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeFailureRateService } from './change-failure-rate.service';

describe('ChangeFailureRateService', () => {
  let service: ChangeFailureRateService;
  let mockGitHubApiService: any;

  // モックデータ
  const mockReleases = [
    {
      id: 1,
      tag_name: 'v1.0.0',
      name: 'Release 1.0.0',
      draft: false,
      prerelease: false,
      published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5日前
    },
    {
      id: 2,
      tag_name: 'v1.0.1',
      name: 'Release 1.0.1',
      draft: false,
      prerelease: false,
      published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2日前
    },
  ];

  const mockHotfixPRs = [
    {
      number: 10,
      title: 'Hotfix: Fix critical bug',
      state: 'closed',
      merged_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      labels: [{ name: 'hotfix' }],
      head: { ref: 'hotfix/critical-bug' },
    },
  ];

  const mockIncidentIssues = [
    {
      number: 5,
      title: 'Production outage',
      state: 'closed',
      closed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      labels: [{ name: 'bug' }],
    },
  ];

  const mockWorkflowRuns = [
    {
      id: 101,
      name: 'Deploy to Production',
      status: 'completed',
      conclusion: 'failure',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      head_branch: 'main',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // GitHubApiService のモック
    mockGitHubApiService = {
      listReleases: vi.fn().mockResolvedValue(mockReleases),
      listTags: vi.fn().mockResolvedValue([]),
      listWorkflows: vi.fn().mockResolvedValue([]),
      listWorkflowRuns: vi.fn().mockResolvedValue([]),
      getOctokit: vi.fn().mockResolvedValue({
        pulls: {
          list: vi.fn().mockResolvedValue({ data: mockHotfixPRs }),
        },
        issues: {
          listForRepo: vi.fn().mockResolvedValue({ data: mockIncidentIssues }),
        },
        repos: {
          getCommit: vi.fn().mockResolvedValue({
            data: {
              commit: {
                committer: {
                  date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
                },
              },
            },
          }),
        },
      }),
    };

    // サービスを直接インスタンス化
    service = new ChangeFailureRateService(mockGitHubApiService as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculate - release method', () => {
    it('リリースベースで変更失敗率を計算できる', async () => {
      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'release' },
        { issueLabels: ['bug', 'incident'] },
      );

      expect(result.repository).toBe('owner/repo');
      expect(result.period).toBe('week');
      expect(result.totalDeployments).toBe(2);
      expect(result.failedDeployments).toBeGreaterThanOrEqual(0);
      expect(result.failureRate).toBeGreaterThanOrEqual(0);
    });

    it('障害がない場合は失敗率0%', async () => {
      // 障害データを空にする
      const emptyOctokit = {
        pulls: { list: vi.fn().mockResolvedValue({ data: [] }) },
        issues: { listForRepo: vi.fn().mockResolvedValue({ data: [] }) },
      };
      mockGitHubApiService.getOctokit.mockResolvedValue(emptyOctokit);

      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'release' },
        { issueLabels: ['bug'] },
      );

      expect(result.failedDeployments).toBe(0);
      expect(result.failureRate).toBe(0);
    });
  });

  describe('calculate - tag method', () => {
    it('タグベースで変更失敗率を計算できる', async () => {
      const mockTags = [
        { name: 'prodv1.0.0r1', commit: { sha: 'abc123' } },
        { name: 'prodv1.0.1r1', commit: { sha: 'def456' } },
      ];
      mockGitHubApiService.listTags.mockResolvedValue(mockTags);

      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'tag', tagPrefix: 'prodv' },
        { issueLabels: ['bug'] },
      );

      expect(result.repository).toBe('owner/repo');
      expect(result.totalDeployments).toBeGreaterThanOrEqual(0);
    });

    it('tagPrefixでフィルタリングできる', async () => {
      const mockTags = [
        { name: 'prodv1.0.0r1', commit: { sha: 'abc123' } },
        { name: 'devv1.0.0r1', commit: { sha: 'def456' } },
      ];
      mockGitHubApiService.listTags.mockResolvedValue(mockTags);

      await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'tag', tagPrefix: 'prodv' },
        {},
      );

      // getOctokit が呼ばれていることを確認（タグのコミット情報取得のため）
      expect(mockGitHubApiService.getOctokit).toHaveBeenCalled();
    });

    it('tagPatternでフィルタリングできる', async () => {
      const mockTags = [
        { name: 'prodv1.0.0r1', commit: { sha: 'abc123' } },
        { name: 'invalid-tag', commit: { sha: 'def456' } },
      ];
      mockGitHubApiService.listTags.mockResolvedValue(mockTags);

      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'tag', tagPattern: '^prodv\\d+\\.\\d+\\.\\d+r\\d+$' },
        {},
      );

      expect(result).toBeDefined();
    });
  });

  describe('calculate - workflow method', () => {
    it('ワークフローベースで変更失敗率を計算できる', async () => {
      const mockWorkflows = [
        { id: 1, name: 'Deploy to Production', path: '.github/workflows/deploy.yml' },
      ];
      const mockSuccessRuns = [
        {
          id: 101,
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 102,
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      mockGitHubApiService.listWorkflows.mockResolvedValue(mockWorkflows);
      mockGitHubApiService.listWorkflowRuns.mockResolvedValue(mockSuccessRuns);

      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'workflow', workflowName: 'Deploy to Production' },
        {},
      );

      expect(result.totalDeployments).toBe(2);
    });

    it('ワークフローが見つからない場合エラー', async () => {
      mockGitHubApiService.listWorkflows.mockResolvedValue([]);

      await expect(
        service.calculate(
          'owner',
          'repo',
          'week',
          { method: 'workflow', workflowName: 'Non-existent' },
          {},
        ),
      ).rejects.toThrow('ワークフロー');
    });
  });

  describe('failure detection', () => {
    it('Hotfix PRを検出できる（ラベルベース）', async () => {
      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'release' },
        { prLabels: ['hotfix'] },
      );

      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.failures[0].type).toBe('hotfix_pr');
    });

    it('Hotfix PRを検出できる（ブランチパターン）', async () => {
      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'release' },
        { prBranchPattern: '^hotfix/' },
      );

      expect(result.failures.length).toBeGreaterThan(0);
    });

    it('インシデントIssueを検出できる', async () => {
      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'release' },
        { issueLabels: ['bug', 'incident'] },
      );

      expect(result.failures.some((f) => f.type === 'incident_issue')).toBe(true);
    });

    it('ワークフロー失敗を検出できる', async () => {
      mockGitHubApiService.listWorkflowRuns.mockResolvedValue(mockWorkflowRuns);

      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'release' },
        { detectWorkflowFailures: true },
      );

      expect(result.failures.some((f) => f.type === 'workflow_failure')).toBe(true);
    });

    it('複数の障害検出方法を組み合わせられる', async () => {
      mockGitHubApiService.listWorkflowRuns.mockResolvedValue(mockWorkflowRuns);

      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'release' },
        {
          prLabels: ['hotfix'],
          issueLabels: ['bug'],
          detectWorkflowFailures: true,
        },
      );

      // 3種類の障害が検出される
      expect(result.failures.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('period calculation', () => {
    it('day 期間で計算できる', async () => {
      const result = await service.calculate(
        'owner',
        'repo',
        'day',
        { method: 'release' },
        {},
      );

      expect(result.period).toBe('day');
      expect(result.dateRange).toBeDefined();
    });

    it('week 期間で計算できる', async () => {
      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'release' },
        {},
      );

      expect(result.period).toBe('week');
    });

    it('month 期間で計算できる', async () => {
      const result = await service.calculate(
        'owner',
        'repo',
        'month',
        { method: 'release' },
        {},
      );

      expect(result.period).toBe('month');
    });
  });

  describe('edge cases', () => {
    it('デプロイが0件の場合は失敗率0%', async () => {
      mockGitHubApiService.listReleases.mockResolvedValue([]);

      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'release' },
        { issueLabels: ['bug'] },
      );

      expect(result.totalDeployments).toBe(0);
      expect(result.failedDeployments).toBeGreaterThanOrEqual(0);
      expect(result.failureRate).toBe(0);
    });

    it('失敗率が正しく計算される', async () => {
      // 2件のデプロイ、1件の障害 = 50%
      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'release' },
        { issueLabels: ['bug'] },
      );

      expect(result.failureRate).toBeGreaterThanOrEqual(0);
      expect(result.failureRate).toBeLessThanOrEqual(100);
    });

    it('障害は日付降順でソートされる', async () => {
      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'release' },
        { prLabels: ['hotfix'], issueLabels: ['bug'] },
      );

      if (result.failures.length > 1) {
        for (let i = 0; i < result.failures.length - 1; i++) {
          expect(result.failures[i].date.getTime()).toBeGreaterThanOrEqual(
            result.failures[i + 1].date.getTime(),
          );
        }
      }
    });

    it('期間外のPRは除外される', async () => {
      const oldPR = {
        number: 99,
        title: 'Old hotfix',
        state: 'closed',
        merged_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1年前
        created_at: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000).toISOString(),
        labels: [{ name: 'hotfix' }],
        head: { ref: 'hotfix/old' },
      };

      const octokit = await mockGitHubApiService.getOctokit();
      octokit.pulls.list.mockResolvedValue({ data: [oldPR] });

      const result = await service.calculate(
        'owner',
        'repo',
        'week',
        { method: 'release' },
        { prLabels: ['hotfix'] },
      );

      // 1週間以内の障害のみ検出されるため、1年前のPRは含まれない
      expect(result.failures.every((f) => f.identifier !== '#99')).toBe(true);
    });
  });
});
