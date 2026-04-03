import {
  getMetricValue,
  calculateFusionMetrics,
  calculateMinValue,
  calculateTimeToFirstFusion,
  calculateTrajectoryRatio,
  calculateLargeDeviationTimePercent,
  classifyStates,
  calculateFusionEventCount,
  calculateLongestFusionStreak,
  computeSessionMetrics,
} from '../sessionMetrics';
import { TimeSeries, Session } from '../../types';

describe('getMetricValue', () => {
  it('computes deviation as sqrt(x^2 + y^2)', () => {
    const point: TimeSeries = { t: 0, x: 3, y: 4, r: 0 };
    expect(getMetricValue(point, 'deviation')).toBe(5);
  });

  it('returns absolute value of rotation', () => {
    const point: TimeSeries = { t: 0, x: 0, y: 0, r: -45 };
    expect(getMetricValue(point, 'rotation')).toBe(45);
  });
});

describe('calculateFusionMetrics', () => {
  it('calculates fusion time for values below threshold', () => {
    const timeSeries: TimeSeries[] = [
      { t: 0, x: 0.2, y: 0.1, r: 0 },
      { t: 1000, x: 0.1, y: 0.2, r: 0 },
      { t: 2000, x: 1, y: 0, r: 0 },
    ];
    const metrics = calculateFusionMetrics(timeSeries, 0.5, 'deviation');
    expect(metrics.fusionTime).toBeCloseTo(2, 0);
    expect(metrics.fusionAchieved).toBe(true);
  });

  it('returns 0 fusion when all values exceed threshold', () => {
    const timeSeries: TimeSeries[] = [
      { t: 0, x: 2, y: 0, r: 0 },
      { t: 1000, x: 3, y: 0, r: 0 },
    ];
    const metrics = calculateFusionMetrics(timeSeries, 0.5, 'deviation');
    expect(metrics.fusionAchieved).toBe(false);
    expect(metrics.fusionTime).toBe(0);
  });
});

describe('calculateMinValue', () => {
  it('finds minimum value in series', () => {
    const timeSeries: TimeSeries[] = [
      { t: 0, x: 2, y: 0, r: 0 },
      { t: 1000, x: 0.3, y: 0.2, r: 0 },
      { t: 2000, x: 1, y: 0, r: 0 },
    ];
    const minValue = calculateMinValue(timeSeries, 'deviation');
    expect(minValue).toBeLessThan(1);
  });
});

describe('calculateTimeToFirstFusion', () => {
  it('returns time when fusion first achieved', () => {
    const timeSeries: TimeSeries[] = [
      { t: 0, x: 2, y: 0, r: 0 },
      { t: 2000, x: 1, y: 0, r: 0 },
      { t: 4000, x: 0.2, y: 0.1, r: 0 },
      { t: 5000, x: 0.1, y: 0, r: 0 },
    ];
    const ttf = calculateTimeToFirstFusion(timeSeries, 0.5, 'deviation');
    expect(ttf).toBeCloseTo(4, 0);
  });

  it('returns null when no fusion', () => {
    const timeSeries: TimeSeries[] = [
      { t: 0, x: 2, y: 0, r: 0 },
      { t: 1000, x: 1.5, y: 0, r: 0 },
    ];
    expect(calculateTimeToFirstFusion(timeSeries, 0.5, 'deviation')).toBeNull();
  });
});

describe('calculateTrajectoryRatio', () => {
  it('returns positive ratio when improving', () => {
    const timeSeries: TimeSeries[] = [
      { t: 0, x: 2, y: 0, r: 0 },
      { t: 1000, x: 1.5, y: 0, r: 0 },
      { t: 2000, x: 1, y: 0, r: 0 },
      { t: 3000, x: 0.5, y: 0, r: 0 },
      { t: 4000, x: 0.3, y: 0, r: 0 },
    ];
    const ratio = calculateTrajectoryRatio(timeSeries, 'deviation');
    expect(ratio).toBeGreaterThan(0);
  });

  it('returns null when first half mean ~0', () => {
    const timeSeries: TimeSeries[] = [
      { t: 0, x: 0.005, y: 0, r: 0 },
      { t: 1000, x: 0.001, y: 0, r: 0 },
      { t: 2000, x: 1, y: 0, r: 0 },
      { t: 3000, x: 2, y: 0, r: 0 },
    ];
    expect(calculateTrajectoryRatio(timeSeries, 'deviation')).toBeNull();
  });
});

describe('calculateLargeDeviationTimePercent', () => {
  it('calculates percentage of time above 2x threshold', () => {
    const timeSeries: TimeSeries[] = [
      { t: 0, x: 0.3, y: 0, r: 0 },
      { t: 2000, x: 1.5, y: 0, r: 0 },
      { t: 4000, x: 0.1, y: 0, r: 0 },
    ];
    const percent = calculateLargeDeviationTimePercent(timeSeries, 0.5, 'deviation');
    expect(percent).toBeCloseTo(50, 0);
  });
});

describe('FSM State Classification', () => {
  it('classifies fusion state below threshold', () => {
    const timeSeries: TimeSeries[] = [
      { t: 0, x: 0.2, y: 0.1, r: 0 },
      { t: 1000, x: 0.3, y: 0, r: 0 },
    ];
    const states = classifyStates(timeSeries, 0.5, 'deviation', 11);
    expect(states.length).toBeGreaterThan(0);
    expect(states[0].state).toBe('FUSION');
  });

  it('filters segments shorter than 0.25s (MIN_SEGMENT_DURATION)', () => {
    const timeSeries: TimeSeries[] = [
      { t: 0, x: 0.2, y: 0, r: 0 },
      { t: 100, x: 0.3, y: 0, r: 0 },
      { t: 1000, x: 2, y: 0, r: 0 },
      { t: 2000, x: 1.5, y: 0, r: 0 },
    ];
    const states = classifyStates(timeSeries, 0.5, 'deviation', 11);
    // All returned segments should be >= 0.25s (after stretching and merging)
    expect(states.every(s => s.duration >= 0.25)).toBe(true);
  });

  it('stretches neighboring segments to fill gaps from filtered short segments', () => {
    // Create a scenario: FUSION state (0.5s) -> SHORT UNSTABLE (0.1s, filtered) -> STABLE (0.5s)
    // Expected: After stretching and merging, we get segments without gaps
    const timeSeries: TimeSeries[] = [
      // 0-0.5s: below threshold (FUSION)
      { t: 0, x: 0.1, y: 0, r: 0 },
      { t: 500, x: 0.15, y: 0, r: 0 },
      // 0.5-0.6s: above threshold (STABLE_DEVIATION or DRIFTING) - very short, will be filtered
      { t: 500, x: 1.5, y: 0, r: 0 },
      { t: 600, x: 1.4, y: 0, r: 0 },
      // 0.6-1.1s: back below threshold (FUSION)
      { t: 600, x: 0.2, y: 0, r: 0 },
      { t: 1100, x: 0.18, y: 0, r: 0 },
    ];
    const states = classifyStates(timeSeries, 0.5, 'deviation', 11);

    // After stretching, segments should span the entire duration with no gaps
    const totalDuration = (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000;
    const coveredDuration = states.reduce((sum, seg) => sum + seg.duration, 0);
    expect(coveredDuration).toBeCloseTo(totalDuration, 2);
  });

  it('merges consecutive segments with the same state after stretching', () => {
    // Create a scenario where stretching causes adjacent segments of same type to meet
    // FUSION (0.5s) -> SHORT UNSTABLE (0.1s, filtered) -> FUSION (0.5s)
    // Expected: After stretching and merging, we get 1 FUSION segment, not 2
    const timeSeries: TimeSeries[] = [
      // 0-0.5s: below threshold (FUSION)
      { t: 0, x: 0.1, y: 0, r: 0 },
      { t: 100, x: 0.15, y: 0, r: 0 },
      { t: 200, x: 0.2, y: 0, r: 0 },
      { t: 300, x: 0.12, y: 0, r: 0 },
      { t: 500, x: 0.18, y: 0, r: 0 },
      // 0.5-0.6s: above threshold, short duration (will be filtered)
      { t: 500, x: 1.5, y: 0, r: 0 },
      { t: 600, x: 1.4, y: 0, r: 0 },
      // 0.6-1.1s: back below threshold (FUSION)
      { t: 600, x: 0.2, y: 0, r: 0 },
      { t: 700, x: 0.15, y: 0, r: 0 },
      { t: 800, x: 0.22, y: 0, r: 0 },
      { t: 1100, x: 0.19, y: 0, r: 0 },
    ];
    const states = classifyStates(timeSeries, 0.5, 'deviation', 11);

    // Find FUSION segments - after merging, there should be only one continuous FUSION segment
    const fusionSegments = states.filter(s => s.state === 'FUSION');
    expect(fusionSegments.length).toBe(1);
    expect(fusionSegments[0].duration).toBeCloseTo(1.1, 1);
  });
});

describe('Fusion Events & Streaks', () => {
  it('counts fusion events', () => {
    const segments = [
      { state: 'DRIFTING' as const, startTime: 0, endTime: 2, duration: 2 },
      { state: 'FUSION' as const, startTime: 2, endTime: 4, duration: 2 },
      { state: 'DRIFTING' as const, startTime: 4, endTime: 6, duration: 2 },
      { state: 'FUSION' as const, startTime: 6, endTime: 8, duration: 2 },
    ];
    expect(calculateFusionEventCount(segments)).toBe(2);
  });

  it('finds longest fusion streak', () => {
    const segments = [
      { state: 'FUSION' as const, startTime: 0, endTime: 3, duration: 3 },
      { state: 'NEAR_FUSION' as const, startTime: 3, endTime: 5, duration: 2 },
      { state: 'FUSION' as const, startTime: 5, endTime: 12, duration: 7 },
      { state: 'DRIFTING' as const, startTime: 12, endTime: 15, duration: 3 },
    ];
    expect(calculateLongestFusionStreak(segments)).toBe(7);
  });
});

describe('Full SessionMetrics Integration', () => {
  it('computes complete metrics from session', () => {
    const session: Session = {
      sessionId: 'test',
      timestamp: '2026-04-02T00:00:00Z',
      exerciseTag: 'Pencil Push-up',
      ppi: 96,
      timeSeries: Array.from({ length: 20 }, (_, i) => ({
        t: i * 1000,
        x: 2 - i * 0.1,
        y: 0,
        r: 0,
      })),
    };

    const metrics = computeSessionMetrics(
      session,
      { deviation: 0.5, rotation: 1 },
      'deviation'
    );

    expect(metrics.sessionId).toBe('test');
    expect(metrics.exerciseTag).toBe('Pencil Push-up');
    expect(metrics.sessionDuration).toBeCloseTo(19, 0);
    expect(typeof metrics.fusionTime).toBe('number');
    expect(Array.isArray(metrics.stateSegments)).toBe(true);
  });

  it('throws for sessions < 10 seconds', () => {
    const session: Session = {
      sessionId: 'short',
      timestamp: '2026-04-02T00:00:00Z',
      exerciseTag: 'Test',
      ppi: 96,
      timeSeries: [
        { t: 0, x: 0, y: 0, r: 0 },
        { t: 500, x: 0.5, y: 0, r: 0 },
      ],
    };

    expect(() =>
      computeSessionMetrics(session, { deviation: 0.5, rotation: 1 }, 'deviation')
    ).toThrow('Session duration must be at least 10 seconds');
  });
});
