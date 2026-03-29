import { mean, standardDeviation } from 'simple-statistics';

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
    mean: mean(values),
    stddev: values.length > 1 ? standardDeviation(values) : 0,
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
  return standardDeviation(values);
}
