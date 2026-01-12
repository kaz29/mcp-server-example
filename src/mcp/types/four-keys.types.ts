/**
 * Four Keys (DORA Metrics) の型定義
 */

/**
 * 期間指定
 */
export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * 日付範囲
 */
export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * リポジトリ指定
 */
export interface RepositoryInput {
  owner: string;
  repo: string;
}

/**
 * デプロイ頻度の結果
 */
export interface DeploymentFrequency {
  repository: string;
  period: Period;
  dateRange: DateRange;
  totalDeployments: number;
  deploymentsPerDay: number;
  deploymentDates: Date[];
}

/**
 * リードタイムの結果
 */
export interface LeadTime {
  repository: string;
  period: Period;
  dateRange: DateRange;
  averageLeadTimeHours: number;
  medianLeadTimeHours: number;
  p95LeadTimeHours: number;
  samples: LeadTimeSample[];
}

/**
 * リードタイムのサンプル
 */
export interface LeadTimeSample {
  prNumber: number;
  title: string;
  createdAt: Date;
  mergedAt: Date;
  leadTimeHours: number;
}

/**
 * 変更失敗率の結果
 */
export interface ChangeFailureRate {
  repository: string;
  period: Period;
  dateRange: DateRange;
  totalDeployments: number;
  failedDeployments: number;
  failureRate: number; // 0-100 (%)
  failures: FailureIncident[];
}

/**
 * 障害インシデント
 */
export interface FailureIncident {
  type: 'workflow_failure' | 'hotfix_pr' | 'incident_issue';
  identifier: string; // PR番号、Issue番号、Workflow Run ID
  date: Date;
  title: string;
}

/**
 * MTTR (平均復旧時間) の結果
 */
export interface MTTR {
  repository: string;
  period: Period;
  dateRange: DateRange;
  averageMTTRHours: number;
  medianMTTRHours: number;
  incidents: MTTRIncident[];
}

/**
 * MTTRインシデント
 */
export interface MTTRIncident {
  issueNumber?: number;
  prNumber?: number;
  title: string;
  detectedAt: Date;
  resolvedAt: Date;
  mttrHours: number;
}

/**
 * Four Keys サマリー
 */
export interface FourKeysSummary {
  repository: string;
  period: Period;
  dateRange: DateRange;
  deploymentFrequency: {
    deploymentsPerDay: number;
    total: number;
  };
  leadTime: {
    averageHours: number;
    medianHours: number;
  };
  changeFailureRate: {
    rate: number; // %
    total: number;
    failed: number;
  };
  mttr: {
    averageHours: number;
    medianHours: number;
  };
  performanceLevel: PerformanceLevel;
}

/**
 * DORA パフォーマンスレベル
 */
export type PerformanceLevel = 'elite' | 'high' | 'medium' | 'low';
