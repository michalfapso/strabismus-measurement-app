import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SubScoresPanel from '../SubScoresPanel';
import { SessionMetrics, HistogramBin, StateSegment } from '../../types/analysis';

/**
 * Helper function to create mock SessionMetrics
 */
function createMockMetrics(overrides?: Partial<SessionMetrics>): SessionMetrics {
  const defaultMetrics: SessionMetrics = {
    sessionId: 'test-session-1',
    date: '2026-04-15',
    exerciseTag: 'Pencil Push-ups',
    metric: 'deviation',
    sessionDuration: 300,
    histogram: [] as HistogramBin[],
    bestStableDeviation: 0.5,
    nearBestStableTime: 0,
    qualityPercent: 40.0,
    driftingPercent: 20.0,
    approachingPercent: 15.0,
    timeToFirstFusion: 10.5,
    fusionEventCount: 5,
    longestFusionStreak: 45.0,
    largeDeviationTimePercent: 20.0,
    trajectoryRatio: 0.05,
    fusionTime: 120,
    fusionTimePercent: 40.0,
    fusionAchieved: true,
    nearFusionTime: 60,
    nearFusionTimePercent: 20.0,
    largeDeviationTime: 60,
    stateSegments: [] as StateSegment[],
  };

  return { ...defaultMetrics, ...overrides };
}

describe('SubScoresPanel', () => {
  it('should display near-best stable time when fusion is achieved', () => {
    const metrics = createMockMetrics({
      fusionAchieved: true,
      nearBestStableTime: 45.3,
    });

    const { container } = render(<SubScoresPanel metrics={metrics} />);

    expect(container.textContent).toContain('Near-best stable time');
    expect(container.textContent).toContain('45.3s');
  });

  it('should display near-best stable time regardless of fusion status', () => {
    const metrics = createMockMetrics({
      fusionAchieved: false,
      nearBestStableTime: 20.5,
    });

    const { container } = render(<SubScoresPanel metrics={metrics} />);

    expect(container.textContent).toContain('Near-best stable time');
    expect(container.textContent).toContain('20.5s');
  });
});
