---
Enhanced Session Segmentation Implementation Plan

▎ For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
(- [ ]) syntax for tracking.

Goal: Add dual-timescale slope detection, segment quality metrics, and boundary refinement to enable clinicians to distinguish session quality for non-fusion users.

Architecture: Enhance classifyStates() in sessionMetrics.ts to compute slopes at both 0.5s and 5.0s windows, apply OR logic for state classification, refine DRIFTING/APPROACHING boundaries
 using short-window slope crossing scans, and attach quality metrics (median, variance, intra-segment slope) to each segment.

Tech Stack: TypeScript, Vitest (unit tests), existing smoothing/slope utilities

---
File Structure

┌────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                    File                    │                                                    Responsibility                                                    │
├────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/types/analysis.ts                      │ Add SegmentMetrics interface (quality metadata for segments)                                                         │
├────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/utils/sessionMetrics.ts                │ Core FSM enhancement: constants, dual-slope computation, OR classification, boundary refinement, metrics computation │
├────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/utils/__tests__/sessionMetrics.test.ts │ Unit tests for new behavior: dual slopes, refinement, metrics                                                        │
├────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ docs/architecture.md                       │ Update FSM section with new state detection logic                                                                    │
├────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ docs/development.md                        │ Document new constants and segmentation notes                                                                        │
└────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

---
Phase 1: Types & Constants

Task 1: Add SegmentMetrics Interface to analysis.ts

Files:
- Modify: src/types/analysis.ts
- Step 1: Read the existing StateSegment interface

Run: grep -A 10 "interface StateSegment" src/types/analysis.ts

Expected: See current fields (state, startTime, endTime, duration)

- Step 2: Add SegmentMetrics interface before StateSegment

Edit src/types/analysis.ts at the top of the file, after line 36 (after StateSegment type definition comment). Add:

export interface SegmentMetrics {
  // Univariate statistics (from raw data within segment)
  medianDeviation: number;        // Median value within segment
  minDeviation: number;           // Best (lowest) achieved within segment
  maxDeviation: number;           // Worst (highest) within segment
  meanDeviation: number;          // Arithmetic mean within segment
  varianceWithinSegment: number;  // Population variance; low = stable, high = volatile
  stdDevWithinSegment: number;    // Standard deviation

  // Intra-segment trend (in cm/s)
  intraSegmentSlope: number;      // Mean slope within segment; negative = improving, positive = declining
}

- Step 3: Extend StateSegment interface with metrics field

Locate export interface StateSegment around line 37. Modify to add the metrics field:

export interface StateSegment {
  state: SessionState;
  startTime: number;
  endTime: number;
  duration: number;
  metrics?: SegmentMetrics;    // Computed eagerly during classifyStates(); always present after classification
}

- Step 4: Verify TypeScript compiles

Run: npm run build 2>&1 | head -20

Expected: No errors in analysis.ts

- Step 5: Commit

git add src/types/analysis.ts
git commit -m "feat: add SegmentMetrics interface for segment quality data"

---
Task 2: Add Constants and Sampling Rate Computation to sessionMetrics.ts

Files:
- Modify: src/utils/sessionMetrics.ts (top of file, before classifyStates function)
- Step 1: Read the current constants in classifyStates

Run: grep -n "const SLOPE_THRESHOLD\|const NEAR_FUSION_WIDTH\|const MIN_SEGMENT_DURATION\|const DEFAULT_SG_WINDOW" src/utils/sessionMetrics.ts | head -10

Expected: See existing constants around lines 105-108

- Step 2: Replace old constants with new ones

Find the section around line 105 that starts with const SLOPE_THRESHOLD = 0.1;. Replace the entire constants block (lines ~105-108) with:

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

- Step 3: Add sampling rate computation function

Add this new function right after the constants block and before the existing classifyStates() function (around line 110):

function computeSamplingRate(timeSeries: TimeSeries[]): number {
  if (timeSeries.length < 2) return 20; // default fallback

  // Compute median interval from time series, then derive points/second
  const intervals = timeSeries.slice(1).map((p, i) => p.t - timeSeries[i].t);
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const medianIntervalMs = sortedIntervals[Math.floor(sortedIntervals.length / 2)];

  return medianIntervalMs > 0 ? 1000 / medianIntervalMs : 20;
}

- Step 4: Verify no syntax errors

Run: npm run build 2>&1 | grep -A 2 "sessionMetrics.ts" || echo "No errors in sessionMetrics.ts"

Expected: No errors, or errors only in classifyStates (expected, not yet modified)

- Step 5: Commit

git add src/utils/sessionMetrics.ts
git commit -m "feat: add constants for dual-timescale slope detection and sampling rate computation"

---
Phase 2: Core FSM Classification

Task 3: Implement Dual-Slope Computation in classifyStates

Files:
- Modify: src/utils/sessionMetrics.ts → classifyStates() function, right after smoothing
- Step 1: Locate the smoothing block in classifyStates

Run: sed -n '110,140p' src/utils/sessionMetrics.ts

Expected: See the smoothing logic (smoothSeries call) around line 122–129

- Step 2: Find where slopes are currently computed

Run: grep -n "calculateSlope" src/utils/sessionMetrics.ts

Expected: Line showing const slopes = calculateSlope(smoothed, 10); around line 140

- Step 3: Replace single-slope computation with dual-slope + unit conversion

Find the line const slopes = calculateSlope(smoothed, 10); (around line 140) and the lines immediately after. Replace with:

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

// Legacy variable for log output (will be updated in later task)
const slopes = shortSlopes;

- Step 4: Verify compilation

Run: npm run build 2>&1 | head -30

Expected: Should have errors in classifyStates map function (expected, not yet updated the classification logic)

- Step 5: Commit

git add src/utils/sessionMetrics.ts
git commit -m "feat: compute dual-timescale slopes and convert to cm/s"

---
Task 4: Implement OR Logic Classification

Files:
- Modify: src/utils/sessionMetrics.ts → classifyStates() function, classification map
- Step 1: Locate the classification map

Run: sed -n '142,160p' src/utils/sessionMetrics.ts

Expected: See the classifications: SessionState[] = valuesToClassify.map(...) block

- Step 2: Replace classification logic with OR condition

Find the classifications: SessionState[] = valuesToClassify.map((value, i) => { block and replace the entire map function body (the condition checks) with:

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

- Step 3: Verify no unclassified points

The existing logging code (around line 157) should still work. Run npm run build to check:

Run: npm run build 2>&1 | grep -i "error.*sessionMetrics" || echo "Compilation check passed"

Expected: No sessionMetrics-specific errors

- Step 4: Commit

git add src/utils/sessionMetrics.ts
git commit -m "feat: implement OR logic for dual-slope classification (fast + slow detection)"

---
Phase 3: Boundary Refinement

Task 5: Implement refineEnter and refineExit Functions

Files:
- Modify: src/utils/sessionMetrics.ts (add functions before classifyStates)
- Step 1: Add refineEnter function

Insert this function right before the classifyStates() function (around line 110):

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

- Step 2: Add refineExit function

Insert this function right after refineEnter:

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

- Step 3: Verify functions compile

Run: npm run build 2>&1 | head -20

Expected: No syntax errors in the new functions

- Step 4: Commit

git add src/utils/sessionMetrics.ts
git commit -m "feat: add boundary refinement functions (refineEnter/refineExit)"

---
Task 6: Integrate Boundary Refinement into classifyStates

Files:
- Modify: src/utils/sessionMetrics.ts → classifyStates() after segment merging
- Step 1: Locate the merging pass

Run: sed -n '223,237p' src/utils/sessionMetrics.ts

Expected: See the "FOURTH PASS" comment and merging loop

- Step 2: Add refinement pass after merging

After the merging pass (after the line console.log(...); that closes the merging logs), add this new refinement pass:

// REFINEMENT PASS: Tighten DRIFTING/APPROACHING boundaries using short-window slopes
segments.forEach(seg => {
  if (seg.state === 'DRIFTING' || seg.state === 'APPROACHING') {
    const refinedStart = refineEnter(seg.startTime, shortSlopes, timeSeries);
    const refinedEnd = refineExit(seg.endTime, shortSlopes, timeSeries);

    if (refinedStart > refinedEnd) {
      // Degenerate segment; use original boundaries
      // This can happen on very noisy signals
    } else {
      seg.startTime = refinedStart;
      seg.endTime = refinedEnd;
      seg.duration = seg.endTime - seg.startTime;
    }
  }
});

console.log(`\nBoundary refinement complete (DRIFTING/APPROACHING boundaries tightened via short-window slope scans).`);

- Step 3: Verify the refinement code is syntactically correct

Run: npm run build 2>&1 | grep -i error | head -5 || echo "Build check passed"

Expected: No errors, or only errors from metrics computation (not yet implemented)

- Step 4: Commit

git add src/utils/sessionMetrics.ts
git commit -m "feat: integrate boundary refinement into classifyStates"

---
Phase 4: Segment Metrics Computation

Task 7: Implement computeSegmentMetrics Function

Files:
- Modify: src/utils/sessionMetrics.ts (add function before classifyStates)
- Step 1: Add the computeSegmentMetrics function

Insert this function right after the refinement functions and before classifyStates():

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

- Step 2: Verify the function imports SegmentMetrics

Run: grep "import.*SegmentMetrics" src/utils/sessionMetrics.ts || echo "Need to add import"

Expected: If "Need to add import" appears, add this line at the top of sessionMetrics.ts with other imports: import { ..., SegmentMetrics, ... } from '../types/analysis';

- Step 3: Update the import if needed

Find the existing import line from ../types/analysis. It should look like:

import { Session, TimeSeries } from '../types';
import { SessionMetrics, StateSegment, SessionState } from '../types/analysis';

Update the second line to include SegmentMetrics:

import { SessionMetrics, StateSegment, SessionState, SegmentMetrics } from '../types/analysis';

- Step 4: Verify compilation

Run: npm run build 2>&1 | grep -c "error" | grep -q "0" && echo "Build succeeded" || npm run build 2>&1 | head -20

Expected: Either "Build succeeded" or a count of 0 errors

- Step 5: Commit

git add src/utils/sessionMetrics.ts
git commit -m "feat: implement computeSegmentMetrics function for segment quality analysis"

---
Task 8: Integrate Metrics Computation into classifyStates

Files:
- Modify: src/utils/sessionMetrics.ts → final pass in classifyStates()
- Step 1: Locate where segments are returned

Run: sed -n '256,260p' src/utils/sessionMetrics.ts

Expected: See the line return segments; after the refinement pass

- Step 2: Add metrics computation pass before return

Right before return segments; (around line 259), add:

// METRICS PASS: Compute quality metrics for each segment
segments.forEach(seg => {
  seg.metrics = computeSegmentMetrics(timeSeries, seg, metric, smoothed, pointsPerSecond);
});

console.log(`\nSegment metrics computed: ${segments.length} segments have quality data.`);

- Step 3: Verify compilation

Run: npm run build 2>&1 | head -20

Expected: Should compile without errors in sessionMetrics.ts

- Step 4: Commit

git add src/utils/sessionMetrics.ts
git commit -m "feat: integrate segment metrics computation into classifyStates final pass"

---
Phase 5: Testing

Task 9: Write Tests for Dual-Slope Classification

Files:
- Modify: src/utils/__tests__/sessionMetrics.test.ts
- Step 1: Add a test for fast drift detection (short slope)

Locate the end of the existing describe('classifyStates', ...) block. Add this test:

it('detects fast drift (short slope > SHORT_SLOPE_THRESHOLD)', () => {
  // Create a session: 0→8 cm in ~1 second
  // At 50ms sampling: 20 points over 1 second
  const timeSeries: TimeSeries[] = [];
  for (let i = 0; i < 20; i++) {
    const deviation = (i / 20) * 8; // 0 to 8 cm
    timeSeries.push({
      t: i * 50,
      x: deviation,
      y: 0,
      r: 0,
    });
  }

  const segments = classifyStates(timeSeries, 0.5, 'deviation');

  // Should have a DRIFTING segment (fast slope > 1.0 cm/s)
  const driftingSegments = segments.filter(s => s.state === 'DRIFTING');
  expect(driftingSegments.length).toBeGreaterThan(0);
  expect(driftingSegments[0].duration).toBeCloseTo(1.0, 1);
});

- Step 2: Add a test for slow drift detection (long slope)

Add this test right after the fast drift test:

it('detects slow drift (long slope > LONG_SLOPE_THRESHOLD)', () => {
  // Create a session: 3→8 cm over ~15 seconds (0.33 cm/s)
  // At 50ms sampling: 300 points over 15 seconds
  const timeSeries: TimeSeries[] = [];
  for (let i = 0; i < 300; i++) {
    const deviation = 3 + (i / 300) * 5; // 3 to 8 cm
    timeSeries.push({
      t: i * 50,
      x: deviation,
      y: 0,
      r: 0,
    });
  }

  const segments = classifyStates(timeSeries, 0.5, 'deviation');

  // Should have a DRIFTING segment (long slope 0.33 cm/s > 0.02 cm/s)
  const driftingSegments = segments.filter(s => s.state === 'DRIFTING');
  expect(driftingSegments.length).toBeGreaterThan(0);
  expect(driftingSegments[0].duration).toBeCloseTo(15.0, 0);
});

- Step 3: Add a test for stable deviation (both slopes near zero)

Add this test:

it('classifies stable deviation (both slopes ≈ 0)', () => {
  // Create a session: constant 4 cm for 10 seconds
  const timeSeries: TimeSeries[] = [];
  for (let i = 0; i < 200; i++) {
    timeSeries.push({
      t: i * 50,
      x: 4,
      y: 0,
      r: 0,
    });
  }

  const segments = classifyStates(timeSeries, 0.5, 'deviation');

  // Should have a STABLE_DEVIATION segment
  expect(segments.length).toBe(1);
  expect(segments[0].state).toBe('STABLE_DEVIATION');
  expect(segments[0].duration).toBeCloseTo(10.0, 0);
});

- Step 4: Run the new tests

Run: npm test -- src/utils/__tests__/sessionMetrics.test.ts -t "detects fast drift" 2>&1 | tail -20

Expected: Tests pass (or fail if implementation has issues — debug and fix)

- Step 5: Commit

git add src/utils/__tests__/sessionMetrics.test.ts
git commit -m "test: add tests for dual-slope classification (fast, slow, stable)"

---
Task 10: Write Tests for Boundary Refinement

Files:
- Modify: src/utils/__tests__/sessionMetrics.test.ts
- Step 1: Add a test for boundary refinement precision

Add this test in the classifyStates block:

it('refines slow-drift boundaries to ±0.25s precision', () => {
  // Create a session: drift 3→5 cm over 5s, then stable at 5cm for 5s
  // Total 300 points at 50ms
  // First 100 points (5s): linear drift from 3→5 cm
  // Next 100 points (5s): stable at 5 cm
  const timeSeries: TimeSeries[] = [];
  for (let i = 0; i < 200; i++) {
    const time_s = i * 0.05;
    let deviation: number;
    if (time_s < 5.0) {
      deviation = 3 + (time_s / 5.0) * 2; // 3→5 cm in first 5s
    } else {
      deviation = 5.0; // stable at 5cm
    }
    timeSeries.push({
      t: i * 50,
      x: deviation,
      y: 0,
      r: 0,
    });
  }

  const segments = classifyStates(timeSeries, 0.5, 'deviation');

  // Should have DRIFTING (0-5s) and STABLE_DEVIATION (5-10s)
  // The refined boundary should be close to 5s ± 0.25s
  const drifting = segments.find(s => s.state === 'DRIFTING');
  const stable = segments.find(s => s.state === 'STABLE_DEVIATION');

  expect(drifting).toBeDefined();
  expect(stable).toBeDefined();
  expect(drifting!.endTime).toBeCloseTo(5.0, 1); // Within ±0.5s
  expect(stable!.startTime).toBeCloseTo(5.0, 1);
});

- Step 2: Run the boundary refinement test

Run: npm test -- src/utils/__tests__/sessionMetrics.test.ts -t "refines slow-drift" 2>&1 | tail -20

Expected: Test passes

- Step 3: Commit

git add src/utils/__tests__/sessionMetrics.test.ts
git commit -m "test: add test for boundary refinement precision"

---
Task 11: Write Tests for Segment Metrics Computation

Files:
- Modify: src/utils/__tests__/sessionMetrics.test.ts
- Step 1: Add a test for metrics on a constant segment

Add this test in the classifyStates block:

it('computes metrics correctly for a stable segment', () => {
  // Create a session: constant 4 cm for 10 seconds
  const timeSeries: TimeSeries[] = [];
  for (let i = 0; i < 200; i++) {
    timeSeries.push({
      t: i * 50,
      x: 4,
      y: 0,
      r: 0,
    });
  }

  const segments = classifyStates(timeSeries, 0.5, 'deviation');

  expect(segments.length).toBe(1);
  const metrics = segments[0].metrics;
  expect(metrics).toBeDefined();
  expect(metrics!.medianDeviation).toBeCloseTo(4.0, 2);
  expect(metrics!.minDeviation).toBeCloseTo(4.0, 2);
  expect(metrics!.maxDeviation).toBeCloseTo(4.0, 2);
  expect(metrics!.meanDeviation).toBeCloseTo(4.0, 2);
  expect(metrics!.varianceWithinSegment).toBeCloseTo(0, 4);
  expect(metrics!.intraSegmentSlope).toBeCloseTo(0, 4);
});

- Step 2: Add a test for metrics on a drifting segment

Add this test:

it('computes metrics correctly for a drifting segment', () => {
  // Create a session: linear drift 3→8 cm over 15 seconds
  const timeSeries: TimeSeries[] = [];
  for (let i = 0; i < 300; i++) {
    const deviation = 3 + (i / 300) * 5;
    timeSeries.push({
      t: i * 50,
      x: deviation,
      y: 0,
      r: 0,
    });
  }

  const segments = classifyStates(timeSeries, 0.5, 'deviation');

  const drifting = segments.find(s => s.state === 'DRIFTING');
  expect(drifting).toBeDefined();

  const metrics = drifting!.metrics;
  expect(metrics).toBeDefined();
  expect(metrics!.minDeviation).toBeCloseTo(3.0, 1);
  expect(metrics!.maxDeviation).toBeCloseTo(8.0, 1);
  expect(metrics!.intraSegmentSlope).toBeGreaterThan(0.25); // positive slope (drifting away)
});

- Step 3: Run the metrics tests

Run: npm test -- src/utils/__tests__/sessionMetrics.test.ts -t "computes metrics" 2>&1 | tail -30

Expected: Both metrics tests pass

- Step 4: Commit

git add src/utils/__tests__/sessionMetrics.test.ts
git commit -m "test: add tests for segment metrics computation"

---
Task 12: Update Existing Tests for New Behavior

Files:
- Modify: src/utils/__tests__/sessionMetrics.test.ts
- Step 1: Run all existing sessionMetrics tests

Run: npm test -- src/utils/__tests__/sessionMetrics.test.ts 2>&1 | tail -50

Expected: Some tests may fail due to changed slope thresholds and APPROACHING/DRIFTING detection behavior

- Step 2: Review failures and update test expectations

If tests fail with "expected STABLE_DEVIATION but got DRIFTING", this is expected due to the new OR logic. Review the failing test and either:
- Update the test expectations if the new behavior is correct
- Or verify that the spec requires this change

For example, if a test creates a slow drift and expected STABLE_DEVIATION, update it to expect DRIFTING (now detected by long slope).

Example update for a test that expected STABLE_DEVIATION for a 0.3 cm/s drift:

Change:
expect(segment.state).toBe('STABLE_DEVIATION');

To:
expect(segment.state).toBe('DRIFTING'); // Now detected by long slope > 0.02 cm/s

- Step 3: Run all tests again

Run: npm test -- src/utils/__tests__/sessionMetrics.test.ts 2>&1 | tail -10

Expected: All tests pass (green checkmarks)

- Step 4: Commit

git add src/utils/__tests__/sessionMetrics.test.ts
git commit -m "test: update existing tests for dual-slope classification behavior"

---
Phase 6: Documentation

Task 13: Update docs/architecture.md

Files:
- Modify: docs/architecture.md
- Step 1: Locate the FSM documentation section

Run: grep -n "Session State Classification\|FSM\|FUSION.*APPROACHING" docs/architecture.md | head -5

Expected: Find the line numbers for the FSM section

- Step 2: Update the FSM state description

Find the section describing the current states (e.g., lines ~58–65). Update it to describe the new dual-timescale detection:

Replace the old description with:

### Session State Classification

The FSM classifies each data point into one of five states based on deviation value and slopes at two timescales:

- **FUSION:** deviation < threshold
- **NEAR_FUSION:** threshold ≤ deviation < threshold + 1 cm
- **APPROACHING:** (shortSlope < -1.0 cm/s) OR (longSlope < -0.02 cm/s) — convergence, fast or slow
- **DRIFTING:** (shortSlope > +1.0 cm/s) OR (longSlope > +0.02 cm/s) — divergence, fast or slow
- **STABLE_DEVIATION:** deviation ≥ threshold + 1 cm AND both slopes ≤ their thresholds

**Key enhancement:** Dual-timescale slope detection using 0.5 s (short) and 5.0 s (long) windows converted to cm/s. The OR logic catches both rapid transitions and gradual, sustained
trends. Boundaries are refined using short-window slope crossing scans for ±0.25 s precision.

Each segment carries optional quality metrics: median/min/max deviation, variance, and intra-segment slope.

- Step 3: Verify markdown syntax

Run: head -100 docs/architecture.md | tail -20

Expected: No obvious syntax errors in the updated section

- Step 4: Commit

git add docs/architecture.md
git commit -m "docs: update architecture.md with dual-timescale FSM description"

---
Task 14: Update docs/development.md

Files:
- Modify: docs/development.md
- Step 1: Locate the "Session Segmentation" section

Run: grep -n "Session Segmentation\|MIN_SEGMENT_DURATION\|Segmentation debugging" docs/development.md | head -5

Expected: Find the segmentation notes section

- Step 2: Add notes about new constants and refinement

Find the section mentioning MIN_SEGMENT_DURATION and slope thresholds. Add/update it with:

**Segmentation parameters:** Window lengths are now specified in seconds (SHORT_SLOPE_WINDOW_S=0.5, LONG_SLOPE_WINDOW_S=5.0) and automatically converted to points at runtime based on
detected sampling rate. Thresholds: SHORT_SLOPE_THRESHOLD=1.0 cm/s (fast changes), LONG_SLOPE_THRESHOLD=0.02 cm/s (sustained changes). Sampling rate is computed from median inter-point
interval, making the FSM robust to variable sampling rates.

**Boundary refinement:** DRIFTING and APPROACHING segment boundaries are refined using short-window slope crossing scans within a ±halfLongWindow bracket, achieving ±0.25s precision. The
refinement scan crosses LONG_SLOPE_THRESHOLD (not SHORT), so it works uniformly for both fast and slow transitions.

**Segment metrics:** After finalization, each segment computes SegmentMetrics: medianDeviation, minDeviation, maxDeviation, meanDeviation, varianceWithinSegment, stdDevWithinSegment,
intraSegmentSlope. These are computed from the raw data within the segment and stored in StateSegment.metrics (optional field).

**Segmentation debugging:** `classifyStates()` in `src/utils/sessionMetrics.ts` logs detailed breakdowns: raw values range, classification results, candidate segments, stretching
operations, merging, boundary refinement, and metrics summary. Open browser DevTools console when viewing sessions to inspect.

- Step 3: Verify no markdown syntax errors

Run: grep -A 5 "Segment metrics:" docs/development.md

Expected: New text appears without syntax errors

- Step 4: Commit

git add docs/development.md
git commit -m "docs: update development.md with segmentation parameters and metrics notes"

---
Phase 7: Verification

Task 15: Full Integration Test and Verification

Files:
- No new files; verification only
- Step 1: Run full build

Run: npm run build 2>&1 | tail -20

Expected: Build succeeds with no errors

- Step 2: Run full test suite

Run: npm test 2>&1 | tail -50

Expected: All tests pass, including the new segmentation tests

- Step 3: Verify no regressions on existing sessions

Run: npm test -- src/utils/__tests__/sessionMetrics.test.ts::calculateFusionMetrics 2>&1

Expected: Existing fusion metrics tests still pass (metrics unaffected by segmentation changes)

- Step 4: Manual smoke test — record a short session

Open the app (npm run dev), record a 30-second session with deliberate drifting (start at ~2cm, slowly drift to ~5cm), then review. Verify:
- Timeline shows DRIFTING segment(s) (not all STABLE_DEVIATION)
- Segment metrics are populated (visible in console logs)
- No console errors
- Step 5: Final commit and summary

Run: git log --oneline -15

Expected: See all the commits from this implementation

Run:
git diff main HEAD --stat

Expected: Shows all files modified and approximate line changes

Create a summary commit:
git commit --allow-empty -m "feat: dual-timescale segmentation with metrics (complete)

Summary of changes:
- Add SegmentMetrics interface for segment quality data
- Implement dual-slope detection at 0.5s and 5.0s windows
- Apply OR logic for APPROACHING/DRIFTING classification
- Refine DRIFTING/APPROACHING boundaries using short-window crossing scans
- Compute segment quality metrics (median, variance, slope)
- Add comprehensive tests for new behavior
- Update documentation (architecture.md, development.md)

All tests pass. Backward compatible: StateSegment.metrics is optional."
