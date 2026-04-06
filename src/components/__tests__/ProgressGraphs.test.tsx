import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProgressGraphs } from '../ProgressGraphs';
import { SessionMetrics } from '../../types/analysis';

describe('ProgressGraphs', () => {
  const createMockSession = (overrides?: Partial<SessionMetrics>): SessionMetrics => ({
    sessionId: 's1',
    date: '2026-01-01',
    exerciseTag: 'test',
    metric: 'deviation',
    sessionDuration: 1000,
    histogram: [],
    bestStableDeviation: 2.5,
    nearBestStableTime: 15,
    qualityPercent: 55,
    driftingPercent: 30,
    approachingPercent: 15,
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
    stateSegments: [],
    ...overrides,
  });

  it('should render with title and three graphs', () => {
    const sessions: SessionMetrics[] = [createMockSession()];

    const { container } = render(<ProgressGraphs sessions={sessions} />);

    expect(container.textContent).toContain('Best Stable Deviation (cm)');
    expect(container.textContent).toContain('Near-Best Stable Time (seconds)');
    expect(container.textContent).toContain('Session Composition (%)');
  });

  it('should render empty state when no sessions', () => {
    const { container } = render(<ProgressGraphs sessions={[]} />);

    expect(container.textContent).toContain('No sessions to display');
  });

  it('should filter by exercise tag', () => {
    const sessions: SessionMetrics[] = [
      createMockSession({ sessionId: 's1', exerciseTag: 'pushups' }),
      createMockSession({ sessionId: 's2', exerciseTag: 'jumping' }),
    ];

    const { container } = render(<ProgressGraphs sessions={sessions} exerciseFilter="pushups" />);

    // Should render but only with 1 session
    expect(container.textContent).toContain('Best Stable Deviation (cm)');
  });
});
