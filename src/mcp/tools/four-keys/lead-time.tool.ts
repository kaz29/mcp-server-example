import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { LeadTimeService } from '../../services/four-keys/lead-time.service';
import { Period } from '../../types/four-keys.types';

@Injectable()
export class LeadTimeTool {
  constructor(
    private readonly leadTimeService: LeadTimeService,
  ) {}

  @Tool({
    name: 'get_lead_time',
    description:
      'リポジトリのリードタイム（Lead Time for Changes）を取得します。リードタイムはFour Keys（DORAメトリクス）の1つで、コード変更が本番環境に反映されるまでの時間を測定します。具体的には、PRの作成からマージまでの時間を計測します。',
    parameters: z.object({
      owner: z.string().describe('リポジトリのオーナー名（organization または user）'),
      repo: z.string().describe('リポジトリ名'),
      period: z
        .enum(['day', 'week', 'month', 'quarter', 'year'])
        .default('month')
        .describe('集計期間（day: 今日, week: 過去7日, month: 過去30日, quarter: 過去3ヶ月, year: 過去1年）'),
    }),
  })
  async getLeadTime({
    owner,
    repo,
    period = 'month',
  }: {
    owner: string;
    repo: string;
    period?: Period;
  }) {
    // リードタイムを計算
    const result = await this.leadTimeService.calculate(
      owner,
      repo,
      period,
    );

    // 結果を整形して返す
    const periodLabel = this.getPeriodLabel(period);
    const sampleList = result.samples
      .slice(0, 10) // 最新10件のみ表示
      .map((sample) => {
        const days = Math.floor(sample.leadTimeHours / 24);
        const hours = Math.floor(sample.leadTimeHours % 24);
        const timeStr = days > 0
          ? `${days}日${hours}時間`
          : `${hours}時間`;
        return `  - PR #${sample.prNumber}: ${sample.title}\n    作成: ${sample.createdAt.toISOString()}\n    マージ: ${sample.mergedAt.toISOString()}\n    リードタイム: ${timeStr} (${sample.leadTimeHours.toFixed(1)}時間)`;
      })
      .join('\n\n');

    const performanceLevel = this.evaluatePerformance(result.averageLeadTimeHours);

    // 時間を読みやすい形式に変換
    const formatHours = (hours: number): string => {
      if (hours < 24) {
        return `${hours.toFixed(1)}時間`;
      }
      const days = Math.floor(hours / 24);
      const remainingHours = Math.floor(hours % 24);
      return `${days}日${remainingHours}時間 (${hours.toFixed(1)}時間)`;
    };

    return [
      `## リードタイム - ${result.repository}`,
      '',
      `**期間**: ${periodLabel}`,
      '',
      `### 結果`,
      `- **平均リードタイム**: ${formatHours(result.averageLeadTimeHours)}`,
      `- **中央値リードタイム**: ${formatHours(result.medianLeadTimeHours)}`,
      `- **95パーセンタイル**: ${formatHours(result.p95LeadTimeHours)}`,
      `- **サンプル数**: ${result.samples.length} PRs`,
      `- **パフォーマンスレベル**: ${performanceLevel}`,
      '',
      result.samples.length > 0
        ? `### 最新のPR (最大10件)\n${sampleList}`
        : '### マージされたPRが見つかりませんでした',
      '',
      '---',
      '**DORA パフォーマンスレベル**:',
      '- Elite: 1日未満',
      '- High: 1日〜1週間',
      '- Medium: 1週間〜1ヶ月',
      '- Low: 1ヶ月以上',
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

  private evaluatePerformance(averageLeadTimeHours: number): string {
    const oneDayHours = 24;
    const oneWeekHours = 7 * 24;
    const oneMonthHours = 30 * 24;

    if (averageLeadTimeHours < oneDayHours) {
      return '⭐ Elite（1日未満）';
    } else if (averageLeadTimeHours < oneWeekHours) {
      return '🟢 High（1週間未満）';
    } else if (averageLeadTimeHours < oneMonthHours) {
      return '🟡 Medium（1ヶ月未満）';
    } else {
      return '🔴 Low（1ヶ月以上）';
    }
  }
}
