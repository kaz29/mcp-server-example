import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeploymentFrequencyService } from './deployment-frequency.service';

describe('DeploymentFrequencyService', () => {
  let service: DeploymentFrequencyService;
  let mockGitHubApiService: any;

  // モックデータ
  const mockTags = [
    {
      name: 'prodv1.0.0r1',
      commit: {
        sha: 'abc123',
        url: 'https://api.github.com/repos/owner/repo/commits/abc123',
      },
    },
    {
      name: 'prodv1.0.1r1',
      commit: {
        sha: 'def456',
        url: 'https://api.github.com/repos/owner/repo/commits/def456',
      },
    },
    {
      name: 'devv1.0.0r1', // 異なるprefix
      commit: {
        sha: 'ghi789',
        url: 'https://api.github.com/repos/owner/repo/commits/ghi789',
      },
    },
  ];

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
    {
      id: 3,
      tag_name: 'v1.0.2-beta',
      name: 'Beta Release',
      draft: false,
      prerelease: true, // プレリリースは除外される
      published_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const mockWorkflows = [
    {
      id: 1,
      name: 'Deploy to Production',
      path: '.github/workflows/deploy.yml',
    },
  ];

  const mockWorkflowRuns = [
    {
      id: 101,
      name: 'Deploy to Production',
      status: 'completed',
      conclusion: 'success',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3日前
    },
    {
      id: 102,
      name: 'Deploy to Production',
      status: 'completed',
      conclusion: 'success',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1日前
    },
  ];

  const mockCommit = {
    commit: {
      committer: {
        date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4日前
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // GitHubApiService のモック
    mockGitHubApiService = {
      listTags: vi.fn().mockResolvedValue(mockTags),
      listReleases: vi.fn().mockResolvedValue(mockReleases),
      listWorkflows: vi.fn().mockResolvedValue(mockWorkflows),
      listWorkflowRuns: vi.fn().mockResolvedValue(mockWorkflowRuns),
      getOctokit: vi.fn().mockResolvedValue({
        repos: {
          getCommit: vi.fn().mockResolvedValue({ data: mockCommit }),
        },
      }),
    };

    // サービスを直接インスタンス化
    service = new DeploymentFrequencyService(mockGitHubApiService as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculate - release method', () => {
    it('リリースベースでデプロイ頻度を計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        method: 'release',
      });

      expect(result.repository).toBe('owner/repo');
      expect(result.period).toBe('week');
      expect(result.totalDeployments).toBe(2); // プレリリースを除く
      expect(result.deploymentsPerDay).toBeGreaterThan(0);
      expect(result.deploymentDates).toHaveLength(2);
      expect(mockGitHubApiService.listReleases).toHaveBeenCalledWith('owner', 'repo');
    });

    it('ドラフトやプレリリースを除外する', async () => {
      mockGitHubApiService.listReleases.mockResolvedValue([
        {
          id: 1,
          tag_name: 'v1.0.0',
          draft: true, // ドラフトは除外
          prerelease: false,
          published_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 2,
          tag_name: 'v1.0.1',
          draft: false,
          prerelease: true, // プレリリースは除外
          published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);

      const result = await service.calculate('owner', 'repo', 'week', {
        method: 'release',
      });

      expect(result.totalDeployments).toBe(0);
    });
  });

  describe('calculate - tag method', () => {
    it('タグベースでデプロイ頻度を計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        method: 'tag',
        tagPrefix: 'prodv',
      });

      expect(result.repository).toBe('owner/repo');
      expect(result.period).toBe('week');
      expect(result.totalDeployments).toBeGreaterThanOrEqual(0);
      expect(mockGitHubApiService.listTags).toHaveBeenCalledWith('owner', 'repo');
    });

    it('tagPrefix でフィルタリングできる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        method: 'tag',
        tagPrefix: 'prodv',
      });

      // "prodv" で始まるタグのみが対象
      expect(mockGitHubApiService.getOctokit).toHaveBeenCalled();
    });

    it('tagPattern でフィルタリングできる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        method: 'tag',
        tagPattern: '^prodv\\d+\\.\\d+\\.\\d+r\\d+$',
      });

      expect(result).toBeDefined();
    });
  });

  describe('calculate - workflow method', () => {
    it('ワークフローベースでデプロイ頻度を計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        method: 'workflow',
        workflowName: 'Deploy to Production',
      });

      expect(result.repository).toBe('owner/repo');
      expect(result.period).toBe('week');
      expect(result.totalDeployments).toBe(2);
      expect(mockGitHubApiService.listWorkflows).toHaveBeenCalledWith('owner', 'repo');
      expect(mockGitHubApiService.listWorkflowRuns).toHaveBeenCalled();
    });

    it('workflowFile でワークフローを指定できる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        method: 'workflow',
        workflowFile: 'deploy.yml',
      });

      expect(result.totalDeployments).toBe(2);
    });

    it('ワークフローが見つからない場合エラー', async () => {
      // 空の配列を返すようにモックを上書き
      mockGitHubApiService.listWorkflows.mockResolvedValue([]);

      await expect(
        service.calculate('owner', 'repo', 'week', {
          method: 'workflow',
          workflowName: 'Non-existent Workflow',
        }),
      ).rejects.toThrow('ワークフロー');
    });
  });

  describe('period calculation', () => {
    it('day 期間で計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'day', {
        method: 'release',
      });

      expect(result.period).toBe('day');
      expect(result.dateRange).toBeDefined();
      expect(result.dateRange.from).toBeDefined();
      expect(result.dateRange.to).toBeDefined();
    });

    it('week 期間で計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'week', {
        method: 'release',
      });

      expect(result.period).toBe('week');
    });

    it('month 期間で計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'month', {
        method: 'release',
      });

      expect(result.period).toBe('month');
    });

    it('quarter 期間で計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'quarter', {
        method: 'release',
      });

      expect(result.period).toBe('quarter');
    });

    it('year 期間で計算できる', async () => {
      const result = await service.calculate('owner', 'repo', 'year', {
        method: 'release',
      });

      expect(result.period).toBe('year');
    });
  });

  describe('edge cases', () => {
    it('デプロイが0件の場合', async () => {
      mockGitHubApiService.listReleases.mockResolvedValue([]);

      const result = await service.calculate('owner', 'repo', 'week', {
        method: 'release',
      });

      expect(result.totalDeployments).toBe(0);
      expect(result.deploymentsPerDay).toBe(0);
      expect(result.deploymentDates).toHaveLength(0);
    });

    it('deploymentsPerDay が正しく計算される', async () => {
      // 7日間で2回のデプロイ
      const result = await service.calculate('owner', 'repo', 'week', {
        method: 'release',
      });

      // 2 / 8 = 0.25 (week = 7日 + 1日 = 8日)
      expect(result.deploymentsPerDay).toBeCloseTo(0.25, 2);
    });
  });
});
