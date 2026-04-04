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

  // Sub-scores
  timeToFirstFusion: number | null;
  fusionEventCount: number;
  longestFusionStreak: number;
  minValue: number;
  largeDeviationTimePercent: number;
  trajectoryRatio: number | null;

  // Supporting
  fusionTime: number;
  fusionTimePercent: number;
  fusionAchieved: boolean;
  nearFusionTime: number;
  nearFusionTimePercent: number;
  largeDeviationTime: number;

  // FSM
  stateSegments: StateSegment[];
}

export interface ProgressInsight {
  metric: 'deviation' | 'rotation';
  fusionStreakTrend: {
    slope: number;
    direction: 'improving' | 'declining' | 'stable';
    significance: { p: number; significant: boolean };
  };
  minValueTrend: {
    slope: number;
    direction: 'improving' | 'declining' | 'stable';
    significance: { p: number; significant: boolean };
    startValue: number;
    currentValue: number;
  };
  fusionAchievedRate: number;
  fusionAchievedCount: number;
  totalSessions: number;
  aggregateHistogram: HistogramBin[];
  baselineFusionAchievedRate?: number;
  baselineMedianStreak?: number;
  improvementRate?: number;
}

export interface ExerciseInsight {
  exerciseTag: string;
  metric: 'deviation' | 'rotation';
  sessionCount: number;
  medianLongestStreak: number;
  medianFusionEventCount: number;
  medianMinValue: number;
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
