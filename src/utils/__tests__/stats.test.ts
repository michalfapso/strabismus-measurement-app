import {
  linearRegressionSlope,
  regressionPValue,
  computeZScore,
  improvementRate,
  consistencyScore,
  trendDirection,
  median,
} from '../stats';

describe('linearRegressionSlope', () => {
  it('returns positive slope for increasing data', () => {
    const points: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3]];
    expect(linearRegressionSlope(points)).toBeCloseTo(1, 2);
  });

  it('returns negative slope for decreasing data', () => {
    const points: [number, number][] = [[0, 3], [1, 2], [2, 1], [3, 0]];
    expect(linearRegressionSlope(points)).toBeCloseTo(-1, 2);
  });

  it('returns 0 for fewer than 2 points', () => {
    expect(linearRegressionSlope([[1, 1]])).toBe(0);
    expect(linearRegressionSlope([])).toBe(0);
  });
});

describe('regressionPValue', () => {
  it('returns value between 0 and 1', () => {
    const points: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3]];
    const p = regressionPValue(points);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('returns 1 for fewer than 3 points', () => {
    expect(regressionPValue([[0, 0], [1, 1]])).toBe(1);
  });
});

describe('computeZScore', () => {
  it('returns 0 when value equals mean', () => {
    expect(computeZScore(5, 5, 2)).toBe(0);
  });

  it('returns 1 when value is one stdDev above mean', () => {
    expect(computeZScore(7, 5, 2)).toBe(1);
  });

  it('returns 0 when stdDev is 0', () => {
    expect(computeZScore(5, 5, 0)).toBe(0);
  });
});

describe('improvementRate', () => {
  it('returns 100 when all values exceed baseline', () => {
    expect(improvementRate([5, 6, 7], 4)).toBe(100);
  });

  it('returns 0 when no values exceed baseline', () => {
    expect(improvementRate([1, 2, 3], 4)).toBe(0);
  });

  it('returns 50 when half exceed baseline', () => {
    expect(improvementRate([3, 5], 4)).toBe(50);
  });
});

describe('consistencyScore', () => {
  it('returns 100 when all values within 10% of baseline', () => {
    expect(consistencyScore([10, 10.5, 9.5], 10)).toBe(100);
  });

  it('returns 0 for empty array', () => {
    expect(consistencyScore([], 10)).toBe(0);
  });
});

describe('trendDirection', () => {
  it('returns stable when p >= 0.05', () => {
    expect(trendDirection(5, 0.1, 'streak')).toBe('stable');
  });

  it('returns improving for positive streak slope with p < 0.05', () => {
    expect(trendDirection(2, 0.01, 'streak')).toBe('improving');
  });

  it('returns improving for negative minValue slope with p < 0.05', () => {
    expect(trendDirection(-0.1, 0.01, 'minValue')).toBe('improving');
  });
});

describe('median', () => {
  it('calculates median correctly', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('returns 0 for empty array', () => {
    expect(median([])).toBe(0);
  });
});
