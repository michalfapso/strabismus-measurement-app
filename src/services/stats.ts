// src/services/stats.ts
import { Session } from '../types';

/**
 * Position range for a session
 */
export interface PositionRangeStats {
  xMin: number;
  xMax: number;
  xRange: number;
  yMin: number;
  yMax: number;
  yRange: number;
}

export function getPositionRange(session: Session): PositionRangeStats {
  if (session.timeSeries.length === 0) {
    throw new Error('Cannot calculate position range for empty session');
  }

  const xs = session.timeSeries.map((p) => p.x);
  const ys = session.timeSeries.map((p) => p.y);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  return {
    xMin,
    xMax,
    xRange: xMax - xMin,
    yMin,
    yMax,
    yRange: yMax - yMin,
  };
}

/**
 * Rotation range for a session
 */
export interface RotationRangeStats {
  rMin: number;
  rMax: number;
  range: number;
}

export function getRotationRange(session: Session): RotationRangeStats {
  if (session.timeSeries.length === 0) {
    throw new Error('Cannot calculate rotation range for empty session');
  }

  const rs = session.timeSeries.map((p) => p.r);
  const rMin = Math.min(...rs);
  const rMax = Math.max(...rs);

  return {
    rMin,
    rMax,
    range: rMax - rMin,
  };
}

/**
 * Duration in milliseconds from first to last point
 */
export function getSessionDuration(session: Session): number {
  if (session.timeSeries.length === 0) {
    return 0;
  }
  const first = session.timeSeries[0].t;
  const last = session.timeSeries[session.timeSeries.length - 1].t;
  return last - first;
}

/**
 * Mean distance from center (0, 0)
 */
export function getMeanDeviation(session: Session): number {
  if (session.timeSeries.length === 0) {
    return 0;
  }

  const distances = session.timeSeries.map((p) =>
    Math.sqrt(p.x * p.x + p.y * p.y)
  );
  const sum = distances.reduce((a, b) => a + b, 0);
  return sum / distances.length;
}

/**
 * Aggregate statistics across multiple sessions
 */
export interface AggregateStats {
  meanX: number;
  meanY: number;
  meanR: number;
  rotVariance: number;
  pointCount: number;
}

export function aggregateStats(sessions: Session[]): AggregateStats {
  const allPoints = sessions.flatMap((s) => s.timeSeries);

  if (allPoints.length === 0) {
    return {
      meanX: 0,
      meanY: 0,
      meanR: 0,
      rotVariance: 0,
      pointCount: 0,
    };
  }

  const meanX = allPoints.reduce((a, p) => a + p.x, 0) / allPoints.length;
  const meanY = allPoints.reduce((a, p) => a + p.y, 0) / allPoints.length;
  const meanR = allPoints.reduce((a, p) => a + p.r, 0) / allPoints.length;

  const rotVariance =
    allPoints.reduce((a, p) => a + Math.pow(p.r - meanR, 2), 0) /
    allPoints.length;

  return {
    meanX,
    meanY,
    meanR,
    rotVariance,
    pointCount: allPoints.length,
  };
}
