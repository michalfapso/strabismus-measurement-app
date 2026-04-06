import { SessionMetrics, ProgressInsight, ExerciseInsight, SessionQualityInsight, MilestoneInsight, RecommendationInsight } from '../types/analysis';
import { linearRegressionSlope, regressionPValue, computeZScore, mean, median, stdDev, trendDirection } from './stats';

const FUSION_RATE_THRESHOLD_PERCENT = 30;  // switch to fusion metrics when fusionRate >= 30%

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

  // Compute fusion rate
  const fusionAchievedCount = sorted.filter(m => m.fusionAchieved).length;
  const fusionAchievedRate = (fusionAchievedCount / sorted.length) * 100;

  // Segment-derived trends (always computed)
  // bestStableDeviation trend
  const bestStableDevPoints: [number, number][] = sorted.map((m, i) => [i, m.bestStableDeviation]);
  const bestStableDevSlope = linearRegressionSlope(bestStableDevPoints) / (sorted.length / 52);
  const bestStableDevP = regressionPValue(bestStableDevPoints);

  // nearBestStableTime trend
  const nearBestTimePoints: [number, number][] = sorted.map((m, i) => [i, m.nearBestStableTime]);
  const nearBestTimeSlope = linearRegressionSlope(nearBestTimePoints) / (sorted.length / 52);
  const nearBestTimeP = regressionPValue(nearBestTimePoints);

  // qualityPercent trend
  const qualityPercentPoints: [number, number][] = sorted.map((m, i) => [i, m.qualityPercent]);
  const qualityPercentSlope = linearRegressionSlope(qualityPercentPoints) / (sorted.length / 52);
  const qualityPercentP = regressionPValue(qualityPercentPoints);

  // Aggregate histogram
  const aggregateHistogram = sorted[0]?.histogram || [];

  const progressInsight: ProgressInsight = {
    metric,
    fusionAchievedRate,
    fusionAchievedCount,
    totalSessions: sorted.length,
    aggregateHistogram,
    bestStableDeviationTrend: {
      slope: bestStableDevSlope,
      direction: trendDirection(bestStableDevSlope, bestStableDevP, 'minValue'),
      significance: { p: bestStableDevP, significant: bestStableDevP < 0.05 },
    },
    nearBestStableTimeTrend: {
      slope: nearBestTimeSlope,
      direction: trendDirection(nearBestTimeSlope, nearBestTimeP, 'stream'),
      significance: { p: nearBestTimeP, significant: nearBestTimeP < 0.05 },
    },
    qualityPercentTrend: {
      slope: qualityPercentSlope,
      direction: trendDirection(qualityPercentSlope, qualityPercentP, 'stream'),
      significance: { p: qualityPercentP, significant: qualityPercentP < 0.05 },
    },
  };

  // Fusion trends (only if fusionAchievedRate >= threshold)
  if (fusionAchievedRate >= FUSION_RATE_THRESHOLD_PERCENT) {
    const streakPoints: [number, number][] = sorted.map((m, i) => [i, m.longestFusionStreak]);
    const streakSlope = linearRegressionSlope(streakPoints) / (sorted.length / 52);
    const streakP = regressionPValue(streakPoints);

    const eventPoints: [number, number][] = sorted.map((m, i) => [i, m.fusionEventCount]);
    const eventSlope = linearRegressionSlope(eventPoints) / (sorted.length / 52);
    const eventP = regressionPValue(eventPoints);

    progressInsight.fusionStreakTrend = {
      slope: streakSlope,
      direction: trendDirection(streakSlope, streakP, 'streak'),
      significance: { p: streakP, significant: streakP < 0.05 },
    };
    progressInsight.fusionEventCountTrend = {
      slope: eventSlope,
      direction: trendDirection(eventSlope, eventP, 'stream'),
      significance: { p: eventP, significant: eventP < 0.05 },
    };
  }

  return progressInsight;
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
    const bestStableDeviations = sorted.map(m => m.bestStableDeviation);
    const nearBestStableTimes = sorted.map(m => m.nearBestStableTime);

    const streakPoints: [number, number][] = sorted.map((m, i) => [i, m.longestFusionStreak]);
    const trendSlope = linearRegressionSlope(streakPoints) / (sorted.length / 52);
    const trendP = regressionPValue(streakPoints);

    const fusionRate = (sorted.filter(m => m.fusionAchieved).length / sorted.length) * 100;

    const medianBestStableDeviation = median(bestStableDeviations);
    const medianNearBestStableTime = median(nearBestStableTimes);

    return {
      exerciseTag,
      metric,
      sessionCount: sorted.length,
      medianLongestStreak: median(streaks),
      medianFusionEventCount: median(events),
      medianBestStableDeviation,
      medianNearBestStableTime,
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
  const bestStableDevValues = metrics.map(m => m.bestStableDeviation);

  const outlierMean = mean(bestStableDevValues);
  const outlierStd = stdDev(bestStableDevValues);

  const outliers = metrics
    .map(m => {
      const z = computeZScore(m.bestStableDeviation, outlierMean, outlierStd);
      return { m, z };
    })
    .filter(({ z }) => Math.abs(z) > 2)
    .map(({ m, z }) => ({
      sessionId: m.sessionId,
      date: m.date,
      exerciseTag: m.exerciseTag,
      longestFusionStreak: m.longestFusionStreak,
      fusionEventCount: m.fusionEventCount,
      bestStableDeviation: m.bestStableDeviation,
      zScore: z,
      direction: z > 0 ? ('unusually_poor' as const) : ('unusually_good' as const),
    }));

  const streakRange = {
    min: Math.min(...bestStableDevValues),
    max: Math.max(...bestStableDevValues)
  };
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

  // Best stable deviation progress
  const startValue = sorted[0]?.bestStableDeviation || 0;
  const currentValue = sorted[sorted.length - 1]?.bestStableDeviation || 0;
  const progress = Math.max(0, Math.min(100, ((startValue - currentValue) / (startValue - threshold)) * 100));

  // Compute bestStableDeviationProgress
  let bestStableDeviationProgress:
    | {
        startValue: number;
        currentValue: number;
        targetThreshold: number;
        progressPercent: number;
      }
    | undefined;
  if (startValue > threshold) {  // only compute if user is not already at threshold
    const bestStableDevStart = sorted[0]?.bestStableDeviation || startValue;
    const bestStableDevCurrent = sorted[sorted.length - 1]?.bestStableDeviation || startValue;
    const bestStableDevChange = (bestStableDevStart - bestStableDevCurrent) / (bestStableDevStart - threshold) * 100;

    bestStableDeviationProgress = {
      startValue: bestStableDevStart,
      currentValue: bestStableDevCurrent,
      targetThreshold: threshold,
      progressPercent: Math.max(0, Math.min(100, bestStableDevChange)),
    };
  }

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
      type: 'best_stable_level_approaching' as const,
      value: bestStableDeviationProgress?.progressPercent || 0,
      met: (bestStableDeviationProgress?.progressPercent || 0) > 50,
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
    bestStableDeviationProgress,
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
