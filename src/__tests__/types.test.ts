import { describe, it, expect } from 'vitest';
import { Session, TimeSeries } from '../types';

describe('TypeScript Types', () => {
  it('should define Session interface correctly', () => {
    const session: Session = {
      sessionId: 'uuid-123',
      timestamp: new Date().toISOString(),
      exerciseTag: 'Pencil Push-ups',
      ppmm: 37.8,
      timeSeries: [],
    };
    expect(session.sessionId).toBeDefined();
  });

  it('should define TimeSeries interface correctly', () => {
    const dataPoint: TimeSeries = {
      t: 100,
      x: 1.5,
      y: -2.3,
      r: 15.5,
    };
    expect(dataPoint.t).toBe(100);
  });
});
