import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { DeploymentFrequencyService } from '../../services/four-keys/deployment-frequency.service';
import { LeadTimeService } from '../../services/four-keys/lead-time.service';
import { ChangeFailureRateService } from '../../services/four-keys/change-failure-rate.service';
import { MTTRService } from '../../services/four-keys/mttr.service';
import { Period } from '../../types/four-keys.types';
import { DeploymentConfig, FailureConfig } from '../../types/github.types';

@Injectable()
export class FourKeysSummaryTool {
  constructor(
    private readonly deploymentFrequencyService: DeploymentFrequencyService,
    private readonly leadTimeService: LeadTimeService,
    private readonly changeFailureRateService: ChangeFailureRateService,
    private readonly mttrService: MTTRService,
  ) {}

  @Tool({
    name: 'get_four_keys_summary',
    description:
      'リポジトリのFour Keys（DORAメトリクス）を一度に取得します。デプロイ頻度、リードタイム、変更失敗率、MTTRの全4つのメトリクスを集計し、総合的なパフォーマンスレベルを評価します。',
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
  async getFourKeysSummary({
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

    // 全メトリクスを並列で取得
    const [
      deploymentFrequency,
      leadTime,
      changeFailureRate,
      mttr,
    ] = await Promise.all([
      this.deploymentFrequencyService.calculate(
        owner,
        repo,
        period,
        deploymentConfig,
      ),
      this.leadTimeService.calculate(owner, repo, period),
      this.changeFailureRateService.calculate(
        owner,
        repo,
        period,
        deploymentConfig,
        failureConfig,
      ),
      this.mttrService.calculate(owner, repo, period, failureConfig),
    ]);

    // 結果を整形して返す
    const periodLabel = this.getPeriodLabel(period);

    // 各メトリクスのパフォーマンスレベル
    const dfLevel = this.evaluateDeploymentFrequency(
      deploymentFrequency.deploymentsPerDay,
    );
    const ltLevel = this.evaluateLeadTime(leadTime.averageLeadTimeHours);
    const cfrLevel = this.evaluateChangeFailureRate(changeFailureRate.failureRate);
    const mttrLevel = this.evaluateMTTR(mttr.averageMTTRHours);

    // リードタイムの時間表示
    const ltDays = Math.floor(leadTime.averageLeadTimeHours / 24);
    const ltHours = Math.floor(leadTime.averageLeadTimeHours % 24);
    const ltTimeLabel =
      ltDays > 0 ? `${ltDays}日${ltHours}時間` : `${ltHours}時間`;

    // MTTRの時間表示
    const mttrDays = Math.floor(mttr.averageMTTRHours / 24);
    const mttrHours = Math.floor(mttr.averageMTTRHours % 24);
    const mttrTimeLabel =
      mttrDays > 0 ? `${mttrDays}日${mttrHours}時間` : `${mttrHours}時間`;

    // 総合パフォーマンスレベルの評価
    const overallLevel = this.evaluateOverallPerformance([
      dfLevel,
      ltLevel,
      cfrLevel,
      mttrLevel,
    ]);

    return [
      `# Four Keys サマリー - ${owner}/${repo}`,
      '',
      `**期間**: ${periodLabel}`,
      `**総合パフォーマンスレベル**: ${this.getOverallLevelLabel(overallLevel)}`,
      '',
      '---',
      '',
      '## 1. デプロイ頻度 (Deployment Frequency)',
      `- **1日あたりのデプロイ数**: ${deploymentFrequency.deploymentsPerDay.toFixed(2)}`,
      `- **総デプロイ数**: ${deploymentFrequency.totalDeployments}`,
      `- **レベル**: ${dfLevel}`,
      '',
      '## 2. リードタイム (Lead Time for Changes)',
      `- **平均リードタイム**: ${ltTimeLabel} (${leadTime.averageLeadTimeHours.toFixed(2)}時間)`,
      `- **中央値**: ${Math.floor(leadTime.medianLeadTimeHours / 24)}日${Math.floor(leadTime.medianLeadTimeHours % 24)}時間`,
      `- **サンプル数**: ${leadTime.samples.length} PRs`,
      `- **レベル**: ${ltLevel}`,
      '',
      '## 3. 変更失敗率 (Change Failure Rate)',
      `- **失敗率**: ${changeFailureRate.failureRate.toFixed(2)}%`,
      `- **失敗数**: ${changeFailureRate.failedDeployments}`,
      `- **総デプロイ数**: ${changeFailureRate.totalDeployments}`,
      `- **レベル**: ${cfrLevel}`,
      '',
      '## 4. MTTR (Mean Time to Restore)',
      `- **平均MTTR**: ${mttrTimeLabel} (${mttr.averageMTTRHours.toFixed(2)}時間)`,
      `- **インシデント数**: ${mttr.incidents.length}`,
      `- **レベル**: ${mttrLevel}`,
      '',
      '---',
      '',
      '**DORAパフォーマンスレベル基準**:',
      '',
      '**デプロイ頻度**',
      '- Elite: 1日に複数回',
      '- High: 週に1回以上',
      '- Medium: 月に1回以上',
      '- Low: 月に1回未満',
      '',
      '**リードタイム**',
      '- Elite: 1日未満',
      '- High: 1週間未満',
      '- Medium: 1ヶ月未満',
      '- Low: 1ヶ月以上',
      '',
      '**変更失敗率**',
      '- Elite: 0-15%',
      '- High: 16-30%',
      '- Medium: 31-45%',
      '- Low: 46%以上',
      '',
      '**MTTR**',
      '- Elite: 1時間未満',
      '- High: 1日未満',
      '- Medium: 1週間未満',
      '- Low: 1週間以上',
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

  private evaluateDeploymentFrequency(deploymentsPerDay: number): string {
    if (deploymentsPerDay >= 1) {
      return '⭐ Elite';
    } else if (deploymentsPerDay >= 1 / 7) {
      return '🟢 High';
    } else if (deploymentsPerDay >= 1 / 30) {
      return '🟡 Medium';
    } else {
      return '🔴 Low';
    }
  }

  private evaluateLeadTime(leadTimeHours: number): string {
    if (leadTimeHours < 24) {
      return '⭐ Elite';
    } else if (leadTimeHours < 24 * 7) {
      return '🟢 High';
    } else if (leadTimeHours < 24 * 30) {
      return '🟡 Medium';
    } else {
      return '🔴 Low';
    }
  }

  private evaluateChangeFailureRate(failureRate: number): string {
    if (failureRate <= 15) {
      return '⭐ Elite';
    } else if (failureRate <= 30) {
      return '🟢 High';
    } else if (failureRate <= 45) {
      return '🟡 Medium';
    } else {
      return '🔴 Low';
    }
  }

  private evaluateMTTR(mttrHours: number): string {
    if (mttrHours < 1) {
      return '⭐ Elite';
    } else if (mttrHours < 24) {
      return '🟢 High';
    } else if (mttrHours < 24 * 7) {
      return '🟡 Medium';
    } else {
      return '🔴 Low';
    }
  }

  private evaluateOverallPerformance(levels: string[]): 'elite' | 'high' | 'medium' | 'low' {
    const eliteCount = levels.filter((l) => l.includes('Elite')).length;
    const highCount = levels.filter((l) => l.includes('High')).length;
    const lowCount = levels.filter((l) => l.includes('Low')).length;

    // 全てEliteまたはHighの場合
    if (eliteCount + highCount === 4) {
      if (eliteCount >= 3) return 'elite';
      return 'high';
    }

    // Lowが2つ以上ある場合
    if (lowCount >= 2) {
      return 'low';
    }

    // その他はMedium
    return 'medium';
  }

  private getOverallLevelLabel(
    level: 'elite' | 'high' | 'medium' | 'low',
  ): string {
    const labels = {
      elite: '⭐ Elite',
      high: '🟢 High',
      medium: '🟡 Medium',
      low: '🔴 Low',
    };
    return labels[level];
  }
}
