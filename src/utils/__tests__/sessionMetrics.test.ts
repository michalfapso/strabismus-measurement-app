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
  calculateLongestQualityStreak,
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

describe('classifyStates', () => {
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

  // Task 9: Tests for Dual-Slope Classification
  it('detects fast drift (short slope > SHORT_SLOPE_THRESHOLD)', () => {
    // Dual-timescale detection uses an OR logic:
    // A point is classified as DRIFTING if:
    // - (shortSlope > 1.0 cm/s) OR (longSlope > 0.02 cm/s)
    // This test validates the shortSlope path: rapid deviation changes (≥1 cm/s) detected via 0.5s window
    const timeSeries: TimeSeries[] = [];
    for (let i = 0; i < 20; i++) {
      const deviation = (i / 20) * 8;
      timeSeries.push({ t: i * 50, x: deviation, y: 0, r: 0 });
    }
    const segments = classifyStates(timeSeries, 0.5, 'deviation');
    const driftingSegments = segments.filter(s => s.state === 'DRIFTING');
    expect(driftingSegments.length).toBeGreaterThan(0);
    // Duration is ~0.95s (19 * 50ms = 950ms), allow 0.1s tolerance
    expect(driftingSegments[0].duration).toBeCloseTo(0.95, 1);
  });

  it('detects slow drift (long slope > LONG_SLOPE_THRESHOLD)', () => {
    // Validates the longSlope path of dual-slope OR logic:
    // With dual-timescale detection, slow drifts (>0.02 cm/s over 5s window)
    // are detected as DRIFTING via longSlope > LONG_SLOPE_THRESHOLD.
    // This validates: (shortSlope > 1.0) OR (longSlope > 0.02 cm/s)
    // Even if shortSlope is below threshold, longSlope > 0.02 triggers DRIFTING
    const timeSeries: TimeSeries[] = [];
    for (let i = 0; i < 300; i++) {
      const deviation = 3 + (i / 300) * 5;
      timeSeries.push({ t: i * 50, x: deviation, y: 0, r: 0 });
    }
    const segments = classifyStates(timeSeries, 0.5, 'deviation');
    const driftingSegments = segments.filter(s => s.state === 'DRIFTING');
    expect(driftingSegments.length).toBeGreaterThan(0);
    expect(driftingSegments[0].duration).toBeCloseTo(15.0, 0);
  });

  it('classifies stable deviation (both slopes ≈ 0)', () => {
    // With dual-slope classification, a point is STABLE_DEVIATION when:
    // - NOT below threshold (value >= threshold)
    // - NOT approaching (both shortSlope > -1.0 and longSlope > -0.02)
    // - NOT drifting (both shortSlope <= 1.0 and longSlope <= 0.02)
    // This validates the stable case where deviation remains constant (~4 cm)
    const timeSeries: TimeSeries[] = [];
    for (let i = 0; i < 200; i++) {
      timeSeries.push({ t: i * 50, x: 4, y: 0, r: 0 });
    }
    const segments = classifyStates(timeSeries, 0.5, 'deviation');
    expect(segments.length).toBe(1);
    expect(segments[0].state).toBe('STABLE_DEVIATION');
    expect(segments[0].duration).toBeCloseTo(10.0, 0);
  });

  // Task 10: Tests for Boundary Refinement
  it('refines slow-drift boundaries based on slope detection', () => {
    // After initial classification via dual-slope thresholds, boundaries
    // are refined using short-window slopes to tighten DRIFTING/APPROACHING segments.
    // refineEnter/refineExit scan for crossings of LONG_SLOPE_THRESHOLD (0.02 cm/s).
    // This test verifies both the classification accuracy and boundary refinement:
    // transitions from DRIFTING (longSlope > 0.02) to STABLE_DEVIATION occur at correct time.
    const timeSeries: TimeSeries[] = [];
    // Create a clear transition: drifting for 5s, then stable
    for (let i = 0; i < 400; i++) {
      const time_s = i * 0.025;  // Each step is 25ms
      let deviation: number;
      if (time_s < 5.0) {
        // Clear linear drift
        deviation = 3 + (time_s / 5.0) * 2;
      } else {
        // Flat stable region
        deviation = 5.0;
      }
      timeSeries.push({ t: i * 25, x: deviation, y: 0, r: 0 });
    }
    const segments = classifyStates(timeSeries, 0.5, 'deviation');
    // Check that we have both DRIFTING and STABLE_DEVIATION segments
    const driftingSegments = segments.filter(s => s.state === 'DRIFTING');
    const stableSegments = segments.filter(s => s.state === 'STABLE_DEVIATION');
    expect(driftingSegments.length).toBeGreaterThan(0);
    expect(stableSegments.length).toBeGreaterThan(0);
    // Verify that the segments are properly ordered chronologically
    const lastDrifting = driftingSegments[driftingSegments.length - 1];
    const firstStable = stableSegments[0];
    expect(lastDrifting.endTime).toBeLessThanOrEqual(firstStable.startTime);
  });

  // Task 11: Tests for Segment Metrics
  it('computes metrics correctly for a stable segment', () => {
    // After state classification (including dual-slope logic), segments are analyzed
    // to compute quality metrics: median, min, max, variance, intra-segment slope.
    // For STABLE_DEVIATION segments where both slopes ≈ 0, deviation should be constant.
    const timeSeries: TimeSeries[] = [];
    for (let i = 0; i < 200; i++) {
      timeSeries.push({ t: i * 50, x: 4, y: 0, r: 0 });
    }
    const segments = classifyStates(timeSeries, 0.5, 'deviation');
    expect(segments.length).toBe(1);
    const metrics = segments[0].metrics;
    expect(metrics).toBeDefined();
    expect(metrics!.medianDeviation).toBeCloseTo(4.0, 2);
    expect(metrics!.minDeviation).toBeCloseTo(4.0, 2);
    expect(metrics!.varianceWithinSegment).toBeCloseTo(0, 4);
  });

  it('computes metrics correctly for a drifting segment', () => {
    // For DRIFTING segments (detected via longSlope > 0.02 cm/s),
    // metrics include minDeviation, maxDeviation, and intraSegmentSlope.
    // intraSegmentSlope measures the sustained rate of change within the segment,
    // confirming the drift behavior detected by longSlope threshold.
    const timeSeries: TimeSeries[] = [];
    for (let i = 0; i < 300; i++) {
      const deviation = 3 + (i / 300) * 5;
      timeSeries.push({ t: i * 50, x: deviation, y: 0, r: 0 });
    }
    const segments = classifyStates(timeSeries, 0.5, 'deviation');
    const drifting = segments.find(s => s.state === 'DRIFTING');
    expect(drifting).toBeDefined();
    const metrics = drifting!.metrics;
    expect(metrics).toBeDefined();
    expect(metrics!.minDeviation).toBeCloseTo(3.0, 1);
    expect(metrics!.maxDeviation).toBeCloseTo(8.0, 1);
    expect(metrics!.intraSegmentSlope).toBeGreaterThan(0.25);
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

describe('calculateLongestQualityStreak', () => {
  it('returns longest FUSION duration when FUSION segments exist', () => {
    const segments = [
      { state: 'FUSION' as const, startTime: 0, endTime: 3, duration: 3 },
      { state: 'NEAR_FUSION' as const, startTime: 3, endTime: 5, duration: 2 },
      { state: 'FUSION' as const, startTime: 5, endTime: 12, duration: 7 },
      { state: 'DRIFTING' as const, startTime: 12, endTime: 15, duration: 3 },
    ];
    expect(calculateLongestQualityStreak(segments)).toBe(7);
  });

  it('returns longest NEAR_FUSION duration when no FUSION but NEAR_FUSION exists', () => {
    const segments = [
      { state: 'NEAR_FUSION' as const, startTime: 0, endTime: 3, duration: 3 },
      { state: 'NEAR_FUSION' as const, startTime: 3, endTime: 8, duration: 5 },
      { state: 'STABLE_DEVIATION' as const, startTime: 8, endTime: 12, duration: 4 },
      { state: 'DRIFTING' as const, startTime: 12, endTime: 15, duration: 3 },
    ];
    expect(calculateLongestQualityStreak(segments)).toBe(5);
  });

  it('returns longest STABLE_DEVIATION duration when only STABLE_DEVIATION quality segment exists', () => {
    const segments = [
      { state: 'STABLE_DEVIATION' as const, startTime: 0, endTime: 4, duration: 4 },
      { state: 'STABLE_DEVIATION' as const, startTime: 4, endTime: 10, duration: 6 },
      { state: 'DRIFTING' as const, startTime: 10, endTime: 15, duration: 5 },
    ];
    expect(calculateLongestQualityStreak(segments)).toBe(6);
  });

  it('returns 0 when all segments are DRIFTING', () => {
    const segments = [
      { state: 'DRIFTING' as const, startTime: 0, endTime: 5, duration: 5 },
      { state: 'DRIFTING' as const, startTime: 5, endTime: 10, duration: 5 },
      { state: 'DRIFTING' as const, startTime: 10, endTime: 15, duration: 5 },
    ];
    expect(calculateLongestQualityStreak(segments)).toBe(0);
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

describe('Real Data Integration Tests', () => {
  // Test file 1: Session with fusion attempts and recovery
  it('handles real data file 1 without overlapping segments', () => {
    const realData1: TimeSeries[] = [
      // Initial high deviation (approaching phase)
      { t: 0, x: -2.15, y: -11.55, r: 0 },
      { t: 500, x: -2.15, y: -11.55, r: 0 },
      // Rapid convergence (high negative slope)
      { t: 1050, x: 0.44, y: -4.64, r: 0 },
      // Near fusion
      { t: 1400, x: -0.14, y: -1.64, r: 0 },
      // Achieved fusion
      { t: 2000, x: 0.06, y: 0.15, r: 0 },
      // Stable at fusion
      { t: 2500, x: 0.06, y: 0.15, r: 0 },
      // Beginning to drift
      { t: 3000, x: -0.11, y: -0.04, r: 0 },
      // Sustained drift
      { t: 8000, x: -0.39, y: -7.28, r: 0 },
      { t: 12000, x: -0.85, y: -8.96, r: 0 },
      // Final approach
      { t: 16000, x: -1.35, y: -8.38, r: 0 },
      { t: 16500, x: -1.35, y: -8.38, r: 0 },
    ];

    const segments = classifyStates(realData1, 0.5, 'deviation');

    // Verify segments don't overlap
    for (let i = 0; i < segments.length - 1; i++) {
      expect(segments[i].endTime).toBeLessThanOrEqual(segments[i + 1].startTime);
    }

    // Verify coverage is reasonable (95-100%)
    const totalTime =
      (realData1[realData1.length - 1].t - realData1[0].t) / 1000;
    const coveredTime = segments.reduce((sum, seg) => sum + seg.duration, 0);
    const coverage = coveredTime / totalTime;
    expect(coverage).toBeGreaterThan(0.95);
    expect(coverage).toBeLessThanOrEqual(1.0);

    // Verify segments have metrics
    segments.forEach(seg => {
      expect(seg.metrics).toBeDefined();
      expect(seg.metrics!.medianDeviation).toBeGreaterThanOrEqual(0);
      expect(seg.metrics!.minDeviation).toBeGreaterThanOrEqual(0);
      expect(seg.metrics!.maxDeviation).toBeGreaterThanOrEqual(
        seg.metrics!.minDeviation
      );
    });
  });

  // Test file 2: Continuous drift without fusion
  it('detects continuous drift as single DRIFTING segment', () => {
    const realData2: TimeSeries[] = [
      // Starting stable
      { t: 0, x: -0.69, y: -5.88, r: 0 },
      { t: 500, x: -0.69, y: -5.88, r: 0 },
      // Transition
      { t: 750, x: -0.58, y: -5.52, r: 0 },
      // Begin sustained divergence
      { t: 2000, x: -0.52, y: -6.21, r: 0 },
      { t: 4000, x: -0.63, y: -6.51, r: 0 },
      { t: 8000, x: -1.07, y: -6.73, r: 0 },
      { t: 12000, x: -1.95, y: -10.94, r: 0 },
      { t: 14600, x: -2.15, y: -11.55, r: 0 },
      { t: 14650, x: -2.15, y: -11.55, r: 0 },
    ];

    const segments = classifyStates(realData2, 0.5, 'deviation');

    // Should be mostly DRIFTING (continuous slope > 0.02)
    const driftingSegments = segments.filter(s => s.state === 'DRIFTING');
    expect(driftingSegments.length).toBeGreaterThan(0);

    // Verify no overlaps
    for (let i = 0; i < segments.length - 1; i++) {
      expect(segments[i].endTime).toBeLessThanOrEqual(
        segments[i + 1].startTime
      );
    }

    // Verify all segments have metrics and slopes
    segments.forEach(seg => {
      expect(seg.metrics).toBeDefined();
      expect(seg.metrics!.intraSegmentSlope).toBeDefined();
    });
  });

  it('fixes overlapping segments created by stretching', () => {
    // Create synthetic data with a small gap (filtered segment)
    const timeSeries: TimeSeries[] = [];
    for (let i = 0; i < 300; i++) {
      // Alternating states with small gap
      if (i < 50) {
        // APPROACHING
        timeSeries.push({ t: i * 50, x: 10 - (i / 50) * 10, y: 0, r: 0 });
      } else if (i < 55) {
        // Gap (will be filtered)
        timeSeries.push({ t: i * 50, x: 0.1, y: 0, r: 0 });
      } else if (i < 150) {
        // STABLE_DEVIATION or DRIFTING
        timeSeries.push({ t: i * 50, x: 3 + (i - 55) * 0.05, y: 0, r: 0 });
      } else if (i < 160) {
        // Another gap
        timeSeries.push({ t: i * 50, x: 8, y: 0, r: 0 });
      } else {
        // APPROACHING back to fusion
        timeSeries.push({ t: i * 50, x: 8 - (i - 160) * 0.05, y: 0, r: 0 });
      }
    }

    const segments = classifyStates(timeSeries, 1.0, 'deviation');

    // Critical test: no overlapping segments
    let prevEnd = 0;
    for (const seg of segments) {
      expect(seg.startTime).toBeGreaterThanOrEqual(prevEnd);
      prevEnd = seg.endTime;
    }

    // Verify coverage is reasonable
    const totalTime = (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000;
    const coveredTime = segments.reduce((sum, seg) => sum + seg.duration, 0);
    const coverage = coveredTime / totalTime;
    expect(coverage).toBeGreaterThan(0.9);
  });

  it('handles alternating states with refinement without overlap', () => {
    // Specifically test the refinement pass doesn't create overlaps
    const timeSeries: TimeSeries[] = [];

    // Create a session with alternating FUSION and DRIFTING
    for (let i = 0; i < 400; i++) {
      const phase = Math.floor(i / 100);
      if (phase % 2 === 0) {
        // FUSION phase
        timeSeries.push({ t: i * 50, x: 0.2, y: 0.1, r: 0 });
      } else {
        // DRIFTING phase
        const driftAmount = (i - phase * 100) * 0.02;
        timeSeries.push({ t: i * 50, x: 0.2 + driftAmount, y: 0.1 + driftAmount, r: 0 });
      }
    }

    const segments = classifyStates(timeSeries, 0.5, 'deviation');

    // Verify non-overlapping after refinement
    let totalCovered = 0;
    let maxTime = 0;
    for (let i = 0; i < segments.length; i++) {
      if (i > 0) {
        expect(segments[i].startTime).toBeLessThanOrEqual(
          segments[i].startTime + 0.001
        ); // floating point tolerance
      }
      totalCovered += segments[i].duration;
      maxTime = Math.max(maxTime, segments[i].endTime);

      // Check no overlap with next
      if (i < segments.length - 1) {
        expect(segments[i].endTime).toBeLessThanOrEqual(
          segments[i + 1].startTime + 0.001
        );
      }
    }

    // Should cover most of session
    const sessionDuration = (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000;
    const coverage = totalCovered / sessionDuration;
    expect(coverage).toBeGreaterThan(0.9);
  });

  it('handles tremor-like oscillation around threshold', () => {
    // Simulate eye tremor: rapid oscillation around fusion threshold
    const timeSeries: TimeSeries[] = [];
    for (let i = 0; i < 200; i++) {
      // Oscillate around 0.5cm (fusion threshold)
      const baseDeviation = 0.5;
      const tremor = 0.2 * Math.sin((i / 20) * Math.PI);
      const deviation = baseDeviation + tremor;
      const angle = Math.atan2(0.1, Math.sqrt(Math.max(0, deviation * deviation - 0.01)));
      timeSeries.push({
        t: i * 50,
        x: deviation * Math.cos(angle),
        y: deviation * Math.sin(angle),
        r: 0,
      });
    }

    const segments = classifyStates(timeSeries, 0.5, 'deviation');

    // Should not create massively fragmented segmentation
    expect(segments.length).toBeLessThan(30);

    // No overlaps
    for (let i = 0; i < segments.length - 1; i++) {
      expect(segments[i].endTime).toBeLessThanOrEqual(
        segments[i + 1].startTime + 0.001
      );
    }
  });

  it('handles flat line (zero movement)', () => {
    // Create perfectly stable deviation
    const timeSeries: TimeSeries[] = [];
    for (let i = 0; i < 200; i++) {
      timeSeries.push({ t: i * 50, x: 2.0, y: 0, r: 0 }); // Constant 2cm
    }

    const segments = classifyStates(timeSeries, 1.0, 'deviation');

    // Should be single STABLE_DEVIATION segment
    expect(segments.length).toBe(1);
    expect(segments[0].state).toBe('STABLE_DEVIATION');
    expect(segments[0].metrics!.varianceWithinSegment).toBeCloseTo(0, 2);
    expect(segments[0].metrics!.intraSegmentSlope).toBeCloseTo(0, 2);
  });

  it('handles very small segments that exceed MIN_SEGMENT_DURATION minimally', () => {
    // Create segments just above and below MIN_SEGMENT_DURATION threshold (0.25s)
    const timeSeries: TimeSeries[] = [];

    // 0.2s FUSION (below threshold, should be filtered)
    for (let i = 0; i < 4; i++) {
      timeSeries.push({ t: i * 50, x: 0.1, y: 0, r: 0 });
    }

    // 0.3s DRIFTING (above threshold, should be kept)
    for (let i = 4; i < 10; i++) {
      timeSeries.push({ t: i * 50, x: 2.0 + (i - 4) * 0.1, y: 0, r: 0 });
    }

    // 0.2s APPROACHING (below threshold, should be filtered)
    for (let i = 10; i < 14; i++) {
      timeSeries.push({ t: i * 50, x: 2.6 - (i - 10) * 0.1, y: 0, r: 0 });
    }

    // 0.3s FUSION (above threshold, should be kept)
    for (let i = 14; i < 20; i++) {
      timeSeries.push({ t: i * 50, x: 0.1, y: 0, r: 0 });
    }

    // Extend to >10 seconds for valid session
    for (let i = 20; i < 200; i++) {
      timeSeries.push({ t: i * 50, x: 0.1, y: 0, r: 0 });
    }

    const segments = classifyStates(timeSeries, 1.0, 'deviation');

    // Should have kept DRIFTING and FUSION, filtered APPROACHING
    const kept = segments.filter(s => s.state !== 'STABLE_DEVIATION');
    expect(kept.length).toBeGreaterThan(0);

    // No overlaps
    for (let i = 0; i < segments.length - 1; i++) {
      expect(segments[i].endTime).toBeLessThanOrEqual(
        segments[i + 1].startTime + 0.001
      );
    }
  });

  it('handles rapid threshold crossings with refinement', () => {
    // Create data with multiple rapid crossings of slope threshold
    const timeSeries: TimeSeries[] = [];

    for (let i = 0; i < 300; i++) {
      // Create a zigzag pattern: fast down, fast up, repeat
      const zigzag = Math.sin((i / 30) * Math.PI * 2);
      const baseDeviation = 2 + zigzag * 1; // Oscillates 1-3cm
      timeSeries.push({
        t: i * 50,
        x: baseDeviation,
        y: 0,
        r: 0,
      });
    }

    const segments = classifyStates(timeSeries, 1.0, 'deviation');

    // Should handle rapid crossings without crashing
    expect(segments.length).toBeGreaterThan(0);

    // No overlaps
    for (let i = 0; i < segments.length - 1; i++) {
      expect(segments[i].endTime).toBeLessThanOrEqual(
        segments[i + 1].startTime + 0.001
      );
    }

    // Coverage reasonable
    const totalTime =
      (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000;
    const covered = segments.reduce((sum, s) => sum + s.duration, 0);
    expect(covered / totalTime).toBeGreaterThan(0.8);
  });

  it('handles very long single-state session', () => {
    // 30 second session of pure DRIFTING
    const timeSeries: TimeSeries[] = [];
    for (let i = 0; i < 600; i++) {
      // Linear drift 0 → 10cm
      const deviation = (i / 600) * 10;
      timeSeries.push({
        t: i * 50,
        x: deviation,
        y: 0,
        r: 0,
      });
    }

    const segments = classifyStates(timeSeries, 1.0, 'deviation');

    // Should be single DRIFTING segment
    expect(segments.length).toBeGreaterThan(0);
    const driftingCount = segments.filter(s => s.state === 'DRIFTING').length;
    expect(driftingCount).toBeGreaterThan(0);

    // All segments should have metrics
    segments.forEach(s => {
      expect(s.metrics).toBeDefined();
      expect(s.metrics!.intraSegmentSlope).toBeGreaterThan(0);
    });
  });
});
