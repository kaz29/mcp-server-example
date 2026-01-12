import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubApiService } from './github-api.service';

describe('GitHubApiService', () => {
  let service: GitHubApiService;
  let mockAuthService: any;

  // モックデータ
  const mockWorkflowRuns = [
    {
      id: 1,
      name: 'Deploy to Production',
      status: 'completed',
      conclusion: 'success',
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2024-01-10T10:10:00Z',
    },
    {
      id: 2,
      name: 'Deploy to Production',
      status: 'completed',
      conclusion: 'failure',
      created_at: '2024-01-11T10:00:00Z',
      updated_at: '2024-01-11T10:10:00Z',
    },
  ];

  const mockPullRequests = [
    {
      id: 1,
      number: 10,
      title: 'Feature A',
      state: 'closed',
      created_at: '2024-01-01T10:00:00Z',
      merged_at: '2024-01-05T10:00:00Z',
      draft: false,
      labels: [],
    },
    {
      id: 2,
      number: 11,
      title: 'Hotfix B',
      state: 'closed',
      created_at: '2024-01-10T10:00:00Z',
      merged_at: '2024-01-10T12:00:00Z',
      draft: false,
      labels: [{ name: 'hotfix' }],
    },
  ];

  const mockReleases = [
    {
      id: 1,
      tag_name: 'v1.0.0',
      name: 'Release 1.0.0',
      published_at: '2024-01-15T10:00:00Z',
    },
  ];

  const mockTags = [
    {
      name: 'prodv1.0.0r1',
      commit: {
        sha: 'abc123',
        url: 'https://api.github.com/repos/owner/repo/commits/abc123',
      },
    },
  ];

  const mockIssues = [
    {
      id: 1,
      number: 5,
      title: 'Bug in authentication',
      state: 'closed',
      created_at: '2024-01-05T10:00:00Z',
      closed_at: '2024-01-06T10:00:00Z',
      labels: [{ name: 'bug' }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // GitHubAuthService のモック
    mockAuthService = {
      getInstallationToken: vi.fn().mockResolvedValue('ghs_mock_token'),
      getConfig: vi.fn().mockReturnValue({
        appId: 123456,
        installationId: 78901234,
        privateKey: 'mock_key',
        baseUrl: undefined,
      }),
    };

    // サービスを直接インスタンス化
    service = new GitHubApiService(mockAuthService as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOctokit', () => {
    it('Octokit インスタンスを取得できる', async () => {
      const octokit = await service.getOctokit();

      expect(octokit).toBeDefined();
      expect(mockAuthService.getInstallationToken).toHaveBeenCalled();
    });

    it('BaseURL を設定できる', async () => {
      mockAuthService.getConfig.mockReturnValue({
        appId: 123456,
        installationId: 78901234,
        privateKey: 'mock_key',
        baseUrl: 'https://github.enterprise.com/api/v3',
      });

      const octokit = await service.getOctokit();

      expect(octokit).toBeDefined();
    });
  });

  describe('listWorkflowRuns', () => {
    it('ワークフロー実行履歴を取得できる', async () => {
      const mockOctokit = {
        paginate: vi.fn().mockResolvedValue(mockWorkflowRuns),
        actions: {
          listWorkflowRunsForRepo: vi.fn(),
        },
      };

      vi.spyOn(service, 'getOctokit').mockResolvedValue(mockOctokit as any);

      const result = await service.listWorkflowRuns('owner', 'repo');

      expect(result).toEqual(mockWorkflowRuns);
      expect(mockOctokit.paginate).toHaveBeenCalled();
    });

    it('特定のワークフローの実行履歴を取得できる', async () => {
      const mockOctokit = {
        paginate: vi.fn().mockResolvedValue(mockWorkflowRuns),
        actions: {
          listWorkflowRuns: vi.fn(),
        },
      };

      vi.spyOn(service, 'getOctokit').mockResolvedValue(mockOctokit as any);

      const result = await service.listWorkflowRuns('owner', 'repo', {
        workflowId: 'deploy.yml',
      });

      expect(result).toEqual(mockWorkflowRuns);
    });
  });

  describe('listPullRequests', () => {
    it('PR 一覧を取得できる', async () => {
      const mockOctokit = {
        paginate: vi.fn().mockResolvedValue(mockPullRequests),
        pulls: {
          list: vi.fn(),
        },
      };

      vi.spyOn(service, 'getOctokit').mockResolvedValue(mockOctokit as any);

      const result = await service.listPullRequests('owner', 'repo');

      expect(result).toEqual(mockPullRequests);
      expect(mockOctokit.paginate).toHaveBeenCalled();
    });
  });

  describe('listMergedPullRequests', () => {
    it('マージされたPRを取得できる', async () => {
      const mockOctokit = {
        paginate: vi.fn().mockResolvedValue(mockPullRequests),
        pulls: {
          list: vi.fn(),
        },
      };

      vi.spyOn(service, 'getOctokit').mockResolvedValue(mockOctokit as any);

      const result = await service.listMergedPullRequests('owner', 'repo');

      expect(result).toHaveLength(2);
      expect(result[0].merged_at).toBeDefined();
    });

    it('期間でフィルタリングできる', async () => {
      const mockOctokit = {
        paginate: vi.fn().mockResolvedValue(mockPullRequests),
        pulls: {
          list: vi.fn(),
        },
      };

      vi.spyOn(service, 'getOctokit').mockResolvedValue(mockOctokit as any);

      const result = await service.listMergedPullRequests('owner', 'repo', {
        since: new Date('2024-01-10T00:00:00Z'),
      });

      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(11);
    });
  });

  describe('listIssues', () => {
    it('Issue 一覧を取得できる', async () => {
      const mockOctokit = {
        paginate: vi.fn().mockResolvedValue(mockIssues),
        issues: {
          listForRepo: vi.fn(),
        },
      };

      vi.spyOn(service, 'getOctokit').mockResolvedValue(mockOctokit as any);

      const result = await service.listIssues('owner', 'repo');

      expect(result).toEqual(mockIssues);
      expect(mockOctokit.paginate).toHaveBeenCalled();
    });

    it('ラベルでフィルタリングできる', async () => {
      const mockOctokit = {
        paginate: vi.fn().mockResolvedValue(mockIssues),
        issues: {
          listForRepo: vi.fn(),
        },
      };

      vi.spyOn(service, 'getOctokit').mockResolvedValue(mockOctokit as any);

      const result = await service.listIssues('owner', 'repo', {
        labels: 'bug,incident',
      });

      expect(result).toEqual(mockIssues);
    });
  });

  describe('listReleases', () => {
    it('リリース一覧を取得できる', async () => {
      const mockOctokit = {
        paginate: vi.fn().mockResolvedValue(mockReleases),
        repos: {
          listReleases: vi.fn(),
        },
      };

      vi.spyOn(service, 'getOctokit').mockResolvedValue(mockOctokit as any);

      const result = await service.listReleases('owner', 'repo');

      expect(result).toEqual(mockReleases);
      expect(mockOctokit.paginate).toHaveBeenCalled();
    });
  });

  describe('listTags', () => {
    it('タグ一覧を取得できる', async () => {
      const mockOctokit = {
        paginate: vi.fn().mockResolvedValue(mockTags),
        repos: {
          listTags: vi.fn(),
        },
      };

      vi.spyOn(service, 'getOctokit').mockResolvedValue(mockOctokit as any);

      const result = await service.listTags('owner', 'repo');

      expect(result).toEqual(mockTags);
      expect(mockOctokit.paginate).toHaveBeenCalled();
    });
  });

  describe('getRepository', () => {
    it('リポジトリ情報を取得できる', async () => {
      const mockRepository = {
        id: 123,
        name: 'repo',
        full_name: 'owner/repo',
      };

      const mockOctokit = {
        repos: {
          get: vi.fn().mockResolvedValue({ data: mockRepository }),
        },
      };

      vi.spyOn(service, 'getOctokit').mockResolvedValue(mockOctokit as any);

      const result = await service.getRepository('owner', 'repo');

      expect(result).toEqual(mockRepository);
      expect(mockOctokit.repos.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
      });
    });
  });
});
