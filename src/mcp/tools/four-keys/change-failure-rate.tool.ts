import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { ChangeFailureRateService } from '../../services/four-keys/change-failure-rate.service';
import { Period } from '../../types/four-keys.types';
import { DeploymentConfig, FailureConfig } from '../../types/github.types';

@Injectable()
export class ChangeFailureRateTool {
  constructor(
    private readonly changeFailureRateService: ChangeFailureRateService,
  ) {}

  @Tool({
    name: 'get_change_failure_rate',
    description:
      'リポジトリの変更失敗率を取得します。変更失敗率はFour Keys（DORAメトリクス）の1つで、デプロイ後に障害が発生した割合を測定します。',
    parameters: z.object({
      owner: z.string().describe('リポジトリのオーナー名（organization または user）'),
      repo: z.string().describe('リポジトリ名'),
      period: z
        .enum(['day', 'week', 'month', 'quarter', 'year'])
        .default('month')
        .describe('集計期間（day: 今日, week: 過去7日, month: 過去30日, quarter: 過去3ヶ月, year: 過去1年）'),

      // デプロイ検出設定
      deploymentMethod: z
        .enum(['workflow', 'release', 'tag'])
        .default('release')
        .describe(
          'デプロイ検出方法（workflow: GitHub Actions, release: GitHub Releases, tag: Gitタグ）',
        ),
      workflowName: z
        .string()
        .optional()
        .describe('デプロイワークフロー名（deploymentMethod=workflowの場合）'),
      workflowFile: z
        .string()
        .optional()
        .describe('デプロイワークフローファイル名（deploymentMethod=workflowの場合）'),
      tagPattern: z
        .string()
        .optional()
        .describe('タグパターンの正規表現（deploymentMethod=tagの場合）'),
      tagPrefix: z
        .string()
        .optional()
        .default(process.env.DEFAULT_TAG_PREFIX || '')
        .describe('タグprefix（deploymentMethod=tagの場合）'),

      // 障害検出設定
      issueLabels: z
        .array(z.string())
        .optional()
        .describe('インシデントを示すIssueラベル（例: ["bug", "incident", "hotfix"]）'),
      prLabels: z
        .array(z.string())
        .optional()
        .describe('ホットフィックスを示すPRラベル（例: ["hotfix"]）'),
      prBranchPattern: z
        .string()
        .optional()
        .describe('ホットフィックスブランチのパターン（例: "^hotfix/"）'),
      detectWorkflowFailures: z
        .boolean()
        .optional()
        .default(false)
        .describe('ワークフロー失敗を障害として検出するか'),
    }),
  })
  async getChangeFailureRate({
    owner,
    repo,
    period = 'month',
    deploymentMethod = 'release',
    workflowName,
    workflowFile,
    tagPattern,
    tagPrefix,
    issueLabels,
    prLabels,
    prBranchPattern,
    detectWorkflowFailures = false,
  }: {
    owner: string;
    repo: string;
    period?: Period;
    deploymentMethod?: 'workflow' | 'release' | 'tag';
    workflowName?: string;
    workflowFile?: string;
    tagPattern?: string;
    tagPrefix?: string;
    issueLabels?: string[];
    prLabels?: string[];
    prBranchPattern?: string;
    detectWorkflowFailures?: boolean;
  }) {
    // デプロイ検出設定
    const deploymentConfig: DeploymentConfig = {
      method: deploymentMethod,
      workflowName,
      workflowFile,
      tagPattern,
      tagPrefix,
    };

    // 障害検出設定
    const failureConfig: FailureConfig = {
      issueLabels,
      prLabels,
      prBranchPattern,
      detectWorkflowFailures,
    };

    // 変更失敗率を計算
    const result = await this.changeFailureRateService.calculate(
      owner,
      repo,
      period,
      deploymentConfig,
      failureConfig,
    );

    // 結果を整形して返す
    const periodLabel = this.getPeriodLabel(period);
    const failureList = result.failures
      .slice(0, 10) // 最新10件のみ表示
      .map((failure) => {
        const typeLabel = this.getFailureTypeLabel(failure.type);
        return `  - [${typeLabel}] ${failure.identifier}: ${failure.title}\n    発生日時: ${failure.date.toISOString()}`;
      })
      .join('\n\n');

    const performanceLevel = this.evaluatePerformance(result.failureRate);

    return [
      `## 変更失敗率 - ${result.repository}`,
      '',
      `**期間**: ${periodLabel}`,
      `**デプロイ検出方法**: ${this.getMethodLabel(deploymentMethod)}`,
      '',
      `### 結果`,
      `- **総デプロイ数**: ${result.totalDeployments}`,
      `- **失敗したデプロイ数**: ${result.failedDeployments}`,
      `- **変更失敗率**: ${result.failureRate.toFixed(2)}%`,
      `- **パフォーマンスレベル**: ${performanceLevel}`,
      '',
      result.failures.length > 0
        ? `### 検出された障害 (最大10件)\n${failureList}`
        : '### 障害は検出されませんでした',
      '',
      '---',
      '**DORA パフォーマンスレベル**:',
      '- Elite: 0-15%',
      '- High: 16-30%',
      '- Medium: 31-45%',
      '- Low: 46%以上',
    ].join('\n');
  }

  private getPeriodLabel(period: Period): string {
    const labels = {
      day: '今日',
      week: '過去7日間',
      month: '過去30日間',
      quarter: '過去3ヶ月',
      year: '過去1年',
    };
    return labels[period];
  }

  private getMethodLabel(method: 'workflow' | 'release' | 'tag'): string {
    const labels = {
      workflow: 'GitHub Actions ワークフロー',
      release: 'GitHub Releases',
      tag: 'Git タグ',
    };
    return labels[method];
  }

  private getFailureTypeLabel(
    type: 'workflow_failure' | 'hotfix_pr' | 'incident_issue',
  ): string {
    const labels = {
      workflow_failure: 'ワークフロー失敗',
      hotfix_pr: 'ホットフィックスPR',
      incident_issue: 'インシデントIssue',
    };
    return labels[type];
  }

  private evaluatePerformance(failureRate: number): string {
    if (failureRate <= 15) {
      return '⭐ Elite（0-15%）';
    } else if (failureRate <= 30) {
      return '🟢 High（16-30%）';
    } else if (failureRate <= 45) {
      return '🟡 Medium（31-45%）';
    } else {
      return '🔴 Low（46%以上）';
    }
  }
}
