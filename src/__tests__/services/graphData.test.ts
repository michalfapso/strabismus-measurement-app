// src/__tests__/services/graphData.test.ts
import { describe, it, expect } from 'vitest';
import {
  prepareSessionGraphData,
  prepareAggregateGraphData,
  calculateMovingAverage,
} from '../../services/graphData';
import { Session, TimeSeries } from '../../types';

function createTestSession(
  id: string,
  points: TimeSeries[]
): Session {
  return {
    sessionId: id,
    timestamp: '2026-03-26T10:00:00Z',
    exerciseTag: 'Test',
    ppi: 96,
    timeSeries: points,
  };
}

describe('graphData', () => {
  describe('prepareSessionGraphData', () => {
    it('should format single session for line chart', () => {
      const session = createTestSession('test-1', [
        { t: 0, x: 0.5, y: 0.3, r: 0 },
        { t: 100, x: 1.0, y: 0.8, r: 2 },
        { t: 200, x: 0.8, y: 0.5, r: 1 },
      ]);

      const data = prepareSessionGraphData(session);
      expect(data).toHaveLength(3);
      expect(data[0]).toEqual({
        time: 0,
        x: 0.5,
        y: 0.3,
        r: 0,
        timeFormatted: '0.00s',
      });
      expect(data[1].time).toBe(100);
      expect(data[2].r).toBe(1);
    });

    it('should handle empty session', () => {
      const session = createTestSession('test-1', []);
      const data = prepareSessionGraphData(session);
      expect(data).toEqual([]);
    });
  });

  describe('calculateMovingAverage', () => {
    it('should smooth data with 3-point moving average', () => {
      const points = [
        { t: 0, x: 1, y: 1, r: 0 },
        { t: 1, x: 2, y: 2, r: 2 },
        { t: 2, x: 3, y: 3, r: 4 },
        { t: 3, x: 4, y: 4, r: 6 },
        { t: 4, x: 5, y: 5, r: 8 },
      ];

      const smoothed = calculateMovingAverage(points, 3);
      // First two points unchanged
      expect(smoothed[0].x).toBe(1);
      expect(smoothed[1].x).toBe(2);
      // Third point: (1+2+3)/3 = 2
      expect(smoothed[2].x).toBe(2);
      // Fourth point: (2+3+4)/3 = 3
      expect(smoothed[3].x).toBe(3);
    });

    it('should handle window size larger than data', () => {
      const points = [
        { t: 0, x: 1, y: 1, r: 0 },
        { t: 1, x: 2, y: 2, r: 2 },
      ];

      const smoothed = calculateMovingAverage(points, 5);
      expect(smoothed).toHaveLength(2);
    });
  });

  describe('prepareAggregateGraphData', () => {
    it('should overlay multiple sessions with aggregate line', () => {
      const sessions = [
        createTestSession('test-1', [
          { t: 0, x: 1, y: 1, r: 0 },
          { t: 100, x: 2, y: 2, r: 2 },
        ]),
        createTestSession('test-2', [
          { t: 0, x: 3, y: 3, r: 4 },
          { t: 100, x: 4, y: 4, r: 6 },
        ]),
      ];

      const data = prepareAggregateGraphData(sessions);
      expect(data.points).toHaveLength(4);
      expect(data.aggregateLine).toBeDefined();

      // Check that sessionId and sessionIndex are attached
      expect(data.points[0].sessionId).toBe('test-1');
      expect(data.points[0].sessionIndex).toBe(0);
      expect(data.points[2].sessionId).toBe('test-2');
      expect(data.points[2].sessionIndex).toBe(1);
    });

    it('should calculate aggregate line correctly', () => {
      const sessions = [
        createTestSession('test-1', [
          { t: 0, x: 2, y: 2, r: 0 },
          { t: 100, x: 4, y: 4, r: 2 },
          { t: 200, x: 6, y: 6, r: 4 },
        ]),
      ];

      const data = prepareAggregateGraphData(sessions);
      expect(data.aggregateLine).toBeDefined();
      expect(data.aggregateLine.length).toBeGreaterThan(0);
    });
  });
});
