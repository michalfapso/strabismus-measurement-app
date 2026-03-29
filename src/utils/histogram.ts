import { Session, TimeSeries } from '../types';

/**
 * Configuration for histogram bins based on metric type
 */
const BIN_CONFIG: Record<HistogramMetric, number> = {
  deviation: 1,  // 1cm bins
  x: 1,          // 1cm bins
  y: 1,          // 1cm bins
  rotation: 1,   // 1 degree bins
};

export type HistogramMetric = 'deviation' | 'x' | 'y' | 'rotation';

export interface HistogramBin {
  rangeStart: number;
  rangeEnd: number;
  duration: number;  // in seconds
  label: string;
}

/**
 * Get metric value from a TimeSeries data point
 */
function getMetricValue(point: TimeSeries, metric: HistogramMetric): number {
  if (metric === 'deviation') {
    return Math.sqrt(point.x * point.x + point.y * point.y);
  } else if (metric === 'x') {
    return point.x;
  } else if (metric === 'y') {
    return point.y;
  } else if (metric === 'rotation') {
    return point.r;
  }
  return 0;
}

/**
 * Get unit string for the metric
 */
function getMetricUnit(metric: HistogramMetric): string {
  return metric === 'rotation' ? '°' : 'cm';
}

/**
 * Calculate histogram bins for a single session
 * @param session Session data
 * @param metric Which metric to analyze
 * @returns Array of histogram bins with durations
 */
export function calculateSessionHistogram(
  session: Session,
  metric: HistogramMetric
): HistogramBin[] {
  if (session.timeSeries.length === 0) {
    return [];
  }

  // Extract values and find min/max
  const values = session.timeSeries.map((ts) => getMetricValue(ts, metric));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  // Get bin size from config
  const binSize = BIN_CONFIG[metric];

  // Create bins
  const binStart = Math.floor(minValue / binSize) * binSize;
  const binEnd = Math.ceil(maxValue / binSize) * binSize;
  const bins: Map<number, number> = new Map();

  // Initialize bins with 0 duration
  for (let start = binStart; start < binEnd; start += binSize) {
    bins.set(start, 0);
  }

  // Calculate duration for each data point and assign to bin
  for (let i = 0; i < session.timeSeries.length; i++) {
    const currentPoint = session.timeSeries[i];
    const currentValue = getMetricValue(currentPoint, metric);

    // Calculate duration: time until next point (in milliseconds, convert to seconds)
    let duration = 0;
    if (i < session.timeSeries.length - 1) {
      const nextPoint = session.timeSeries[i + 1];
      duration = (nextPoint.t - currentPoint.t) / 1000; // convert ms to seconds
    }

    // Find which bin this value belongs to
    const binStart = Math.floor(currentValue / binSize) * binSize;
    const currentDuration = bins.get(binStart) || 0;
    bins.set(binStart, currentDuration + duration);
  }

  // Convert to HistogramBin array
  const unit = getMetricUnit(metric);
  const result: HistogramBin[] = [];

  bins.forEach((duration, start) => {
    result.push({
      rangeStart: start,
      rangeEnd: start + binSize,
      duration,
      label: `${start.toFixed(0)}-${(start + binSize).toFixed(0)}${unit}`,
    });
  });

  // Sort by rangeStart
  result.sort((a, b) => a.rangeStart - b.rangeStart);

  return result;
}

/**
 * Calculate aggregate histogram across multiple sessions
 * @param sessions Array of sessions
 * @param metric Which metric to analyze
 * @param mode 'mean' | 'individual' - how to aggregate
 * @returns Histogram bins
 */
export function calculateAggregateHistogram(
  sessions: Session[],
  metric: HistogramMetric,
  mode: 'mean' | 'individual' = 'individual'
): HistogramBin[] {
  if (sessions.length === 0) {
    return [];
  }

  if (mode === 'individual') {
    // Calculate histogram for each session and sum durations per bin
    const binDurations: Map<string, number> = new Map();
    const binLabels: Map<string, [number, number]> = new Map();

    const sessionHistograms = sessions.map((session) =>
      calculateSessionHistogram(session, metric)
    );

    // Aggregate all bins
    for (const histogram of sessionHistograms) {
      for (const bin of histogram) {
        const key = `${bin.rangeStart}-${bin.rangeEnd}`;
        binDurations.set(key, (binDurations.get(key) || 0) + bin.duration);
        binLabels.set(key, [bin.rangeStart, bin.rangeEnd]);
      }
    }

    // Convert to HistogramBin array
    const unit = getMetricUnit(metric);
    const result: HistogramBin[] = [];

    binLabels.forEach(([start, end], key) => {
      result.push({
        rangeStart: start,
        rangeEnd: end,
        duration: binDurations.get(key) || 0,
        label: `${start.toFixed(0)}-${end.toFixed(0)}${unit}`,
      });
    });

    result.sort((a, b) => a.rangeStart - b.rangeStart);
    return result;
  } else {
    // mode === 'mean'
    // Calculate mean value across all sessions
    // For each session, find the mean of the metric
    // Create a histogram showing the mean values
    const meanValues = sessions.map((session) => {
      if (session.timeSeries.length === 0) return 0;
      const values = session.timeSeries.map((ts) => getMetricValue(ts, metric));
      return values.reduce((a, b) => a + b, 0) / values.length;
    });

    // Now create histogram showing mean distribution
    const minMean = Math.min(...meanValues);
    const maxMean = Math.max(...meanValues);

    const binSize = BIN_CONFIG[metric];
    const binStart = Math.floor(minMean / binSize) * binSize;
    const binEnd = Math.ceil(maxMean / binSize) * binSize;

    const bins: Map<number, number> = new Map();

    // Initialize bins
    for (let start = binStart; start < binEnd; start += binSize) {
      bins.set(start, 0);
    }

    // For mean mode, we assign duration based on which bin the mean falls into
    // The duration is the session's total duration
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const meanValue = meanValues[i];

      // Calculate session total duration
      const sessionDuration =
        session.timeSeries.length > 0
          ? (session.timeSeries[session.timeSeries.length - 1].t -
              session.timeSeries[0].t) /
            1000
          : 0;

      // Find which bin this mean belongs to
      const binStart = Math.floor(meanValue / binSize) * binSize;
      const currentDuration = bins.get(binStart) || 0;
      bins.set(binStart, currentDuration + sessionDuration);
    }

    // Convert to HistogramBin array
    const unit = getMetricUnit(metric);
    const result: HistogramBin[] = [];

    bins.forEach((duration, start) => {
      result.push({
        rangeStart: start,
        rangeEnd: start + binSize,
        duration,
        label: `${start.toFixed(0)}-${(start + binSize).toFixed(0)}${unit}`,
      });
    });

    result.sort((a, b) => a.rangeStart - b.rangeStart);
    return result;
  }
}
