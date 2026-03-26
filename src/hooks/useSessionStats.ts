// src/hooks/useSessionStats.ts
import { useMemo } from 'react';
import { Session } from '../types';
import {
  getPositionRange,
  getRotationRange,
  getSessionDuration,
  getMeanDeviation,
  aggregateStats,
  PositionRangeStats,
  RotationRangeStats,
  AggregateStats,
} from '../services/stats';

/**
 * All calculated stats for a session
 */
export interface SessionStats {
  positionRange?: PositionRangeStats;
  rotationRange?: RotationRangeStats;
  duration: number;
  meanDeviation: number;
}

/**
 * Hook to memoize session stat calculations
 */
export function useSessionStats(session: Session | null): SessionStats {
  return useMemo(() => {
    if (!session || session.timeSeries.length === 0) {
      return {
        duration: 0,
        meanDeviation: 0,
      };
    }

    try {
      return {
        positionRange: getPositionRange(session),
        rotationRange: getRotationRange(session),
        duration: getSessionDuration(session),
        meanDeviation: getMeanDeviation(session),
      };
    } catch (error) {
      console.warn('Error calculating session stats:', error);
      return {
        duration: 0,
        meanDeviation: 0,
      };
    }
  }, [session]);
}

/**
 * Hook to memoize aggregate stat calculations
 */
export function useAggregateStats(sessions: Session[]): AggregateStats {
  return useMemo(() => {
    if (sessions.length === 0) {
      return {
        meanX: 0,
        meanY: 0,
        meanR: 0,
        rotVariance: 0,
        pointCount: 0,
      };
    }

    return aggregateStats(sessions);
  }, [sessions]);
}
