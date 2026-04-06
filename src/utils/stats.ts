import * as ss from 'simple-statistics';

export interface StatsResult {
  mean: number;
  stddev: number;
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  predict: (x: number) => number;
}

/**
 * Calculate mean and standard deviation for an array of numbers
 */
export function calculateStats(values: number[]): StatsResult {
  if (values.length === 0) {
    return { mean: 0, stddev: 0 };
  }
  return {
    mean: ss.mean(values),
    stddev: values.length > 1 ? ss.standardDeviation(values) : 0,
  };
}

/**
 * Calculate linear regression for trend analysis
 * Points: array of [x, y] pairs
 * Returns zeros if insufficient data or collinear points (vertical line)
 */
export function linearRegression(
  points: Array<[number, number]>
): RegressionResult {
  if (points.length < 2) {
    return {
      slope: 0,
      intercept: 0,
      predict: () => 0,
    };
  }

  const n = points.length;
  const sumX = points.reduce((acc, [x]) => acc + x, 0);
  const sumY = points.reduce((acc, [, y]) => acc + y, 0);
  const sumXY = points.reduce((acc, [x, y]) => acc + x * y, 0);
  const sumX2 = points.reduce((acc, [x]) => acc + x * x, 0);

  const denominator = n * sumX2 - sumX * sumX;

  // Guard against division by zero (collinear points with same X)
  if (denominator === 0) {
    return {
      slope: 0,
      intercept: mean(points.map(([, y]) => y)),
      predict: (x: number) => mean(points.map(([, y]) => y)),
    };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return {
    slope,
    intercept,
    predict: (x: number) => slope * x + intercept,
  };
}

/**
 * Calculate mean of a metric across multiple sessions
 * Generic helper to extract metric from session array
 */
export function sessionsMean<T>(
  sessions: T[],
  extractor: (s: T) => number
): number {
  if (sessions.length === 0) return 0;
  const values = sessions.map(extractor).filter(v => isFinite(v));
  if (values.length === 0) return 0;
  return mean(values);
}

/**
 * Calculate standard deviation of a metric across sessions
 * Generic helper to extract metric from session array
 */
export function sessionsStdDev<T>(
  sessions: T[],
  extractor: (s: T) => number
): number {
  if (sessions.length < 2) return 0;
  const values = sessions.map(extractor).filter(v => isFinite(v));
  if (values.length < 2) return 0;
  return ss.standardDeviation(values);
}

/**
 * Compute linear regression slope from (x, y) pairs.
 * Returns 0 if fewer than 2 points.
 */
export function linearRegressionSlope(points: Array<[number, number]>): number {
  if (points.length < 2) return 0;
  const line = ss.linearRegression(points);
  return line.m;
}

/**
 * Compute p-value for a linear regression using t-test on the slope.
 * Returns 1 (not significant) if fewer than 3 points.
 */
export function regressionPValue(points: Array<[number, number]>): number {
  if (points.length < 3) return 1;

  const n = points.length;
  const line = ss.linearRegression(points);
  const predict = ss.linearRegressionLine(line);

  const residuals = points.map(([x, y]) => y - predict(x));
  const sse = residuals.reduce((sum, r) => sum + r * r, 0);
  const xMean = ss.mean(points.map(([xv]) => xv));
  const sxx = points.reduce((sum, [x]) => sum + (x - xMean) ** 2, 0);

  if (sxx === 0 || n <= 2) return 1;

  const s2 = sse / (n - 2);
  const se = Math.sqrt(s2 / sxx);

  if (se === 0) return 0;

  const tStat = line.m / se;

  // Two-tailed p-value using normal approximation
  try {
    const p = 2 * (1 - ss.cumulativeStdNormalProbability(Math.abs(tStat)));
    return Math.max(0, Math.min(1, p));
  } catch {
    // Fallback approximation
    return Math.abs(tStat) > 2 ? 0.05 : 0.5;
  }
}

/**
 * Compute z-score for a value given mean and stdDev.
 */
export function computeZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Compute improvement rate: % of period sessions where value > baselineMedian.
 * For streaks (longer = better).
 */
export function improvementRate(values: number[], baselineMedian: number): number {
  if (values.length === 0) return 0;
  const improved = values.filter(v => v > baselineMedian).length;
  return (improved / values.length) * 100;
}

/**
 * Compute consistency score: % of sessions within 10% of baseline median.
 */
export function consistencyScore(values: number[], baselineMedian: number): number {
  if (values.length === 0) return 0;
  if (baselineMedian === 0) return 0;
  const tolerance = Math.abs(baselineMedian) * 0.1;
  const consistent = values.filter(v => Math.abs(v - baselineMedian) <= tolerance).length;
  return (consistent / values.length) * 100;
}

/**
 * Determine trend direction from slope and significance.
 * Uses domain-specific thresholds from the spec:
 * - streak: stable if |slope| < 0.5 s/week or p >= 0.05
 * - minValue: stable if |slope| < 0.05 cm/week or p >= 0.05
 * - stream: stable if |slope| < 0.5 or p >= 0.05 (generic streaming metrics)
 */
export function trendDirection(
  slope: number,
  p: number,
  type: 'streak' | 'minValue' | 'stream'
): 'improving' | 'declining' | 'stable' {
  const stableThreshold = type === 'streak' ? 0.5 : type === 'minValue' ? 0.05 : 0.5;
  if (p >= 0.05 || Math.abs(slope) < stableThreshold) return 'stable';
  if (type === 'streak' || type === 'stream') {
    return slope > 0 ? 'improving' : 'declining';
  } else {
    // For minValue: negative slope = improving (getting closer to 0)
    return slope < 0 ? 'improving' : 'declining';
  }
}

/**
 * Compute median of an array using simple-statistics.
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  return ss.median(values);
}

/**
 * Compute mean of an array.
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return ss.mean(values);
}

/**
 * Compute standard deviation.
 */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  return ss.standardDeviation(values);
}
