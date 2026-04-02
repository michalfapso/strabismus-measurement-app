import { Session, TimeSeries } from '../types';
import { SessionMetrics, StateSegment, SessionState } from '../types/analysis';
import { calculateSessionHistogram } from './histogram';
import { smoothSeries, calculateSlope } from './smoothing';

export function getMetricValue(point: TimeSeries, metric: 'deviation' | 'rotation'): number {
  if (metric === 'deviation') {
    return Math.sqrt(point.x * point.x + point.y * point.y);
  } else {
    return Math.abs(point.r);
  }
}

export function calculateFusionMetrics(
  timeSeries: TimeSeries[],
  threshold: number,
  metric: 'deviation' | 'rotation'
) {
  const nearFusionWidth = 1;
  let fusionTime = 0;
  let nearFusionTime = 0;
  let largeDeviationTime = 0;
  let fusionAchieved = false;

  for (let i = 0; i < timeSeries.length - 1; i++) {
    const duration = (timeSeries[i + 1].t - timeSeries[i].t) / 1000;
    const value = getMetricValue(timeSeries[i], metric);

    if (value < threshold) {
      fusionTime += duration;
      fusionAchieved = true;
    } else if (value >= threshold && value < threshold + nearFusionWidth) {
      nearFusionTime += duration;
    } else if (value > 2 * threshold) {
      largeDeviationTime += duration;
    }
  }

  const sessionDuration = timeSeries.length > 1
    ? (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000
    : 1;

  return {
    fusionTime,
    fusionTimePercent: (fusionTime / sessionDuration) * 100,
    nearFusionTime,
    nearFusionTimePercent: (nearFusionTime / sessionDuration) * 100,
    largeDeviationTime,
    fusionAchieved,
  };
}

export function calculateMinValue(timeSeries: TimeSeries[], metric: 'deviation' | 'rotation'): number {
  if (timeSeries.length === 0) return 0;
  return Math.min(...timeSeries.map(p => getMetricValue(p, metric)));
}

export function calculateTimeToFirstFusion(
  timeSeries: TimeSeries[],
  threshold: number,
  metric: 'deviation' | 'rotation'
): number | null {
  const firstFusion = timeSeries.find(p => getMetricValue(p, metric) < threshold);
  if (!firstFusion) return null;
  return (firstFusion.t - timeSeries[0].t) / 1000;
}

export function calculateTrajectoryRatio(
  timeSeries: TimeSeries[],
  metric: 'deviation' | 'rotation'
): number | null {
  if (timeSeries.length < 2) return null;

  const midpoint = Math.floor(timeSeries.length / 2);
  const firstHalf = timeSeries.slice(0, midpoint);
  const secondHalf = timeSeries.slice(midpoint);

  const firstHalfMean = firstHalf.reduce((sum, p) => sum + getMetricValue(p, metric), 0) / firstHalf.length;
  const secondHalfMean = secondHalf.reduce((sum, p) => sum + getMetricValue(p, metric), 0) / secondHalf.length;

  if (Math.abs(firstHalfMean) < 0.01) return null;

  return (firstHalfMean - secondHalfMean) / firstHalfMean;
}

export function calculateLargeDeviationTimePercent(
  timeSeries: TimeSeries[],
  threshold: number,
  metric: 'deviation' | 'rotation'
): number {
  if (timeSeries.length < 2) return 0;

  let largeDevTime = 0;
  for (let i = 0; i < timeSeries.length - 1; i++) {
    const duration = (timeSeries[i + 1].t - timeSeries[i].t) / 1000;
    if (getMetricValue(timeSeries[i], metric) > 2 * threshold) {
      largeDevTime += duration;
    }
  }

  const sessionDuration = (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000;
  return sessionDuration > 0 ? (largeDevTime / sessionDuration) * 100 : 0;
}

const SLOPE_THRESHOLD = 0.1;
const NEAR_FUSION_WIDTH = 1;
const MIN_SEGMENT_DURATION = 0.5;
const DEFAULT_SG_WINDOW = 11;

export function classifyStates(
  timeSeries: TimeSeries[],
  threshold: number,
  metric: 'deviation' | 'rotation',
  sgWindowSize: number = DEFAULT_SG_WINDOW
): StateSegment[] {
  if (timeSeries.length < 2) return [];

  const rawValues = timeSeries.map(p => getMetricValue(p, metric));
  const halfWindow = Math.floor(sgWindowSize / 2);

  let smoothed: number[];
  try {
    const effectiveWindow = Math.min(sgWindowSize, rawValues.length % 2 === 0 ? rawValues.length - 1 : rawValues.length);
    smoothed = effectiveWindow >= 5 ? smoothSeries(rawValues, effectiveWindow) : rawValues;
  } catch {
    smoothed = rawValues;
  }

  // For edges where smoothing may be unreliable, use raw values instead
  const valuesToClassify = rawValues.map((raw, i) => {
    // Use raw values at edges (first and last halfWindow points)
    if (i < halfWindow || i >= rawValues.length - halfWindow) {
      return raw;
    }
    return smoothed[i];
  });

  const slopes = calculateSlope(smoothed, 10);

  const classifications: SessionState[] = valuesToClassify.map((value, i) => {
    const slope = slopes[i] ?? 0;
    if (value < threshold) return 'FUSION';
    if (value < threshold + NEAR_FUSION_WIDTH) return 'NEAR_FUSION';
    if (slope < -SLOPE_THRESHOLD) return 'APPROACHING';
    if (slope > SLOPE_THRESHOLD) return 'DRIFTING';
    return 'STABLE_DEVIATION';
  });

  // Debug logging: log raw, smoothed, and classifications for analysis
  console.log('=== FSM State Classification Debug ===');
  console.log(`Metric: ${metric}, Threshold: ${threshold}, Data points: ${rawValues.length}`);
  console.log(`SG Window: ${sgWindowSize}, Half-window edge buffer: ${halfWindow}`);
  console.log('\nFirst 50 points (index, time, raw, smoothed, classified, slope):');
  const debugRows = timeSeries.slice(0, 50).map((ts, i) => {
    const time = (ts.t - timeSeries[0].t) / 1000;
    const raw = rawValues[i];
    const sm = smoothed[i];
    const classified = classifications[i];
    const slope = slopes[i] ?? 0;
    return [i, time.toFixed(2), raw.toFixed(2), sm.toFixed(2), classified, slope.toFixed(3)];
  });
  console.table(debugRows);

  console.log('\nLast 20 points (index, time, raw, smoothed, classified, slope):');
  const startIdx = Math.max(0, timeSeries.length - 20);
  const debugRowsEnd = timeSeries.slice(startIdx).map((ts, offset) => {
    const i = startIdx + offset;
    const time = (ts.t - timeSeries[0].t) / 1000;
    const raw = rawValues[i];
    const sm = smoothed[i];
    const classified = classifications[i];
    const slope = slopes[i] ?? 0;
    return [i, time.toFixed(2), raw.toFixed(2), sm.toFixed(2), classified, slope.toFixed(3)];
  });
  console.table(debugRowsEnd);
  console.log('=====================================\n');

  const segments: StateSegment[] = [];
  let segStart = 0;

  for (let i = 1; i <= timeSeries.length; i++) {
    const isLast = i === timeSeries.length;
    if (isLast || classifications[i] !== classifications[segStart]) {
      const startTime = (timeSeries[segStart].t - timeSeries[0].t) / 1000;
      const endTime = isLast
        ? (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000
        : (timeSeries[i].t - timeSeries[0].t) / 1000;
      const duration = endTime - startTime;

      if (duration >= MIN_SEGMENT_DURATION) {
        segments.push({
          state: classifications[segStart],
          startTime,
          endTime,
          duration,
        });
      }
      segStart = i;
    }
  }

  return segments;
}

export function calculateFusionEventCount(segments: StateSegment[]): number {
  let count = 0;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].state === 'FUSION' && (i === 0 || segments[i - 1].state !== 'FUSION')) {
      count++;
    }
  }
  return count;
}

export function calculateLongestFusionStreak(segments: StateSegment[]): number {
  return segments
    .filter(s => s.state === 'FUSION')
    .reduce((max, s) => Math.max(max, s.duration), 0);
}

export function computeSessionMetrics(
  session: Session,
  thresholds: { deviation: number; rotation: number },
  metric: 'deviation' | 'rotation'
): SessionMetrics {
  const timeSeries = session.timeSeries;
  const threshold = metric === 'deviation' ? thresholds.deviation : thresholds.rotation;

  const sessionDuration = timeSeries.length > 1
    ? (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000
    : 0;

  if (sessionDuration < 10) {
    throw new Error('Session duration must be at least 10 seconds');
  }

  const fusionMetrics = calculateFusionMetrics(timeSeries, threshold, metric);
  const minValue = calculateMinValue(timeSeries, metric);
  const timeToFirstFusion = calculateTimeToFirstFusion(timeSeries, threshold, metric);
  const trajectoryRatio = calculateTrajectoryRatio(timeSeries, metric);
  const largeDeviationTimePercent = calculateLargeDeviationTimePercent(timeSeries, threshold, metric);
  const stateSegments = classifyStates(timeSeries, threshold, metric);
  const fusionEventCount = calculateFusionEventCount(stateSegments);
  const longestFusionStreak = calculateLongestFusionStreak(stateSegments);
  const histogram = calculateSessionHistogram(session, metric);

  return {
    sessionId: session.sessionId,
    date: session.timestamp.split('T')[0],
    exerciseTag: session.exerciseTag,
    metric,
    sessionDuration,
    histogram,
    timeToFirstFusion,
    fusionEventCount,
    longestFusionStreak,
    minValue,
    largeDeviationTimePercent,
    trajectoryRatio,
    fusionTime: fusionMetrics.fusionTime,
    fusionTimePercent: fusionMetrics.fusionTimePercent,
    fusionAchieved: fusionMetrics.fusionAchieved,
    nearFusionTime: fusionMetrics.nearFusionTime,
    nearFusionTimePercent: fusionMetrics.nearFusionTimePercent,
    largeDeviationTime: fusionMetrics.largeDeviationTime,
    stateSegments,
  };
}
