import { SessionMetrics, ProgressInsight, ExerciseInsight, SessionQualityInsight, MilestoneInsight, RecommendationInsight } from '../types/analysis';
import { linearRegressionSlope, regressionPValue, computeZScore, mean, median, stdDev, trendDirection } from './stats';

/**
 * Calculate ProgressInsight from SessionMetrics array
 */
export function calculateProgressInsight(
  metrics: SessionMetrics[],
  thresholds: { deviation: number; rotation: number }
): ProgressInsight {
  const metric = metrics[0]?.metric || 'deviation';
  const threshold = metric === 'deviation' ? thresholds.deviation : thresholds.rotation;

  // Sort by date for time-series
  const sorted = [...metrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Fusion streak trend: (session index, longestFusionStreak)
  const streakPoints: [number, number][] = sorted.map((m, i) => [i, m.longestFusionStreak]);
  const streakSlope = linearRegressionSlope(streakPoints) / (sorted.length / 52); // convert to per-week
  const streakP = regressionPValue(streakPoints);

  // Min value trend: (session index, minValue)
  const minValuePoints: [number, number][] = sorted.map((m, i) => [i, m.minValue]);
  const minValueSlope = linearRegressionSlope(minValuePoints) / (sorted.length / 52); // per-week
  const minValueP = regressionPValue(minValuePoints);

  const fusionCount = sorted.filter(m => m.fusionAchieved).length;
  const fusionRate = (fusionCount / sorted.length) * 100;

  // Aggregate histogram
  const aggregateHistogram = sorted[0]?.histogram || [];

  return {
    metric,
    fusionStreakTrend: {
      slope: streakSlope,
      direction: trendDirection(streakSlope, streakP, 'streak'),
      significance: { p: streakP, significant: streakP < 0.05 },
    },
    minValueTrend: {
      slope: minValueSlope,
      direction: trendDirection(minValueSlope, minValueP, 'minValue'),
      significance: { p: minValueP, significant: minValueP < 0.05 },
      startValue: sorted[0]?.minValue || 0,
      currentValue: sorted[sorted.length - 1]?.minValue || 0,
    },
    fusionAchievedRate: fusionRate,
    fusionAchievedCount: fusionCount,
    totalSessions: sorted.length,
    aggregateHistogram,
  };
}

/**
 * Calculate ExerciseInsight from SessionMetrics grouped by exercise
 */
export function calculateExerciseInsights(
  metrics: SessionMetrics[]
): ExerciseInsight[] {
  const byExercise = new Map<string, SessionMetrics[]>();
  for (const m of metrics) {
    if (!byExercise.has(m.exerciseTag)) {
      byExercise.set(m.exerciseTag, []);
    }
    byExercise.get(m.exerciseTag)!.push(m);
  }

  return Array.from(byExercise.entries()).map(([exerciseTag, exerciseMetrics]) => {
    const sorted = [...exerciseMetrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const metric = sorted[0]?.metric || 'deviation';

    const streaks = sorted.map(m => m.longestFusionStreak);
    const events = sorted.map(m => m.fusionEventCount);
    const minValues = sorted.map(m => m.minValue);

    const streakPoints: [number, number][] = sorted.map((m, i) => [i, m.longestFusionStreak]);
    const trendSlope = linearRegressionSlope(streakPoints) / (sorted.length / 52);
    const trendP = regressionPValue(streakPoints);

    const fusionRate = (sorted.filter(m => m.fusionAchieved).length / sorted.length) * 100;

    return {
      exerciseTag,
      metric,
      sessionCount: sorted.length,
      medianLongestStreak: median(streaks),
      medianFusionEventCount: median(events),
      medianMinValue: median(minValues),
      fusionAchievedRate: fusionRate,
      trendDirection: trendDirection(trendSlope, trendP, 'streak'),
      trendSlope,
    };
  });
}

/**
 * Calculate SessionQualityInsight from SessionMetrics
 */
export function calculateSessionQualityInsight(
  metrics: SessionMetrics[]
): SessionQualityInsight {
  if (metrics.length === 0) {
    return {
      metric: 'deviation',
      outliers: [],
      variability: { level: 'low', streakRange: { min: 0, max: 0 } },
    };
  }

  const metric = metrics[0].metric;
  const streaks = metrics.map(m => m.longestFusionStreak);
  const minValues = metrics.map(m => m.minValue);

  // Use streak for outlier detection if fusion achieved in >30% of sessions
  const fusionRate = (metrics.filter(m => m.fusionAchieved).length / metrics.length) * 100;
  const outlierValues = fusionRate >= 30 ? streaks : minValues;
  const outlierMean = mean(outlierValues);
  const outlierStd = stdDev(outlierValues);

  const outliers = metrics
    .map(m => {
      const value = fusionRate >= 30 ? m.longestFusionStreak : m.minValue;
      const z = computeZScore(value, outlierMean, outlierStd);
      return { m, value, z };
    })
    .filter(({ z }) => Math.abs(z) > 2)
    .map(({ m, z }) => ({
      sessionId: m.sessionId,
      date: m.date,
      exerciseTag: m.exerciseTag,
      longestFusionStreak: m.longestFusionStreak,
      fusionEventCount: m.fusionEventCount,
      minValue: m.minValue,
      zScore: z,
      direction: z > 0 ? 'unusually_good' as const : 'unusually_poor' as const,
    }));

  const streakRange = { min: Math.min(...streaks), max: Math.max(...streaks) };
  const streakSpread = streakRange.max - streakRange.min;
  const variability: 'low' | 'moderate' | 'high' =
    streakSpread < 5 ? 'low' : streakSpread < 20 ? 'moderate' : 'high';

  return {
    metric,
    outliers,
    variability: { level: variability, streakRange },
  };
}

/**
 * Calculate MilestoneInsight from SessionMetrics
 */
export function calculateMilestoneInsight(
  metrics: SessionMetrics[],
  thresholds: { deviation: number; rotation: number },
  sustainedDays: number
): MilestoneInsight {
  const metric = metrics[0]?.metric || 'deviation';
  const threshold = metric === 'deviation' ? thresholds.deviation : thresholds.rotation;

  const sorted = [...metrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Find sustained fusion events
  const sustainedEvents: Array<{ startDate: string; endDate: string; durationDays: number }> = [];
  let eventStart: string | null = null;
  let lastDate: string | null = null;

  for (const m of sorted) {
    if (m.fusionAchieved) {
      if (!eventStart) eventStart = m.date;
      lastDate = m.date;
    } else {
      if (eventStart && lastDate) {
        const durationDays = Math.ceil(
          (new Date(lastDate).getTime() - new Date(eventStart).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (durationDays >= sustainedDays) {
          sustainedEvents.push({ startDate: eventStart, endDate: lastDate, durationDays });
        }
      }
      eventStart = null;
    }
  }

  // Min value progress
  const startValue = sorted[0]?.minValue || 0;
  const currentValue = sorted[sorted.length - 1]?.minValue || 0;
  const progress = Math.max(0, Math.min(100, ((startValue - currentValue) / (startValue - threshold)) * 100));

  // Readiness indicators
  const readinessIndicators = [
    {
      type: 'sustained_fusion' as const,
      value: sustainedEvents.length,
      met: sustainedEvents.length > 0,
    },
    {
      type: 'min_value_approaching_threshold' as const,
      value: progress,
      met: progress > 50,
    },
    {
      type: 'high_fusion_rate' as const,
      value: (sorted.filter(m => m.fusionAchieved).length / sorted.length) * 100,
      met: (sorted.filter(m => m.fusionAchieved).length / sorted.length) * 100 > 50,
    },
  ];

  return {
    metric,
    sustainedFusionEvents: sustainedEvents,
    minValueProgress: {
      startValue,
      currentValue,
      targetThreshold: threshold,
      progressPercent: progress,
    },
    readinessIndicators,
  };
}

/**
 * Calculate RecommendationInsight from exercise insights
 */
export function calculateRecommendationInsight(
  exercises: ExerciseInsight[]
): RecommendationInsight {
  if (exercises.length < 2) {
    return {
      prioritize: [],
      reduce: [],
      generalNotes: ['Insufficient data for recommendations (< 2 exercise types).'],
    };
  }

  const sorted = [...exercises].sort((a, b) => b.medianLongestStreak - a.medianLongestStreak);

  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return {
    prioritize: best
      ? [{ exerciseTag: best.exerciseTag, reason: `Highest median streak (${best.medianLongestStreak.toFixed(1)}s)` }]
      : [],
    reduce: worst
      ? [{ exerciseTag: worst.exerciseTag, reason: `Lowest median streak (${worst.medianLongestStreak.toFixed(1)}s)` }]
      : [],
    generalNotes: [`Focus on ${best?.exerciseTag || 'effective exercises'}. Consider reducing ${worst?.exerciseTag || 'less effective exercises'}.`],
  };
}
