import { Session, TimeSeries } from '../types';
import { SessionMetrics, StateSegment, SessionState, SegmentMetrics } from '../types/analysis';
import { calculateSessionHistogram } from './histogram';
import { smoothSeries, calculateSlope } from './smoothing';

const NEAR_BEST_THRESHOLD_BAND_PERCENT = 10;  // band width as % of (max - min) deviation

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
const LONG_SLOPE_WINDOW_S  = 2.5;    // seconds; reduced from 5.0 to respond faster to state changes

// Boundary refinement bracket: search range for precise boundary location (independent of slope windows)
// Should be larger than the longest segment we want to detect accurately
const REFINEMENT_BRACKET_S = 2.5;    // seconds; half-bracket for searching boundary transitions

// Slope thresholds (cm/s) — compared against slopes already converted to cm/s
const SHORT_SLOPE_THRESHOLD = 1.0;   // Detects rapid changes ≥ 1 cm/s

// Hysteresis thresholds for DRIFTING/APPROACHING (prevents oscillation around threshold)
// Higher threshold to ENTER a drift state, lower threshold to STAY/EXIT
const LONG_SLOPE_THRESHOLD_ENTER = 0.15;  // Must exceed this to enter DRIFTING/APPROACHING
const LONG_SLOPE_THRESHOLD_STAY  = 0.08;  // Can drop below this to exit DRIFTING/APPROACHING

// Existing constants (unchanged)
const NEAR_FUSION_WIDTH = 1;         // cm
const MIN_SEGMENT_DURATION = 0.25;   // seconds
const DEFAULT_SG_WINDOW = 11;        // smoothing window (separate from slope windows)

// Context-aware minimum duration for STABLE_DEVIATION segments:
// A brief stable plateau between two segments moving in the same direction (drift→stable→drift
// or approach→stable→approach) is noise unless it lasted long enough to be meaningful.
// A stable plateau between opposing directions (drift→stable→approach or vice versa) is a
// clinically meaningful turning point and can be recognised at a lower threshold.
const STABLE_DEVIATION_MIN_SAME_DIRECTION_S = 3.0;   // seconds
const STABLE_DEVIATION_MIN_TURNING_POINT_S  = 1.5;   // seconds

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
  // Find where segment ENTERS a DRIFTING/APPROACHING state
  // Scan backward from T_detected to find where slope stopped being below threshold
  // This marks the entry point into the drifting/approaching phase
  const searchStart = Math.max(0, T_detected - REFINEMENT_BRACKET_S);
  const searchEnd = T_detected;
  const t0 = timeSeries[0].t;

  // Scan backward from T_detected, looking for the transition point
  let lastExceedTime = T_detected;
  for (let i = timeSeries.length - 1; i >= 0; i--) {
    const time = (timeSeries[i].t - t0) / 1000;
    if (time < searchStart) break;
    if (time > searchEnd) continue;
    if (Math.abs(shortSlopes[i]) > SHORT_SLOPE_THRESHOLD) {
      lastExceedTime = time;
    } else {
      // Slope dropped below threshold; lastExceedTime is where it re-exceeded
      return lastExceedTime;
    }
  }

  return T_detected;  // No transition found; use original
}

function refineExit(
  T_detected: number,
  shortSlopes: number[],
  timeSeries: TimeSeries[]
): number {
  // Find where segment EXITS a DRIFTING/APPROACHING state
  // Scan backward from T_detected to find where slope stopped exceeding threshold
  // This marks the exit point from the drifting/approaching phase
  const searchStart = Math.max(0, T_detected - REFINEMENT_BRACKET_S);
  const searchEnd = T_detected;
  const t0 = timeSeries[0].t;

  // Scan backward from T_detected, looking for last moment slope exceeds threshold
  for (let i = timeSeries.length - 1; i >= 0; i--) {
    const time = (timeSeries[i].t - t0) / 1000;
    if (time < searchStart) break;
    if (time > searchEnd) continue;
    if (Math.abs(shortSlopes[i]) > SHORT_SLOPE_THRESHOLD) {
      // This is the last moment where slope exceeds threshold
      return time;
    }
  }

  return T_detected;  // No transition found; use original
}

function computeSegmentMetrics(
  timeSeries: TimeSeries[],
  segment: StateSegment,
  metric: 'deviation' | 'rotation',
  smoothed: number[],
  pointsPerSecond: number
): SegmentMetrics {
  // Find the index range for this segment within timeSeries
  const t0 = timeSeries[0].t;
  const startIdx = timeSeries.findIndex(p => (p.t - t0) / 1000 >= segment.startTime);

  // Last index where time <= endTime
  let endIdx = startIdx;
  for (let i = startIdx; i < timeSeries.length; i++) {
    if ((timeSeries[i].t - t0) / 1000 <= segment.endTime) endIdx = i;
    else break;
  }

  const segmentPoints = timeSeries.slice(startIdx, endIdx + 1);
  const values = segmentPoints.map(p => getMetricValue(p, metric));

  if (values.length === 0) {
    return {
      medianDeviation: 0,
      minDeviation: 0,
      maxDeviation: 0,
      meanDeviation: 0,
      varianceWithinSegment: 0,
      stdDevWithinSegment: 0,
      intraSegmentSlope: 0,
    };
  }

  // Descriptive statistics
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Intra-segment slope (cm/s)
  const segmentSmoothed = smoothed.slice(startIdx, endIdx + 1);
  let intraSegmentSlope = 0;

  if (segmentSmoothed.length >= 3) {
    const longWindowPoints = Math.round(LONG_SLOPE_WINDOW_S * pointsPerSecond);
    const segLen = segmentSmoothed.length;
    const windowSize = Math.min(
      longWindowPoints,
      segLen % 2 === 0 ? segLen - 1 : segLen
    );

    const segmentSlopesRaw = calculateSlope(segmentSmoothed, windowSize);
    const meanSlopeRaw = segmentSlopesRaw.reduce((a, b) => a + b, 0) / segmentSlopesRaw.length;
    intraSegmentSlope = meanSlopeRaw * pointsPerSecond; // convert to cm/s
  }

  return {
    medianDeviation: median,
    minDeviation: min,
    maxDeviation: max,
    meanDeviation: mean,
    varianceWithinSegment: variance,
    stdDevWithinSegment: stdDev,
    intraSegmentSlope,
  };
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

  // Compute local flatness: standard deviation of raw values in ±0.25s windows
  // This detects genuinely flat regions that slope-based classification cannot handle
  const flatnessWindowPoints = Math.max(1, Math.round(0.25 * pointsPerSecond));
  const flatnessStdDev: number[] = rawValues.map((_, i) => {
    const start = Math.max(0, i - flatnessWindowPoints);
    const end = Math.min(rawValues.length - 1, i + flatnessWindowPoints);
    const windowValues = rawValues.slice(start, end + 1);

    if (windowValues.length === 1) return 0;  // Single point, no variance

    const mean = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
    const variance = windowValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / windowValues.length;
    return Math.sqrt(variance);
  });

  const FLATNESS_THRESHOLD_CM = 0.05;  // Regions with stddev < 0.05 cm are considered flat

  // Use hysteresis to prevent oscillation around thresholds
  const classifications: SessionState[] = [];
  let prevState: SessionState = 'STABLE_DEVIATION';  // Initial state assumption

  for (let i = 0; i < valuesToClassify.length; i++) {
    const value = valuesToClassify[i];
    const shortSlope = shortSlopes[i] ?? 0;
    const longSlope = longSlopes[i] ?? 0;
    const localFlatness = flatnessStdDev[i] ?? 0;

    if (value < threshold) {
      classifications.push('FUSION');
      prevState = 'FUSION';
    } else if (value < threshold + NEAR_FUSION_WIDTH) {
      classifications.push('NEAR_FUSION');
      prevState = 'NEAR_FUSION';
    } else {
      // For APPROACHING/DRIFTING/STABLE, first check if the region is genuinely flat

      // If raw values are not changing much (stddev < 0.05 cm), classify as STABLE
      // This handles step changes between flat levels and quantization artifacts
      // that slope-based detection cannot recognize because slopes are ~0
      if (localFlatness < FLATNESS_THRESHOLD_CM) {
        classifications.push('STABLE_DEVIATION');
        prevState = 'STABLE_DEVIATION';
        continue;
      }

      // Otherwise, use slope-based classification with hysteresis

      // APPROACHING: Either fast approach OR slow approach (with hysteresis on long slope)
      const isApproachingShort = shortSlope < -SHORT_SLOPE_THRESHOLD;
      const isApproachingLongEnter = longSlope < -LONG_SLOPE_THRESHOLD_ENTER;
      const isApproachingLongStay = prevState === 'APPROACHING' && longSlope < -LONG_SLOPE_THRESHOLD_STAY;

      if (isApproachingShort || isApproachingLongEnter || isApproachingLongStay) {
        classifications.push('APPROACHING');
        prevState = 'APPROACHING';
        continue;
      }

      // DRIFTING: Either fast drift OR slow drift (with hysteresis on long slope)
      const isDriftingShort = shortSlope > SHORT_SLOPE_THRESHOLD;
      const isDriftingLongEnter = longSlope > LONG_SLOPE_THRESHOLD_ENTER;
      const isDriftingLongStay = prevState === 'DRIFTING' && longSlope > LONG_SLOPE_THRESHOLD_STAY;

      if (isDriftingShort || isDriftingLongEnter || isDriftingLongStay) {
        classifications.push('DRIFTING');
        prevState = 'DRIFTING';
      } else {
        classifications.push('STABLE_DEVIATION');
        prevState = 'STABLE_DEVIATION';
      }
    }
  }

  // Log detailed classification info
  console.log(`\n=== classifyStates: metric=${metric}, threshold=${threshold} ===`);
  console.log(`Total points: ${rawValues.length}, thresholds: NEAR_FUSION_WIDTH=${NEAR_FUSION_WIDTH}, SHORT_SLOPE_THRESHOLD=${SHORT_SLOPE_THRESHOLD}`);
  console.log(`Hysteresis (LONG_SLOPE): ENTER=${LONG_SLOPE_THRESHOLD_ENTER}, STAY=${LONG_SLOPE_THRESHOLD_STAY}`);
  console.log(`Flatness detection: FLATNESS_THRESHOLD=${FLATNESS_THRESHOLD_CM} cm (window=${flatnessWindowPoints} points ≈ 0.25s)`);
  console.log(`Raw values range: [${Math.min(...rawValues).toFixed(3)}, ${Math.max(...rawValues).toFixed(3)}]`);
  console.log(`Flatness (stddev) range: [${Math.min(...flatnessStdDev).toFixed(4)}, ${Math.max(...flatnessStdDev).toFixed(4)}] cm`);

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
    const isFlatness = flatnessStdDev[idx] < FLATNESS_THRESHOLD_CM ? ' [FLATNESS]' : '';
    console.log(`  [${idx}] value=${valuesToClassify[idx].toFixed(3)}, flat=${(flatnessStdDev[idx] ?? 0).toFixed(4)}, shortSlope=${(shortSlopes[idx] ?? 0).toFixed(3)}, longSlope=${(longSlopes[idx] ?? 0).toFixed(3)}, state=${classifications[idx]}${isFlatness}`);
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

  // Log point-by-point classifications around segment boundaries
  console.log(`\n=== Point-by-point classifications (with slopes) ===`);
  const transitionIndices = new Set<number>();
  for (let i = 0; i < classifications.length; i++) {
    if (i === 0 || classifications[i] !== classifications[i - 1]) {
      transitionIndices.add(i);
      if (i > 0) transitionIndices.add(i - 1);
    }
  }

  // Also add context around transitions
  const detailedIndices = new Set<number>();
  transitionIndices.forEach(idx => {
    for (let j = Math.max(0, idx - 2); j <= Math.min(classifications.length - 1, idx + 2); j++) {
      detailedIndices.add(j);
    }
  });

  Array.from(detailedIndices).sort((a, b) => a - b).forEach(idx => {
    const isTransition = transitionIndices.has(idx);
    const marker = isTransition ? ' ◄──TRANSITION' : '';
    const t = (timeSeries[idx].t - timeSeries[0].t) / 1000;
    console.log(`  [${idx.toString().padEnd(4)}] t=${t.toFixed(3)}s value=${valuesToClassify[idx].toFixed(3)} shortSlope=${(shortSlopes[idx] ?? 0).toFixed(4)} longSlope=${(longSlopes[idx] ?? 0).toFixed(4)} → ${classifications[idx]}${marker}`);
  });

  console.log('candidateSegments (with slope details):');
  candidateSegments.forEach((seg, idx) => {
    const firstIdx = seg.startIdx;
    const lastIdx = seg.endIdx;
    const midIdx = Math.floor((firstIdx + lastIdx) / 2);

    const details = {
      index: idx,
      state: seg.state,
      duration: seg.duration.toFixed(2),
      range: `[${firstIdx}..${lastIdx}]`,
      firstPoint: {
        shortSlope: (shortSlopes[firstIdx] ?? 0).toFixed(3),
        longSlope: (longSlopes[firstIdx] ?? 0).toFixed(3),
      },
      midPoint: {
        shortSlope: (shortSlopes[midIdx] ?? 0).toFixed(3),
        longSlope: (longSlopes[midIdx] ?? 0).toFixed(3),
      },
      lastPoint: {
        shortSlope: (shortSlopes[lastIdx] ?? 0).toFixed(3),
        longSlope: (longSlopes[lastIdx] ?? 0).toFixed(3),
      },
    };
    console.log(`  [${details.index}] ${details.state} (${details.duration}s, indices ${details.range}):`, details);
  });

  // SECOND PASS: Identify which segments to keep (basic duration filter)
  const keepSegment = candidateSegments.map(seg => seg.duration >= MIN_SEGMENT_DURATION);

  // SECOND PASS (b): Context-aware filter for STABLE_DEVIATION segments.
  // A short stable plateau between two same-direction segments (DRIFTING+DRIFTING or
  // APPROACHING+APPROACHING) is likely a smoothing artefact and needs a higher minimum
  // duration. Between opposing directions (DRIFTING+APPROACHING or vice versa) it is a
  // genuine turning point and is kept at a lower threshold.
  for (let i = 0; i < candidateSegments.length; i++) {
    if (!keepSegment[i]) continue;
    if (candidateSegments[i].state !== 'STABLE_DEVIATION') continue;

    // Find nearest kept neighbours on each side
    let leftState: SessionState | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (keepSegment[j]) { leftState = candidateSegments[j].state; break; }
    }
    let rightState: SessionState | null = null;
    for (let j = i + 1; j < candidateSegments.length; j++) {
      if (keepSegment[j]) { rightState = candidateSegments[j].state; break; }
    }

    const bothDrifting   = leftState === 'DRIFTING'   && rightState === 'DRIFTING';
    const bothApproaching = leftState === 'APPROACHING' && rightState === 'APPROACHING';
    const oneEach = (leftState === 'DRIFTING' && rightState === 'APPROACHING')
                 || (leftState === 'APPROACHING' && rightState === 'DRIFTING');

    const dur = candidateSegments[i].duration;

    if ((bothDrifting || bothApproaching) && dur < STABLE_DEVIATION_MIN_SAME_DIRECTION_S) {
      keepSegment[i] = false;
      console.log(`  [context-filter] Dropping STABLE_DEVIATION [${i}] (${dur.toFixed(2)}s): surrounded by ${leftState}+${rightState}, needs ≥${STABLE_DEVIATION_MIN_SAME_DIRECTION_S}s`);
    } else if (oneEach && dur < STABLE_DEVIATION_MIN_TURNING_POINT_S) {
      keepSegment[i] = false;
      console.log(`  [context-filter] Dropping STABLE_DEVIATION [${i}] (${dur.toFixed(2)}s): turning point ${leftState}→${rightState}, needs ≥${STABLE_DEVIATION_MIN_TURNING_POINT_S}s`);
    }
  }

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

  // VALIDATION: Ensure no overlapping or degenerate segments after stretching
  // Check for degenerate segments first
  for (let i = 0; i < stretchedSegments.length; i++) {
    if (stretchedSegments[i].startTime > stretchedSegments[i].endTime) {
      console.warn(`Degenerate segment after stretching [${i}] ${stretchedSegments[i].state}:` +
        ` ${stretchedSegments[i].startTime.toFixed(2)} → ${stretchedSegments[i].endTime.toFixed(2)}`);
    }
  }

  // Adjacent segments should meet at a boundary, not overlap
  for (let i = 0; i < stretchedSegments.length - 1; i++) {
    if (stretchedSegments[i].endTime > stretchedSegments[i + 1].startTime) {
      console.warn(`Overlap after stretching [${i}-${i+1}]:` +
        ` ${stretchedSegments[i].state} ends at ${stretchedSegments[i].endTime.toFixed(2)},` +
        ` ${stretchedSegments[i + 1].state} starts at ${stretchedSegments[i + 1].startTime.toFixed(2)}`);
      // Segments overlap: adjust by meeting at the midpoint
      const midpoint = (stretchedSegments[i].endTime + stretchedSegments[i + 1].startTime) / 2;
      stretchedSegments[i].endTime = midpoint;
      stretchedSegments[i].duration = stretchedSegments[i].endTime - stretchedSegments[i].startTime;
      stretchedSegments[i + 1].startTime = midpoint;
      stretchedSegments[i + 1].duration = stretchedSegments[i + 1].endTime - stretchedSegments[i + 1].startTime;
    }
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

  // VALIDATION: Check for degenerate and overlapping segments after merging
  // Check for degenerate segments first
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].startTime > segments[i].endTime) {
      console.warn(`Degenerate segment after merging [${i}] ${segments[i].state}:` +
        ` ${segments[i].startTime.toFixed(2)} → ${segments[i].endTime.toFixed(2)}`);
    }
  }

  // Adjacent segments should meet at boundaries without overlap
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i].endTime > segments[i + 1].startTime) {
      console.warn(`Overlap after merging [${i}-${i+1}]:` +
        ` ${segments[i].state} ends at ${segments[i].endTime.toFixed(2)},` +
        ` ${segments[i + 1].state} starts at ${segments[i + 1].startTime.toFixed(2)}`);
      // Segments overlap: adjust by meeting at the midpoint
      const midpoint = (segments[i].endTime + segments[i + 1].startTime) / 2;
      segments[i].endTime = midpoint;
      segments[i].duration = segments[i].endTime - segments[i].startTime;
      segments[i + 1].startTime = midpoint;
      segments[i + 1].duration = segments[i + 1].endTime - segments[i + 1].startTime;
    }
  }

  // REFINEMENT PASS: Tighten DRIFTING/APPROACHING boundaries using short-window slopes
  segments.forEach((seg, idx) => {
    if (seg.state === 'DRIFTING' || seg.state === 'APPROACHING') {
      const originalStart = seg.startTime;
      const originalEnd = seg.endTime;
      const refinedStart = refineEnter(seg.startTime, shortSlopes, timeSeries);
      const refinedEnd = refineExit(seg.endTime, shortSlopes, timeSeries);

      if (refinedStart > refinedEnd) {
        // Degenerate segment; log the issue for debugging
        console.warn(`Refinement created degenerate segment [${idx}] ${seg.state}:` +
          ` original ${originalStart.toFixed(2)}-${originalEnd.toFixed(2)},` +
          ` refined ${refinedStart.toFixed(2)}-${refinedEnd.toFixed(2)}`);
      } else {
        if (refinedStart !== originalStart || refinedEnd !== originalEnd) {
          console.log(`Refined [${idx}] ${seg.state}: ${originalStart.toFixed(2)}-${originalEnd.toFixed(2)}` +
            ` → ${refinedStart.toFixed(2)}-${refinedEnd.toFixed(2)}`);
        }
        seg.startTime = refinedStart;
        seg.endTime = refinedEnd;
        seg.duration = seg.endTime - seg.startTime;
      }
    }
  });

  console.log(`\nBoundary refinement complete (DRIFTING/APPROACHING boundaries tightened via short-window slope scans).`);

  // FINAL VALIDATION: Fix any overlaps, degenerate segments, and gaps
  const sessionStart = timeSeries[0].t / 1000;
  const sessionEnd = timeSeries[timeSeries.length - 1].t / 1000;

  // Step 1: Detect and fix degenerate segments (startTime > endTime)
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].startTime > segments[i].endTime) {
      // Swap if backward
      const temp = segments[i].startTime;
      segments[i].startTime = segments[i].endTime;
      segments[i].endTime = temp;
      segments[i].duration = segments[i].endTime - segments[i].startTime;
    }
  }

  // Step 2: Remove segments with zero or near-zero duration
  const validSegments = segments.filter(seg => seg.duration > 0.001);

  // Step 3: Fix overlaps by adjusting boundaries
  for (let i = 0; i < validSegments.length - 1; i++) {
    if (validSegments[i].endTime > validSegments[i + 1].startTime) {
      // Segments overlap
      const overlap = validSegments[i].endTime - validSegments[i + 1].startTime;
      // Split the overlap: give half to each segment
      const splitPoint = validSegments[i].startTime + (validSegments[i].duration - overlap / 2);
      validSegments[i].endTime = splitPoint;
      validSegments[i].duration = validSegments[i].endTime - validSegments[i].startTime;
      validSegments[i + 1].startTime = splitPoint;
      validSegments[i + 1].duration = validSegments[i + 1].endTime - validSegments[i + 1].startTime;
    }
  }

  // Step 4: Ensure full coverage from session start to session end
  // Extend first segment to session start
  if (validSegments.length > 0) {
    validSegments[0].startTime = sessionStart;
    validSegments[0].duration = validSegments[0].endTime - validSegments[0].startTime;
  }

  // Extend last segment to session end
  if (validSegments.length > 0) {
    validSegments[validSegments.length - 1].endTime = sessionEnd;
    validSegments[validSegments.length - 1].duration =
      validSegments[validSegments.length - 1].endTime -
      validSegments[validSegments.length - 1].startTime;
  }

  // Step 5: Fill any remaining gaps
  // If there are gaps between segments, extend one side to cover it
  for (let i = 0; i < validSegments.length - 1; i++) {
    const gap = validSegments[i + 1].startTime - validSegments[i].endTime;
    if (gap > 0.001) {
      // Gap detected: extend current segment to close it
      validSegments[i].endTime = validSegments[i + 1].startTime;
      validSegments[i].duration = validSegments[i].endTime - validSegments[i].startTime;
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
  console.log(`\nAfter validation and degenerate segment fixes: ${validSegments.length} segments`);

  // Detailed segment info with boundary identification
  console.log(`\n=== FINAL SEGMENTATION DETAILS ===`);
  validSegments.forEach((seg, idx) => {
    const startIdx = timeSeries.findIndex(p => (p.t - timeSeries[0].t) / 1000 >= seg.startTime);
    const endIdx = Math.max(startIdx,
      timeSeries.length - 1 - timeSeries.slice().reverse().findIndex(p => (p.t - timeSeries[0].t) / 1000 <= seg.endTime)
    );

    const startValue = startIdx >= 0 && startIdx < timeSeries.length
      ? getMetricValue(timeSeries[startIdx], metric).toFixed(2)
      : 'N/A';
    const endValue = endIdx >= 0 && endIdx < timeSeries.length
      ? getMetricValue(timeSeries[endIdx], metric).toFixed(2)
      : 'N/A';

    console.log(`Segment ${idx}: ${seg.state}`);
    console.log(`  Time: ${seg.startTime.toFixed(2)}s - ${seg.endTime.toFixed(2)}s (duration ${seg.duration.toFixed(2)}s)`);
    console.log(`  Indices: ${startIdx} - ${endIdx}`);
    console.log(`  Value at start: ${startValue} cm, at end: ${endValue} cm`);
    if (seg.metrics) {
      console.log(`  Metrics: min=${seg.metrics.minDeviation.toFixed(2)}, ` +
        `max=${seg.metrics.maxDeviation.toFixed(2)}, ` +
        `mean=${seg.metrics.meanDeviation.toFixed(2)}, ` +
        `slope=${seg.metrics.intraSegmentSlope.toFixed(3)} cm/s`);
    }
  });

  validSegments.forEach((seg, idx) => {
    console.log(`  Segment ${idx}: ${seg.state} (${seg.startTime.toFixed(3)}s-${seg.endTime.toFixed(3)}s, duration=${seg.duration.toFixed(3)}s)`);
  });

  // Check for coverage (should be 100% after full coverage validation)
  const totalDuration = sessionEnd - sessionStart;
  let coveredTime = 0;
  validSegments.forEach(s => { coveredTime += s.duration; });
  console.log(`Total duration: ${totalDuration.toFixed(2)}s | Covered by final segments: ${coveredTime.toFixed(2)}s | Coverage: ${((coveredTime / totalDuration) * 100).toFixed(1)}%`);
  console.log('===\n');

  // METRICS PASS: Compute quality metrics for each segment
  validSegments.forEach(seg => {
    seg.metrics = computeSegmentMetrics(timeSeries, seg, metric, smoothed, pointsPerSecond);
  });

  console.log(`\nSegment metrics computed: ${validSegments.length} segments have quality data.`);

  return validSegments;
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

export function computeSessionAggregateMetrics(
  stateSegments: StateSegment[],
  timeSeries: TimeSeries[]
): {
  bestStableDeviation: number;
  nearBestStableTime: number;
  longestQualityStreak: number;
  qualityPercent: number;
  driftingPercent: number;
  approachingPercent: number;
} {
  // 1. Find bestStableDeviation from quality states
  let bestMeanDev = Infinity;
  for (const seg of stateSegments) {
    if ((seg.state === 'FUSION' || seg.state === 'NEAR_FUSION' || seg.state === 'STABLE_DEVIATION') && seg.metrics) {
      bestMeanDev = Math.min(bestMeanDev, seg.metrics.meanDeviation);
    }
  }

  // Fallback if no quality segments exist
  if (!isFinite(bestMeanDev)) {
    bestMeanDev = Math.max(...timeSeries.map(p => Math.sqrt(p.x * p.x + p.y * p.y)));
  }

  // 2. Find session max deviation
  const sessionMaxDev = Math.max(...timeSeries.map(p => Math.sqrt(p.x * p.x + p.y * p.y)));

  // 3. Compute threshold using band percent constant
  const nearBestThreshold = bestMeanDev + (NEAR_BEST_THRESHOLD_BAND_PERCENT / 100) * (sessionMaxDev - bestMeanDev);

  // 4. Filter to quality segments and sum durations / find longest
  let nearBestTotalTime = 0;
  let longestQualityStreak = 0;
  for (const seg of stateSegments) {
    const isQuality = (seg.state === 'FUSION' || seg.state === 'NEAR_FUSION' || seg.state === 'STABLE_DEVIATION');
    if (isQuality && seg.metrics && seg.metrics.meanDeviation <= nearBestThreshold) {
      nearBestTotalTime += seg.duration;
      longestQualityStreak = Math.max(longestQualityStreak, seg.duration);
    }
  }

  // 5. Compute percentages
  const sessionDuration = timeSeries.length > 1
    ? (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000
    : 1;

  const qualityPercent = (nearBestTotalTime / sessionDuration) * 100;

  let driftingTime = 0, approachingTime = 0;
  for (const seg of stateSegments) {
    if (seg.state === 'DRIFTING') driftingTime += seg.duration;
    if (seg.state === 'APPROACHING') approachingTime += seg.duration;
  }

  return {
    bestStableDeviation: bestMeanDev,
    nearBestStableTime: nearBestTotalTime,
    longestQualityStreak,
    qualityPercent,
    driftingPercent: (driftingTime / sessionDuration) * 100,
    approachingPercent: (approachingTime / sessionDuration) * 100,
  };
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
  // Compute session-level aggregate metrics from segments
  const aggregateMetrics = computeSessionAggregateMetrics(stateSegments, timeSeries);
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
    bestStableDeviation: aggregateMetrics.bestStableDeviation,
    nearBestStableTime: aggregateMetrics.nearBestStableTime,
    qualityPercent: aggregateMetrics.qualityPercent,
    driftingPercent: aggregateMetrics.driftingPercent,
    approachingPercent: aggregateMetrics.approachingPercent,
    timeToFirstFusion,
    fusionEventCount,
    fusionAchievedCount: fusionMetrics.fusionAchieved ? 1 : 0,
    longestFusionStreak,
    longestQualityStreak: aggregateMetrics.longestQualityStreak,
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
