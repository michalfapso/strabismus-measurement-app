// src/__tests__/services/stats.test.ts
import { describe, it, expect } from 'vitest';
import {
  getPositionRange,
  getRotationRange,
  getSessionDuration,
  getMeanDeviation,
  aggregateStats,
} from '../../services/stats';
import { Session, TimeSeries } from '../../types';

// Helper to create a test session
function createTestSession(points: TimeSeries[]): Session {
  return {
    sessionId: 'test-1',
    timestamp: '2026-03-26T10:00:00Z',
    exerciseTag: 'Pencil Push-ups',
    ppi: 96,
    timeSeries: points,
  };
}

describe('stats', () => {
  describe('getPositionRange', () => {
    it('should calculate x and y ranges correctly', () => {
      const session = createTestSession([
        { t: 0, x: 0.5, y: 0.3, r: 0 },
        { t: 100, x: 2.1, y: 1.8, r: 0 },
        { t: 200, x: 1.2, y: 0.9, r: 0 },
      ]);
      const range = getPositionRange(session);
      expect(range.xMin).toBe(0.5);
      expect(range.xMax).toBe(2.1);
      expect(range.xRange).toBe(1.6);
      expect(range.yMin).toBe(0.3);
      expect(range.yMax).toBe(1.8);
      expect(range.yRange).toBe(1.5);
    });

    it('should handle single point', () => {
      const session = createTestSession([{ t: 0, x: 1.0, y: 1.0, r: 0 }]);
      const range = getPositionRange(session);
      expect(range.xRange).toBe(0);
      expect(range.yRange).toBe(0);
    });

    it('should handle empty timeseries', () => {
      const session = createTestSession([]);
      expect(() => getPositionRange(session)).toThrow();
    });
  });

  describe('getRotationRange', () => {
    it('should calculate rotation range correctly', () => {
      const session = createTestSession([
        { t: 0, x: 0, y: 0, r: -5.2 },
        { t: 100, x: 0, y: 0, r: 8.4 },
        { t: 200, x: 0, y: 0, r: 0 },
      ]);
      const range = getRotationRange(session);
      expect(range.rMin).toBe(-5.2);
      expect(range.rMax).toBe(8.4);
      expect(range.range).toBeCloseTo(13.6);
    });

    it('should handle empty timeseries', () => {
      const session = createTestSession([]);
      expect(() => getRotationRange(session)).toThrow();
    });
  });

  describe('getSessionDuration', () => {
    it('should calculate duration in milliseconds', () => {
      const session = createTestSession([
        { t: 0, x: 0, y: 0, r: 0 },
        { t: 1000, x: 0, y: 0, r: 0 },
        { t: 15000, x: 0, y: 0, r: 0 },
      ]);
      const duration = getSessionDuration(session);
      expect(duration).toBe(15000);
    });

    it('should return 0 for empty timeseries', () => {
      const session = createTestSession([]);
      expect(getSessionDuration(session)).toBe(0);
    });
  });

  describe('getMeanDeviation', () => {
    it('should calculate mean distance from center', () => {
      const session = createTestSession([
        { t: 0, x: 3, y: 4, r: 0 }, // distance = 5
        { t: 100, x: 0, y: 0, r: 0 }, // distance = 0
      ]);
      const deviation = getMeanDeviation(session);
      expect(deviation).toBe(2.5);
    });

    it('should handle single point at origin', () => {
      const session = createTestSession([{ t: 0, x: 0, y: 0, r: 0 }]);
      const deviation = getMeanDeviation(session);
      expect(deviation).toBe(0);
    });
  });

  describe('aggregateStats', () => {
    it('should aggregate stats across multiple sessions', () => {
      const sessions = [
        createTestSession([
          { t: 0, x: 1, y: 1, r: 2 },
          { t: 100, x: 2, y: 2, r: 4 },
        ]),
        createTestSession([
          { t: 0, x: 3, y: 3, r: 0 },
          { t: 100, x: 4, y: 4, r: 2 },
        ]),
      ];
      const agg = aggregateStats(sessions);
      expect(agg.meanX).toBe(2.5); // (1+2+3+4)/4
      expect(agg.meanY).toBe(2.5);
      expect(agg.meanR).toBe(2); // (2+4+0+2)/4
      expect(agg.pointCount).toBe(4);
    });

    it('should calculate rotation variance', () => {
      const sessions = [
        createTestSession([{ t: 0, x: 0, y: 0, r: 0 }]),
        createTestSession([{ t: 0, x: 0, y: 0, r: 4 }]),
      ];
      const agg = aggregateStats(sessions);
      const expectedMeanR = 2;
      const expectedVariance = ((0 - 2) ** 2 + (4 - 2) ** 2) / 2; // = 4
      expect(agg.rotVariance).toBe(expectedVariance);
    });
  });
});
