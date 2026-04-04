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

// Slope detection windows in seconds — sampling-rate independent
const SHORT_SLOPE_WINDOW_S = 0.5;    // seconds; converted to points at runtime
const LONG_SLOPE_WINDOW_S  = 5.0;    // seconds; converted to points at runtime

// Slope thresholds (cm/s) — compared against slopes already converted to cm/s
const SHORT_SLOPE_THRESHOLD = 1.0;   // Detects rapid changes ≥ 1 cm/s
const LONG_SLOPE_THRESHOLD  = 0.02;  // Detects slow, sustained changes ≥ 0.02 cm/s

// Existing constants (unchanged)
const NEAR_FUSION_WIDTH = 1;         // cm
const MIN_SEGMENT_DURATION = 0.25;   // seconds
const DEFAULT_SG_WINDOW = 11;        // smoothing window (separate from slope windows)

function computeSamplingRate(timeSeries: TimeSeries[]): number {
  if (timeSeries.length < 2) return 20; // default fallback

  // Compute median interval from time series, then derive points/second
  const intervals = timeSeries.slice(1).map((p, i) => p.t - timeSeries[i].t);
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const medianIntervalMs = sortedIntervals[Math.floor(sortedIntervals.length / 2)];

  return medianIntervalMs > 0 ? 1000 / medianIntervalMs : 20;
}

function refineEnter(
  T_detected: number,
  shortSlopes: number[],
  timeSeries: TimeSeries[]
): number {
  // Scan forward from (T_detected - halfLongWindow) using short-window slopes
  // Find first crossing of LONG_SLOPE_THRESHOLD
  const halfLongWindowS = LONG_SLOPE_WINDOW_S / 2;
  const searchStart = T_detected - halfLongWindowS;
  const t0 = timeSeries[0].t;

  for (let i = 0; i < timeSeries.length; i++) {
    const time = (timeSeries[i].t - t0) / 1000;
    if (time >= searchStart && Math.abs(shortSlopes[i]) > LONG_SLOPE_THRESHOLD) {
      return time;  // first crossing in the bracket → refined enter
    }
  }

  return T_detected;  // fallback: no refinement found
}

function refineExit(
  T_detected: number,
  shortSlopes: number[],
  timeSeries: TimeSeries[]
): number {
  // Scan backward from T_detected using short-window slopes
  // Find last crossing of LONG_SLOPE_THRESHOLD within bracket
  const halfLongWindowS = LONG_SLOPE_WINDOW_S / 2;
  const searchStart = T_detected - halfLongWindowS;
  const t0 = timeSeries[0].t;

  let lastAbove = T_detected;
  for (let i = timeSeries.length - 1; i >= 0; i--) {
    const time = (timeSeries[i].t - t0) / 1000;
    if (time < searchStart) break;
    if (Math.abs(shortSlopes[i]) > LONG_SLOPE_THRESHOLD) {
      lastAbove = time;
      break;
    }
  }

  return lastAbove;  // last crossing in bracket → refined exit
}

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
    // Use simple moving average for robust smoothing
    // (Savitzky-Golay was producing negative values from positive data)
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

  // Compute sampling rate once
  const pointsPerSecond = computeSamplingRate(timeSeries);

  // Convert window seconds to points
  const shortWindowPoints = Math.round(SHORT_SLOPE_WINDOW_S * pointsPerSecond);
  const longWindowPoints  = Math.round(LONG_SLOPE_WINDOW_S  * pointsPerSecond);

  // Compute slopes at both timescales
  const shortSlopesRaw = calculateSlope(smoothed, shortWindowPoints);
  const longSlopesRaw  = calculateSlope(smoothed, longWindowPoints);

  // Convert cm/point → cm/s using actual sampling rate
  const shortSlopes = shortSlopesRaw.map(s => s * pointsPerSecond);
  const longSlopes  = longSlopesRaw.map(s => s * pointsPerSecond);

  const classifications: SessionState[] = valuesToClassify.map((value, i) => {
    const shortSlope = shortSlopes[i] ?? 0;
    const longSlope = longSlopes[i] ?? 0;

    if (value < threshold) return 'FUSION';
    if (value < threshold + NEAR_FUSION_WIDTH) return 'NEAR_FUSION';

    // Either fast approach OR slow, steady approach
    if (shortSlope < -SHORT_SLOPE_THRESHOLD || longSlope < -LONG_SLOPE_THRESHOLD)
      return 'APPROACHING';

    // Either fast drift OR slow, steady drift
    if (shortSlope > SHORT_SLOPE_THRESHOLD || longSlope > LONG_SLOPE_THRESHOLD)
      return 'DRIFTING';

    return 'STABLE_DEVIATION';
  });

  // Log detailed classification info
  console.log(`\n=== classifyStates: metric=${metric}, threshold=${threshold} ===`);
  console.log(`Total points: ${rawValues.length}, thresholds: NEAR_FUSION_WIDTH=${NEAR_FUSION_WIDTH}, SHORT_SLOPE_THRESHOLD=${SHORT_SLOPE_THRESHOLD}, LONG_SLOPE_THRESHOLD=${LONG_SLOPE_THRESHOLD}`);
  console.log(`Raw values range: [${Math.min(...rawValues).toFixed(3)}, ${Math.max(...rawValues).toFixed(3)}]`);

  // Check for any undefined classifications
  const unclassifiedIndices = classifications
    .map((c, i) => (c === undefined || c === null) ? i : -1)
    .filter(i => i >= 0);
  if (unclassifiedIndices.length > 0) {
    console.warn(`⚠️  UNCLASSIFIED DATA POINTS at indices: ${unclassifiedIndices.join(', ')}`);
  } else {
    console.log(`✓ All ${classifications.length} points classified successfully`);
  }

  // Log sample classifications with their values
  console.log(`Sample classifications (indices 0, 10, 20, ..., last):`);
  const sampleIndicesList = [0, 10, 20, 30, 40, Math.floor(classifications.length / 2), classifications.length - 2, classifications.length - 1];
  const uniqueSampleIndices = Array.from(new Set(sampleIndicesList.filter(idx => idx < classifications.length)));
  uniqueSampleIndices.forEach(idx => {
    console.log(`  [${idx}] value=${valuesToClassify[idx].toFixed(3)}, shortSlope=${(shortSlopes[idx] ?? 0).toFixed(3)}, longSlope=${(longSlopes[idx] ?? 0).toFixed(3)}, state=${classifications[idx]}`);
  });

  // FIRST PASS: Create all candidate segments (including short ones)
  const candidateSegments: Array<StateSegment & { startIdx: number; endIdx: number }> = [];
  let segStart = 0;

  for (let i = 1; i <= timeSeries.length; i++) {
    const isLast = i === timeSeries.length;
    if (isLast || classifications[i] !== classifications[segStart]) {
      const startTime = (timeSeries[segStart].t - timeSeries[0].t) / 1000;
      const endTime = isLast
        ? (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000
        : (timeSeries[i].t - timeSeries[0].t) / 1000;
      const duration = endTime - startTime;

      candidateSegments.push({
        state: classifications[segStart],
        startTime,
        endTime,
        duration,
        startIdx: segStart,
        endIdx: i - 1,
      });
      segStart = i;
    }
  }

  // SECOND PASS: Identify which segments to keep
  const keepSegment = candidateSegments.map(seg => seg.duration >= MIN_SEGMENT_DURATION);

  // THIRD PASS: Stretch neighboring segments to fill gaps from filtered segments
  let stretchedSegments: StateSegment[] = [];
  for (let i = 0; i < candidateSegments.length; i++) {
    if (!keepSegment[i]) continue; // Skip filtered segments

    let seg = { ...candidateSegments[i] };

    // Stretch start time backwards to cover any filtered segments before this
    for (let j = i - 1; j >= 0; j--) {
      if (keepSegment[j]) break; // Stop at the previous kept segment
      seg.startTime = candidateSegments[j].startTime;
    }

    // Stretch end time forwards to cover any filtered segments after this
    for (let j = i + 1; j < candidateSegments.length; j++) {
      if (keepSegment[j]) break; // Stop at the next kept segment
      seg.endTime = candidateSegments[j].endTime;
    }

    seg.duration = seg.endTime - seg.startTime;
    stretchedSegments.push(seg);
  }

  // FOURTH PASS: Merge consecutive segments with the same state
  const segments: StateSegment[] = [];
  for (const seg of stretchedSegments) {
    if (segments.length > 0 && segments[segments.length - 1].state === seg.state) {
      // Merge with previous segment: extend its endTime
      segments[segments.length - 1].endTime = seg.endTime;
      segments[segments.length - 1].duration = seg.endTime - segments[segments.length - 1].startTime;
    } else {
      // Add as new segment
      segments.push(seg);
    }
  }

  // Logging
  console.log(`\nSegmentation (MIN_SEGMENT_DURATION=${MIN_SEGMENT_DURATION}s):`);
  console.log(`Total candidate segments: ${candidateSegments.length}`);
  candidateSegments.forEach((seg, idx) => {
    const status = keepSegment[idx] ? '✓' : '✗ FILTERED';
    console.log(`  [${status}] Segment ${idx}: ${seg.state} (indices ${seg.startIdx}-${seg.endIdx}, duration=${seg.duration.toFixed(3)}s)`);
  });
  console.log(`\nAfter stretching to fill gaps: ${stretchedSegments.length} segments`);
  console.log(`\nAfter merging same states: ${segments.length} segments`);
  segments.forEach((seg, idx) => {
    console.log(`  Segment ${idx}: ${seg.state} (${seg.startTime.toFixed(3)}s-${seg.endTime.toFixed(3)}s, duration=${seg.duration.toFixed(3)}s)`);
  });

  // Check for gaps in coverage (should be near 100% after stretching and merging)
  const totalDuration = (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000;
  let coveredTime = 0;
  segments.forEach(s => { coveredTime += s.duration; });
  console.log(`Total duration: ${totalDuration.toFixed(2)}s | Covered by final segments: ${coveredTime.toFixed(2)}s | Coverage: ${((coveredTime / totalDuration) * 100).toFixed(1)}%`);
  console.log('===\n');

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
