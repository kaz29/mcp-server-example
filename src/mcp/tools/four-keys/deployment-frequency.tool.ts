import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { DeploymentFrequencyService } from '../../services/four-keys/deployment-frequency.service';
import { Period } from '../../types/four-keys.types';
import { DeploymentConfig } from '../../types/github.types';

@Injectable()
export class DeploymentFrequencyTool {
  constructor(
    private readonly deploymentFrequencyService: DeploymentFrequencyService,
  ) {}

  @Tool({
    name: 'get_deployment_frequency',
    description:
      'リポジトリのデプロイ頻度を取得します。デプロイ頻度はFour Keys（DORAメトリクス）の1つで、本番環境へのデプロイ頻度を測定します。',
    parameters: z.object({
      owner: z.string().describe('リポジトリのオーナー名（organization または user）'),
      repo: z.string().describe('リポジトリ名'),
      period: z
        .enum(['day', 'week', 'month', 'quarter', 'year'])
        .default('month')
        .describe('集計期間（day: 今日, week: 過去7日, month: 過去30日, quarter: 過去3ヶ月, year: 過去1年）'),
      method: z
        .enum(['workflow', 'release', 'tag'])
        .default('workflow')
        .describe(
          'デプロイ検出方法（workflow: GitHub Actions, release: GitHub Releases, tag: Gitタグ）',
        ),
      workflowName: z
        .string()
        .optional()
        .describe('デプロイワークフロー名（method=workflowの場合）例: "Deploy to Production"'),
      workflowFile: z
        .string()
        .optional()
        .describe('デプロイワークフローファイル名（method=workflowの場合）例: "deploy.yml"'),
      tagPattern: z
        .string()
        .optional()
        .describe('タグパターンの正規表現（method=tagの場合）例: "^v\\\\d+\\\\.\\\\d+\\\\.\\\\d+$"'),
      tagPrefix: z
        .string()
        .optional()
        .default(process.env.DEFAULT_TAG_PREFIX || '')
        .describe('タグprefix（method=tagの場合）例: "prodv" (prodvX.X.XrX形式)'),
    }),
  })
  async getDeploymentFrequency({
    owner,
    repo,
    period = 'month',
    method = 'workflow',
    workflowName,
    workflowFile,
    tagPattern,
    tagPrefix,
  }: {
    owner: string;
    repo: string;
    period?: Period;
    method?: 'workflow' | 'release' | 'tag';
    workflowName?: string;
    workflowFile?: string;
    tagPattern?: string;
    tagPrefix?: string;
  }) {
    // デプロイ検出設定
    const config: DeploymentConfig = {
      method,
      workflowName,
      workflowFile,
      tagPattern,
      tagPrefix,
    };

    // デプロイ頻度を計算
    const result = await this.deploymentFrequencyService.calculate(
      owner,
      repo,
      period,
      config,
    );

    // 結果を整形して返す
    const periodLabel = this.getPeriodLabel(period);
    const deploymentList = result.deploymentDates
      .slice(0, 10) // 最新10件のみ表示
      .map((date) => `  - ${date.toISOString()}`)
      .join('\n');

    const performanceLevel = this.evaluatePerformance(result.deploymentsPerDay);

    return [
      `## デプロイ頻度 - ${result.repository}`,
      '',
      `**期間**: ${periodLabel}`,
      `**デプロイ検出方法**: ${this.getMethodLabel(method)}`,
      '',
      `### 結果`,
      `- **総デプロイ数**: ${result.totalDeployments}`,
      `- **1日あたりのデプロイ数**: ${result.deploymentsPerDay.toFixed(2)}`,
      `- **パフォーマンスレベル**: ${performanceLevel}`,
      '',
      result.deploymentDates.length > 0
        ? `### 最新のデプロイ (最大10件)\n${deploymentList}`
        : '### デプロイが見つかりませんでした',
      '',
      '---',
      '**DORA パフォーマンスレベル**:',
      '- Elite: 1日に複数回',
      '- High: 1日に1回 〜 週に1回',
      '- Medium: 週に1回 〜 月に1回',
      '- Low: 月に1回未満',
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

  private evaluatePerformance(deploymentsPerDay: number): string {
    if (deploymentsPerDay >= 1) {
      return '⭐ Elite（1日に複数回）';
    } else if (deploymentsPerDay >= 1 / 7) {
      return '🟢 High（週に1回以上）';
    } else if (deploymentsPerDay >= 1 / 30) {
      return '🟡 Medium（月に1回以上）';
    } else {
      return '🔴 Low（月に1回未満）';
    }
  }
}
