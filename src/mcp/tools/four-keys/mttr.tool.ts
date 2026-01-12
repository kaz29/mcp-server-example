import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { MTTRService } from '../../services/four-keys/mttr.service';
import { Period } from '../../types/four-keys.types';
import { FailureConfig } from '../../types/github.types';

@Injectable()
export class MTTRTool {
  constructor(private readonly mttrService: MTTRService) {}

  @Tool({
    name: 'get_mttr',
    description:
      'リポジトリのMTTR（平均復旧時間）を取得します。MTTRはFour Keys（DORAメトリクス）の1つで、障害発生から復旧までの平均時間を測定します。',
    parameters: z.object({
      owner: z.string().describe('リポジトリのオーナー名（organization または user）'),
      repo: z.string().describe('リポジトリ名'),
      period: z
        .enum(['day', 'week', 'month', 'quarter', 'year'])
        .default('month')
        .describe('集計期間（day: 今日, week: 過去7日, month: 過去30日, quarter: 過去3ヶ月, year: 過去1年）'),

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
    }),
  })
  async getMTTR({
    owner,
    repo,
    period = 'month',
    issueLabels,
    prLabels,
    prBranchPattern,
  }: {
    owner: string;
    repo: string;
    period?: Period;
    issueLabels?: string[];
    prLabels?: string[];
    prBranchPattern?: string;
  }) {
    // 障害検出設定
    const failureConfig: FailureConfig = {
      issueLabels,
      prLabels,
      prBranchPattern,
    };

    // MTTRを計算
    const result = await this.mttrService.calculate(
      owner,
      repo,
      period,
      failureConfig,
    );

    // 結果を整形して返す
    const periodLabel = this.getPeriodLabel(period);
    const incidentList = result.incidents
      .slice(0, 10) // 最新10件のみ表示
      .map((incident) => {
        const identifier = incident.issueNumber
          ? `Issue #${incident.issueNumber}`
          : `PR #${incident.prNumber}`;
        const days = Math.floor(incident.mttrHours / 24);
        const hours = Math.floor(incident.mttrHours % 24);
        const timeLabel =
          days > 0 ? `${days}日${hours}時間` : `${hours}時間`;

        return [
          `  - ${identifier}: ${incident.title}`,
          `    検出: ${incident.detectedAt.toISOString()}`,
          `    解決: ${incident.resolvedAt.toISOString()}`,
          `    復旧時間: ${timeLabel} (${incident.mttrHours.toFixed(1)}時間)`,
        ].join('\n');
      })
      .join('\n\n');

    const performanceLevel = this.evaluatePerformance(result.averageMTTRHours);

    // 平均MTTRの時間表示
    const avgDays = Math.floor(result.averageMTTRHours / 24);
    const avgHours = Math.floor(result.averageMTTRHours % 24);
    const avgTimeLabel =
      avgDays > 0 ? `${avgDays}日${avgHours}時間` : `${avgHours}時間`;

    // 中央値MTTRの時間表示
    const medianDays = Math.floor(result.medianMTTRHours / 24);
    const medianHours = Math.floor(result.medianMTTRHours % 24);
    const medianTimeLabel =
      medianDays > 0 ? `${medianDays}日${medianHours}時間` : `${medianHours}時間`;

    return [
      `## MTTR (平均復旧時間) - ${result.repository}`,
      '',
      `**期間**: ${periodLabel}`,
      '',
      `### 結果`,
      `- **平均MTTR**: ${avgTimeLabel} (${result.averageMTTRHours.toFixed(2)}時間)`,
      `- **中央値MTTR**: ${medianTimeLabel} (${result.medianMTTRHours.toFixed(2)}時間)`,
      `- **インシデント数**: ${result.incidents.length}`,
      `- **パフォーマンスレベル**: ${performanceLevel}`,
      '',
      result.incidents.length > 0
        ? `### インシデント (最大10件)\n${incidentList}`
        : '### インシデントは検出されませんでした',
      '',
      '---',
      '**DORA パフォーマンスレベル**:',
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

  private evaluatePerformance(mttrHours: number): string {
    if (mttrHours < 1) {
      return '⭐ Elite（1時間未満）';
    } else if (mttrHours < 24) {
      return '🟢 High（1日未満）';
    } else if (mttrHours < 24 * 7) {
      return '🟡 Medium（1週間未満）';
    } else {
      return '🔴 Low（1週間以上）';
    }
  }
}
