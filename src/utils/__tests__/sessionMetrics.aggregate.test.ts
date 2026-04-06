import { computeSessionAggregateMetrics } from '../sessionMetrics';
import { StateSegment, SegmentMetrics } from '../../types/analysis';
import { TimeSeries } from '../../types';

describe('computeSessionAggregateMetrics', () => {
  it('should compute metrics from segments with quality state in range', () => {
    // Build test segments: FUSION (0.5 cm, 2s) + STABLE_DEVIATION (3 cm, 3s) + DRIFTING (5 cm, 1s)
    const segments: StateSegment[] = [
      {
        state: 'FUSION',
        startTime: 0,
        endTime: 2,
        duration: 2,
        metrics: { meanDeviation: 0.5, medianDeviation: 0.5, minDeviation: 0.4, maxDeviation: 0.6,
                   varianceWithinSegment: 0.01, stdDevWithinSegment: 0.1, intraSegmentSlope: -0.1 },
      },
      {
        state: 'STABLE_DEVIATION',
        startTime: 2,
        endTime: 5,
        duration: 3,
        metrics: { meanDeviation: 3.0, medianDeviation: 3.0, minDeviation: 2.9, maxDeviation: 3.1,
                   varianceWithinSegment: 0.01, stdDevWithinSegment: 0.1, intraSegmentSlope: 0.0 },
      },
      {
        state: 'DRIFTING',
        startTime: 5,
        endTime: 6,
        duration: 1,
        metrics: { meanDeviation: 5.0, medianDeviation: 5.0, minDeviation: 4.5, maxDeviation: 5.5,
                   varianceWithinSegment: 0.1, stdDevWithinSegment: 0.3, intraSegmentSlope: 1.0 },
      },
    ];

    // Build time series with max deviation 5.5
    const timeSeries: TimeSeries[] = [
      { t: 0, x: 0.5, y: 0, r: 0 },
      { t: 1000, x: 0.4, y: 0, r: 0 },
      { t: 2000, x: 3.0, y: 0, r: 0 },
      { t: 5000, x: 5.5, y: 0, r: 0 },
      { t: 6000, x: 5.5, y: 0, r: 0 },
    ];

    const result = computeSessionAggregateMetrics(segments, timeSeries);

    // bestStableDeviation = min(0.5, 3.0) = 0.5
    // sessionMaxDev = 5.5
    // nearBestThreshold = 0.5 + 0.1 * (5.5 - 0.5) = 0.5 + 0.5 = 1.0
    // Quality segments within threshold: FUSION (0.5 <= 1.0) [2s] + STABLE_DEVIATION (3.0 > 1.0) [excluded]
    // nearBestStableTime = 2s
    // qualityPercent = 2 / 6 * 100 = 33.33%
    // driftingPercent = 1 / 6 * 100 = 16.67%
    // approachingPercent = 0 / 6 * 100 = 0%

    expect(result.bestStableDeviation).toBe(0.5);
    expect(result.nearBestStableTime).toBe(2);
    expect(result.qualityPercent).toBeCloseTo(33.33, 1);
    expect(result.driftingPercent).toBeCloseTo(16.67, 1);
    expect(result.approachingPercent).toBeCloseTo(0, 1);
  });

  it('should handle no quality segments by using sessionMaxDeviation as fallback', () => {
    const segments: StateSegment[] = [
      {
        state: 'DRIFTING',
        startTime: 0,
        endTime: 5,
        duration: 5,
        metrics: { meanDeviation: 3.0, medianDeviation: 3.0, minDeviation: 2.5, maxDeviation: 3.5,
                   varianceWithinSegment: 0.1, stdDevWithinSegment: 0.3, intraSegmentSlope: 0.5 },
      },
    ];

    const timeSeries: TimeSeries[] = [
      { t: 0, x: 2.5, y: 0, r: 0 },
      { t: 2500, x: 3.0, y: 0, r: 0 },
      { t: 5000, x: 3.5, y: 0, r: 0 },
    ];

    const result = computeSessionAggregateMetrics(segments, timeSeries);

    // No quality segments → bestStableDeviation = sessionMaxDev = 3.5
    expect(result.bestStableDeviation).toBe(3.5);
    expect(result.nearBestStableTime).toBe(0);
    expect(result.qualityPercent).toBe(0);
    expect(result.driftingPercent).toBeCloseTo(100, 1);
  });

  it('should compute percentages that sum to ~100%', () => {
    const segments: StateSegment[] = [
      {
        state: 'APPROACHING',
        startTime: 0,
        endTime: 2,
        duration: 2,
        metrics: { meanDeviation: 2.0, medianDeviation: 2.0, minDeviation: 1.8, maxDeviation: 2.2,
                   varianceWithinSegment: 0.04, stdDevWithinSegment: 0.2, intraSegmentSlope: -0.5 },
      },
      {
        state: 'FUSION',
        startTime: 2,
        endTime: 5,
        duration: 3,
        metrics: { meanDeviation: 0.5, medianDeviation: 0.5, minDeviation: 0.4, maxDeviation: 0.6,
                   varianceWithinSegment: 0.01, stdDevWithinSegment: 0.1, intraSegmentSlope: 0.0 },
      },
      {
        state: 'DRIFTING',
        startTime: 5,
        endTime: 10,
        duration: 5,
        metrics: { meanDeviation: 4.0, medianDeviation: 4.0, minDeviation: 3.5, maxDeviation: 4.5,
                   varianceWithinSegment: 0.25, stdDevWithinSegment: 0.5, intraSegmentSlope: 1.0 },
      },
    ];

    const timeSeries: TimeSeries[] = Array.from({ length: 11 }, (_, i) => ({
      t: i * 1000,
      x: i < 2 ? 2 - i * 0.1 : (i < 5 ? 0.5 : 4 + (i - 5) * 0.1),
      y: 0,
      r: 0,
    }));

    const result = computeSessionAggregateMetrics(segments, timeSeries);

    const sum = result.qualityPercent + result.driftingPercent + result.approachingPercent;
    expect(sum).toBeCloseTo(100, 1);
  });

  // Edge case tests
  it('should handle empty timeSeries', () => {
    const segments: StateSegment[] = [];
    const timeSeries: TimeSeries[] = [];

    const result = computeSessionAggregateMetrics(segments, timeSeries);

    expect(result.bestStableDeviation).toBe(-Infinity);
    expect(result.nearBestStableTime).toBe(0);
    expect(result.qualityPercent).toBe(0);
  });

  it('should handle single-point timeSeries', () => {
    const segments: StateSegment[] = [
      {
        state: 'STABLE_DEVIATION',
        startTime: 0,
        endTime: 0,
        duration: 0,
        metrics: { meanDeviation: 1.0, medianDeviation: 1.0, minDeviation: 1.0, maxDeviation: 1.0, varianceWithinSegment: 0, stdDevWithinSegment: 0, intraSegmentSlope: 0 },
      },
    ];

    const timeSeries: TimeSeries[] = [{ t: 0, x: 1.0, y: 0, r: 0 }];

    const result = computeSessionAggregateMetrics(segments, timeSeries);

    expect(result.bestStableDeviation).toBe(1.0);
    expect(result.qualityPercent).toBeCloseTo(0, 1);
  });

  it('should prioritize FUSION over STABLE_DEVIATION', () => {
    const segments: StateSegment[] = [
      {
        state: 'STABLE_DEVIATION',
        startTime: 0,
        endTime: 5,
        duration: 5,
        metrics: { meanDeviation: 2.0, medianDeviation: 2.0, minDeviation: 1.5, maxDeviation: 2.5, varianceWithinSegment: 0.1, stdDevWithinSegment: 0.32, intraSegmentSlope: 0 },
      },
      {
        state: 'FUSION',
        startTime: 5,
        endTime: 7,
        duration: 2,
        metrics: { meanDeviation: 0.3, medianDeviation: 0.3, minDeviation: 0.1, maxDeviation: 0.5, varianceWithinSegment: 0.03, stdDevWithinSegment: 0.17, intraSegmentSlope: 0 },
      },
    ];

    const timeSeries: TimeSeries[] = [
      { t: 0, x: 2.0, y: 0, r: 0 },
      { t: 7000, x: 5.0, y: 0, r: 0 },
    ];

    const result = computeSessionAggregateMetrics(segments, timeSeries);

    expect(result.bestStableDeviation).toBe(0.3);
    expect(result.nearBestStableTime).toBe(2);
  });
});
