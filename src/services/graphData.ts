// src/services/graphData.ts
import { Session, TimeSeries } from '../types';

/**
 * Format a single session's time-series for recharts line chart
 */
export interface SessionGraphPoint {
  time: number;
  x: number;
  y: number;
  r: number;
  timeFormatted: string;
}

export function prepareSessionGraphData(
  session: Session
): SessionGraphPoint[] {
  return session.timeSeries.map((point) => ({
    time: point.t,
    x: point.x,
    y: point.y,
    r: point.r,
    timeFormatted: formatTime(point.t),
  }));
}

/**
 * Format multiple sessions for overlay visualization
 */
export interface AggregateGraphPoint extends TimeSeries {
  sessionId: string;
  sessionIndex: number;
  timeFormatted: string;
}

export interface AggregateGraphData {
  points: AggregateGraphPoint[];
  aggregateLine: SessionGraphPoint[];
}

export function prepareAggregateGraphData(
  sessions: Session[]
): AggregateGraphData {
  const points: AggregateGraphPoint[] = sessions.flatMap((session, idx) =>
    session.timeSeries.map((point) => ({
      ...point,
      sessionId: session.sessionId,
      sessionIndex: idx,
      timeFormatted: formatTime(point.t),
    }))
  );

  // Calculate aggregate (moving average for smoothing)
  const allPoints = points.map((p) => ({
    t: p.t,
    x: p.x,
    y: p.y,
    r: p.r,
  }));

  const aggregateLine = calculateMovingAverage(allPoints, 5);

  return { points, aggregateLine };
}

/**
 * Calculate moving average for smoothing data
 */
export function calculateMovingAverage(
  points: TimeSeries[],
  windowSize: number
): SessionGraphPoint[] {
  if (points.length === 0) return [];

  return points.map((point, idx) => {
    // Only apply moving average starting from position (windowSize - 1)
    if (idx < windowSize - 1) {
      return {
        time: point.t,
        x: point.x,
        y: point.y,
        r: point.r,
        timeFormatted: formatTime(point.t),
      };
    }

    // Calculate backward-looking moving average
    const start = idx - windowSize + 1;
    const end = idx + 1;
    const window = points.slice(start, end);

    const avgX = window.reduce((a, p) => a + p.x, 0) / window.length;
    const avgY = window.reduce((a, p) => a + p.y, 0) / window.length;
    const avgR = window.reduce((a, p) => a + p.r, 0) / window.length;

    return {
      time: point.t,
      x: avgX,
      y: avgY,
      r: avgR,
      timeFormatted: formatTime(point.t),
    };
  });
}

/**
 * Format milliseconds as human-readable time string
 */
function formatTime(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  const minutes = seconds / 60;
  return `${minutes.toFixed(2)}m`;
}
