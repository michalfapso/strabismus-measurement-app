import { smoothSeries, calculateSlope } from '../smoothing';

describe('smoothSeries', () => {
  it('returns same length as input', () => {
    const raw = Array.from({ length: 20 }, (_, i) => Math.sin(i * 0.3));
    const smoothed = smoothSeries(raw, 5);
    expect(smoothed).toHaveLength(raw.length);
  });

  it('throws on even window size', () => {
    expect(() => smoothSeries([1, 2, 3, 4, 5], 4)).toThrow();
  });

  it('throws when window exceeds data length', () => {
    expect(() => smoothSeries([1, 2, 3], 5)).toThrow();
  });
});

describe('calculateSlope', () => {
  it('returns same length as input', () => {
    const data = [1, 2, 3, 4, 5];
    expect(calculateSlope(data)).toHaveLength(data.length);
  });

  it('detects positive slope', () => {
    const data = Array.from({ length: 11 }, (_, i) => i);
    const slopes = calculateSlope(data, 4);
    expect(slopes[5]).toBeGreaterThan(0);
  });
});
