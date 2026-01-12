import { Injectable, Logger } from '@nestjs/common';
import { GitHubApiService } from '../github/github-api.service';
import { LeadTime, Period, DateRange, LeadTimeSample } from '../../types/four-keys.types';
import {
  subDays,
  subMonths,
  subYears,
  differenceInHours,
  startOfDay,
  endOfDay,
} from 'date-fns';

/**
 * リードタイム算出サービス
 *
 * GitHub API からマージされたPRを取得し、リードタイム（PR作成からマージまでの時間）を計算します。
 */
@Injectable()
export class LeadTimeService {
  private readonly logger = new Logger(LeadTimeService.name);

  constructor(private readonly githubApiService: GitHubApiService) {}

  /**
   * リードタイムを計算
   *
   * @param owner リポジトリオーナー
   * @param repo リポジトリ名
   * @param period 期間
   */
  async calculate(
    owner: string,
    repo: string,
    period: Period,
  ): Promise<LeadTime> {
    this.logger.log(
      `リードタイムを計算中: ${owner}/${repo} (${period})`,
    );

    // 期間の計算
    const dateRange = this.calculateDateRange(period);

    // マージされたPRを取得
    const samples = await this.collectLeadTimeSamples(
      owner,
      repo,
      dateRange,
    );

    // 統計値の計算
    const leadTimeHours = samples.map(s => s.leadTimeHours).sort((a, b) => a - b);

    const averageLeadTimeHours = leadTimeHours.length > 0
      ? leadTimeHours.reduce((sum, hours) => sum + hours, 0) / leadTimeHours.length
      : 0;

    const medianLeadTimeHours = this.calculateMedian(leadTimeHours);
    const p95LeadTimeHours = this.calculatePercentile(leadTimeHours, 95);

    this.logger.log(
      `リードタイム計算完了: ${samples.length} PRs, 平均 ${averageLeadTimeHours.toFixed(2)}時間`,
    );

    return {
      repository: `${owner}/${repo}`,
      period,
      dateRange,
      averageLeadTimeHours: parseFloat(averageLeadTimeHours.toFixed(2)),
      medianLeadTimeHours: parseFloat(medianLeadTimeHours.toFixed(2)),
      p95LeadTimeHours: parseFloat(p95LeadTimeHours.toFixed(2)),
      samples: samples.slice(0, 20), // 最新20件のみ返す
    };
  }

  /**
   * 期間から日付範囲を計算
   */
  private calculateDateRange(period: Period): DateRange {
    const now = new Date();
    const to = endOfDay(now);
    let from: Date;

    switch (period) {
      case 'day':
        from = startOfDay(now);
        break;
      case 'week':
        from = startOfDay(subDays(now, 7));
        break;
      case 'month':
        from = startOfDay(subMonths(now, 1));
        break;
      case 'quarter':
        from = startOfDay(subMonths(now, 3));
        break;
      case 'year':
        from = startOfDay(subYears(now, 1));
        break;
      default:
        throw new Error(`未知の期間: ${period}`);
    }

    return { from, to };
  }

  /**
   * マージされたPRからリードタイムサンプルを収集
   */
  private async collectLeadTimeSamples(
    owner: string,
    repo: string,
    dateRange: DateRange,
  ): Promise<LeadTimeSample[]> {
    // マージされたPRを取得
    const mergedPRs = await this.githubApiService.listMergedPullRequests(
      owner,
      repo,
      {
        since: dateRange.from,
        until: dateRange.to,
      },
    );

    const samples: LeadTimeSample[] = [];

    for (const pr of mergedPRs) {
      // ドラフトPRは除外
      if (pr.draft) {
        continue;
      }

      // マージ日時が期間内かチェック
      const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;
      if (!mergedAt || mergedAt < dateRange.from || mergedAt > dateRange.to) {
        continue;
      }

      const createdAt = new Date(pr.created_at);
      const leadTimeHours = differenceInHours(mergedAt, createdAt);

      // リードタイムが負の値になる場合はスキップ（データ異常）
      if (leadTimeHours < 0) {
        this.logger.warn(
          `PR #${pr.number} のリードタイムが負の値: ${leadTimeHours}時間`,
        );
        continue;
      }

      samples.push({
        prNumber: pr.number,
        title: pr.title,
        createdAt,
        mergedAt,
        leadTimeHours,
      });
    }

    // マージ日時の降順でソート（新しい順）
    samples.sort((a, b) => b.mergedAt.getTime() - a.mergedAt.getTime());

    this.logger.log(`${samples.length} 件のPRからリードタイムを収集`);
    return samples;
  }

  /**
   * 中央値を計算
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * パーセンタイルを計算
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}
