export interface ReportSnapshot {
  reportId: string;
  name?: string;
  sessionIds: string[];
  dateRange: [number, number]; // [fromMs, toMs]
  metrics: ('deviation' | 'rotation')[];
  goal: {
    thresholds: {
      deviation?: number;
      rotation?: number;
    };
    sustainedDays: number;
  };
  baseline?: {
    dateRange: [number, number];
    exerciseTypes?: string[];
  };
  savedAt: number;
}

// HistogramBin - matches the existing codebase's HistogramBin from utils/histogram.ts
// The existing type uses rangeStart, rangeEnd, duration
export interface HistogramBin {
  rangeStart: number;
  rangeEnd: number;
  duration: number; // seconds
  label: string;
}

export type SessionState =
  | 'FUSION'
  | 'NEAR_FUSION'
  | 'APPROACHING'
  | 'STABLE_DEVIATION'
  | 'DRIFTING';

export interface SegmentMetrics {
  // Univariate statistics (from raw data within segment)
  medianDeviation: number;        // Median value within segment
  minDeviation: number;           // Best (lowest) achieved within segment
  maxDeviation: number;           // Worst (highest) within segment
  meanDeviation: number;          // Arithmetic mean within segment
  varianceWithinSegment: number;  // Population variance; low = stable, high = volatile
  stdDevWithinSegment: number;    // Standard deviation

  // Intra-segment trend (in cm/s)
  intraSegmentSlope: number;      // Mean slope within segment; negative = improving, positive = declining
}

export interface StateSegment {
  state: SessionState;
  startTime: number;
  endTime: number;
  duration: number;
  metrics?: SegmentMetrics;    // Computed eagerly during classifyStates(); always present after classification
}

export interface SessionMetrics {
  sessionId: string;
  date: string;
  exerciseTag: string;
  metric: 'deviation' | 'rotation';
  sessionDuration: number;
  histogram: HistogramBin[];

  // Segment-derived metrics (new, always computed)
  bestStableDeviation: number;      // min meanDeviation across quality segments
  nearBestStableTime: number;       // total duration of quality segments (seconds)
  qualityPercent: number;           // % of session in quality segments
  driftingPercent: number;          // % of session in DRIFTING
  approachingPercent: number;       // % of session in APPROACHING

  // Sub-scores (existing, keep)
  timeToFirstFusion: number | null;
  fusionEventCount: number;
  longestFusionStreak: number;
  largeDeviationTimePercent: number;
  trajectoryRatio: number | null;

  // Supporting (existing, keep)
  fusionTime: number;
  fusionTimePercent: number;
  fusionAchieved: boolean;
  nearFusionTime: number;
  nearFusionTimePercent: number;
  largeDeviationTime: number;

  // FSM (existing, keep)
  stateSegments: StateSegment[];
}

export interface TrendInfo {
  slope: number;
  direction: 'improving' | 'declining' | 'stable';
  significance: { p: number; significant: boolean };
}

export interface ProgressInsight {
  metric: 'deviation' | 'rotation';
  fusionAchievedRate: number;  // % of sessions where fusion was achieved
  fusionAchievedCount: number;
  totalSessions: number;
  aggregateHistogram: HistogramBin[];

  // Segment-derived trends (always computed, all users)
  bestStableDeviationTrend: TrendInfo;
  nearBestStableTimeTrend: TrendInfo;
  qualityPercentTrend: TrendInfo;

  // Fusion trends (only present if fusionAchievedRate >= FUSION_RATE_THRESHOLD_PERCENT)
  fusionStreakTrend?: TrendInfo;
  fusionEventCountTrend?: TrendInfo;
}

export interface ExerciseInsight {
  exerciseTag: string;
  metric: 'deviation' | 'rotation';
  sessionCount: number;
  medianLongestStreak: number;
  medianFusionEventCount: number;
  medianBestStableDeviation: number;
  medianNearBestStableTime: number;
  fusionAchievedRate: number;
  trendDirection: 'improving' | 'declining' | 'stable';
  trendSlope: number;
  improvementRate?: number;
}

export interface SessionQualityInsight {
  metric: 'deviation' | 'rotation';
  outliers: Array<{
    sessionId: string;
    date: string;
    exerciseTag: string;
    longestFusionStreak: number;
    fusionEventCount: number;
    minValue: number;
    zScore: number;
    direction: 'unusually_good' | 'unusually_poor';
  }>;
  variability: {
    level: 'low' | 'moderate' | 'high';
    streakRange: { min: number; max: number };
  };
  consistencyScore?: number;
}

export interface CombinedQualityInsight {
  overallConsistencyScore?: number;
}

export interface MilestoneInsight {
  metric: 'deviation' | 'rotation';
  sustainedFusionEvents: Array<{
    startDate: string;
    endDate: string;
    durationDays: number;
  }>;
  minValueProgress: {
    startValue: number;
    currentValue: number;
    targetThreshold: number;
    progressPercent: number;
  };
  readinessIndicators: Array<{
    type: 'sustained_fusion' | 'min_value_approaching_threshold' | 'high_fusion_rate';
    value: number;
    met: boolean;
  }>;
}

export interface RecommendationInsight {
  prioritize: Array<{ exerciseTag: string; reason: string }>;
  reduce: Array<{ exerciseTag: string; reason: string }>;
  generalNotes: string[];
}

export interface AnalysisSettings {
  goal: {
    thresholds: {
      deviation: number;
      rotation: number;
    };
    sustainedDays: number;
  };
}
