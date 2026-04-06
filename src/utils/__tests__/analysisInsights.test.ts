import { describe, it, expect } from 'vitest';
import { calculateProgressInsight } from '../analysisInsights';
import { SessionMetrics } from '../../types/analysis';

describe('calculateProgressInsight with segment metrics', () => {
  it('should compute segment-derived trends for all users', () => {
    const metrics: SessionMetrics[] = [
      {
        sessionId: 's1',
        date: '2026-01-01',
        metric: 'deviation',
        bestStableDeviation: 3.0,
        nearBestStableTime: 10,
        qualityPercent: 50,
        fusionAchieved: false,
        fusionAchievedCount: 0,
        fusionEventCount: 0,
        longestFusionStreak: 0,
        largeDeviationTimePercent: 0,
        trajectoryRatio: null,
        timeToFirstFusion: null,
        fusionTime: 0,
        fusionTimePercent: 0,
        nearFusionTime: 0,
        nearFusionTimePercent: 0,
        largeDeviationTime: 0,
        sessionDuration: 1000,
        histogram: [],
        driftingPercent: 30,
        approachingPercent: 20,
        stateSegments: [],
        exerciseTag: 'test',
      },
      {
        sessionId: 's2',
        date: '2026-01-02',
        metric: 'deviation',
        bestStableDeviation: 2.5,
        nearBestStableTime: 15,
        qualityPercent: 55,
        fusionAchieved: false,
        fusionAchievedCount: 0,
        fusionEventCount: 0,
        longestFusionStreak: 0,
        largeDeviationTimePercent: 0,
        trajectoryRatio: null,
        timeToFirstFusion: null,
        fusionTime: 0,
        fusionTimePercent: 0,
        nearFusionTime: 0,
        nearFusionTimePercent: 0,
        largeDeviationTime: 0,
        sessionDuration: 1000,
        histogram: [],
        driftingPercent: 30,
        approachingPercent: 20,
        stateSegments: [],
        exerciseTag: 'test',
      },
      {
        sessionId: 's3',
        date: '2026-01-03',
        metric: 'deviation',
        bestStableDeviation: 2.0,
        nearBestStableTime: 20,
        qualityPercent: 60,
        fusionAchieved: false,
        fusionAchievedCount: 0,
        fusionEventCount: 0,
        longestFusionStreak: 0,
        largeDeviationTimePercent: 0,
        trajectoryRatio: null,
        timeToFirstFusion: null,
        fusionTime: 0,
        fusionTimePercent: 0,
        nearFusionTime: 0,
        nearFusionTimePercent: 0,
        largeDeviationTime: 0,
        sessionDuration: 1000,
        histogram: [],
        driftingPercent: 30,
        approachingPercent: 20,
        stateSegments: [],
        exerciseTag: 'test',
      },
    ];

    const result = calculateProgressInsight(metrics, { deviation: 1.0, rotation: 30 });

    expect(result.bestStableDeviationTrend).toBeDefined();
    expect(result.bestStableDeviationTrend.direction).toBe('improving');
    expect(result.nearBestStableTimeTrend).toBeDefined();
    expect(result.nearBestStableTimeTrend.direction).toBe('improving');
    expect(result.qualityPercentTrend).toBeDefined();
    expect(result.qualityPercentTrend.direction).toBe('improving');
    expect(result.fusionAchievedRate).toBe(0);
    expect(result.fusionStreakTrend).toBeUndefined();
  });
});
