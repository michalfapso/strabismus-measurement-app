import { calculateQuartiles, calculateWhiskers, identifyOutliers } from '../chartUtils';

describe('Box Plot Utilities', () => {
  describe('calculateQuartiles', () => {
    test('returns median, q1, q3 for sorted array of length >= 3', () => {
      const data = [1, 2, 3, 4, 5];
      const result = calculateQuartiles(data);
      expect(result).toEqual({
        min: 1,
        q1: 2,
        median: 3,
        q3: 4,
        max: 5,
      });
    });

    test('handles array of length 2', () => {
      const data = [1, 5];
      const result = calculateQuartiles(data);
      expect(result).toEqual({
        min: 1,
        q1: 1,
        median: 3,
        q3: 5,
        max: 5,
      });
    });

    test('returns null for empty array', () => {
      expect(calculateQuartiles([])).toBeNull();
    });

    test('returns single value object for array of length 1', () => {
      const data = [42];
      const result = calculateQuartiles(data);
      expect(result).toEqual({
        min: 42,
        q1: 42,
        median: 42,
        q3: 42,
        max: 42,
      });
    });
  });

  describe('calculateWhiskers', () => {
    test('calculates whiskers as 1.5 * IQR from quartiles', () => {
      const quartiles = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
      const result = calculateWhiskers(quartiles);
      const iqr = 4 - 2; // 2
      const expectedLower = Math.max(1, 2 - 1.5 * iqr); // max(1, -1) = 1
      const expectedUpper = Math.min(5, 4 + 1.5 * iqr); // min(5, 7) = 5
      expect(result).toEqual({
        lower: expectedLower,
        upper: expectedUpper,
      });
    });
  });

  describe('identifyOutliers', () => {
    test('identifies values outside whisker range', () => {
      const data = [1, 2, 3, 4, 5, 100];
      const quartiles = { min: 1, q1: 2, median: 3, q3: 4, max: 100 };
      const whiskers = { lower: 1, upper: 5 };
      const result = identifyOutliers(data, whiskers);
      expect(result).toEqual([100]);
    });

    test('returns empty array if no outliers', () => {
      const data = [1, 2, 3, 4, 5];
      const whiskers = { lower: 1, upper: 5 };
      const result = identifyOutliers(data, whiskers);
      expect(result).toEqual([]);
    });
  });
});
