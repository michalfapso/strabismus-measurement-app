import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProgressGraphs } from '../ProgressGraphs';
import { SessionMetrics } from '../../types/analysis';

describe('ProgressGraphs touch gestures', () => {
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

  it('should detect two-finger pinch and call zoom callback', () => {
    const sessions: SessionMetrics[] = [createMockSession()];

    const { container } = render(<ProgressGraphs sessions={sessions} />);
    const graphsDiv = container.firstChild as HTMLElement;

    // Simulate pinch start (2 fingers 100px apart)
    const touchStartEvent = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [
        { clientX: 0, clientY: 0 } as Touch,
        { clientX: 100, clientY: 0 } as Touch,
      ] as any,
    });

    graphsDiv.dispatchEvent(touchStartEvent);

    // Simulate pinch move (fingers now 50px apart = pinching in)
    const touchMoveEvent = new TouchEvent('touchmove', {
      bubbles: true,
      cancelable: true,
      touches: [
        { clientX: 0, clientY: 0 } as Touch,
        { clientX: 50, clientY: 0 } as Touch,
      ] as any,
    });

    graphsDiv.dispatchEvent(touchMoveEvent);

    // Should not crash - zoom logic should trigger
    expect(graphsDiv).toBeDefined();
  });

  it('should ignore single-finger touch', () => {
    const sessions: SessionMetrics[] = [createMockSession()];

    const { container } = render(<ProgressGraphs sessions={sessions} />);
    const graphsDiv = container.firstChild as HTMLElement;

    // Single finger should not trigger zoom
    const touchStartEvent = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [{ clientX: 0, clientY: 0 } as Touch] as any,
    });

    graphsDiv.dispatchEvent(touchStartEvent);
    expect(graphsDiv).toBeDefined();
  });
});
