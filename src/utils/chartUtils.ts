// src/utils/chartUtils.ts

export interface Quartiles {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export interface Whiskers {
  lower: number;
  upper: number;
}

/**
 * Calculate quartiles (Q1, median, Q3) and min/max from sorted data.
 * Uses linear interpolation for quartile positions.
 */
export function calculateQuartiles(data: number[]): Quartiles | null {
  if (data.length === 0) return null;

  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (sorted.length === 1) {
    return { min, q1: min, median: min, q3: min, max };
  }

  if (sorted.length === 2) {
    const median = (sorted[0] + sorted[1]) / 2;
    return { min, q1: sorted[0], median, q3: sorted[1], max };
  }

  // Linear interpolation method for quartiles
  const q1Index = (sorted.length - 1) * 0.25;
  const medianIndex = (sorted.length - 1) * 0.5;
  const q3Index = (sorted.length - 1) * 0.75;

  const q1 = interpolateValue(sorted, q1Index);
  const median = interpolateValue(sorted, medianIndex);
  const q3 = interpolateValue(sorted, q3Index);

  return { min, q1, median, q3, max };
}

/**
 * Calculate whisker bounds based on 1.5 * IQR rule.
 * Whiskers extend from quartile ± 1.5 * IQR, capped at min/max data.
 */
export function calculateWhiskers(
  quartiles: Quartiles
): Whiskers {
  const iqr = quartiles.q3 - quartiles.q1;
  const lower = quartiles.q1 - 1.5 * iqr;
  const upper = quartiles.q3 + 1.5 * iqr;

  return {
    lower: Math.max(lower, quartiles.min),
    upper: Math.min(upper, quartiles.max),
  };
}

/**
 * Identify outliers as values outside the whisker range.
 */
export function identifyOutliers(data: number[], whiskers: Whiskers): number[] {
  return data.filter((v) => v < whiskers.lower || v > whiskers.upper);
}

/**
 * Helper: linear interpolation at fractional index.
 */
function interpolateValue(sorted: number[], index: number): number {
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}
