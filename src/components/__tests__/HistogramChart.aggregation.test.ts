import { aggregateHistogramData } from '../HistogramChart';
import { Session } from '../../types';

describe('HistogramChart - Data Aggregation', () => {
  test('aggregates session data into bins with box plot stats', () => {
    const sessions: Session[] = [
      {
        sessionId: 's1',
        timestamp: '2026-03-30T00:00:00Z',
        exerciseTag: 'Pencil Push-ups',
        ppi: 96,
        timeSeries: [
          { t: 0, x: 0.5, y: 0.5, r: 0 },
          { t: 500, x: 0.8, y: 0.2, r: 0 },
          { t: 1000, x: 0.5, y: 0, r: 0 },
        ],
      },
      {
        sessionId: 's2',
        timestamp: '2026-03-30T00:00:00Z',
        exerciseTag: 'Pencil Push-ups',
        ppi: 96,
        timeSeries: [
          { t: 0, x: 1.2, y: 0.3, r: 0 },
          { t: 500, x: 1.5, y: 0.1, r: 0 },
          { t: 1000, x: 1.2, y: 0, r: 0 },
        ],
      },
    ];

    const result = aggregateHistogramData(sessions, 'deviation', 1); // 1cm bins

    // Should have bins for 0-1cm and 1-2cm
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('binRange');
    expect(result[0]).toHaveProperty('values');
    expect(result[0]).toHaveProperty('coverage');
    expect(result[0]).toHaveProperty('count');
  });

  test('calculates coverage as percentage of measurements with data in bin', () => {
    const sessions: Session[] = [
      {
        sessionId: 's1',
        timestamp: '2026-03-30T00:00:00Z',
        exerciseTag: 'Test',
        ppi: 96,
        timeSeries: [{ t: 0, x: 0.5, y: 0.5, r: 0 }], // deviation ~0.7, in 0-1cm
      },
      {
        sessionId: 's2',
        timestamp: '2026-03-30T00:00:00Z',
        exerciseTag: 'Test',
        ppi: 96,
        timeSeries: [{ t: 0, x: 3.0, y: 0.0, r: 0 }], // deviation 3.0, in 3-4cm (no data in 0-1cm)
      },
    ];

    const result = aggregateHistogramData(sessions, 'deviation', 1);
    const bin0to1 = result.find((b) => b.binRange === '0-1');

    expect(bin0to1).toBeDefined();
    expect(bin0to1?.coverage).toBe(50); // 1 of 2 measurements
    expect(bin0to1?.count).toBe(1);
  });
});
