# Enhanced Session Segmentation & Quality Metrics Design

**Date:** 2026-04-03
**Status:** Design Review
**Author:** Brainstorming Process

---

## Executive Summary

This spec addresses a critical gap in the current system: users who cannot achieve fusion are poorly distinguished from each other, all collapsed into a single `STABLE_DEVIATION` state. Sessions can vary dramatically in quality—one patient might achieve 3 cm deviation for 1 second then drift to 8 cm, while another holds 4 cm stably for 10 seconds—but the current metrics treat them identically.

**Solution:** Enhance the finite state machine (FSM) to detect both fast *and* slow state transitions using dual-timescale slope detection, and attach rich quality metrics to each state segment. This allows clinicians to see:
- Session-level quality distinctions even when no fusion is achieved
- Intra-segment trajectory (drifting away vs holding steady)
- Cross-session trends in stability and control

**Key changes:**
1. Compute slopes at two timescales (~0.5 seconds and 5 seconds)
2. Use OR logic for state classification: enter `APPROACHING` or `DRIFTING` if *either* timescale shows movement
3. Attach segment-level metrics (median, variance, intra-segment slope) for fine-grained analysis
4. FSM remains at 5 states—no explosion, semantic meaning preserved

---

## 1. Problem Statement

### Current System Behavior

The existing FSM classifies each data point into one of five states based on deviation value and short-term slope:

```
FUSION:           deviation < threshold
NEAR_FUSION:      threshold ≤ deviation < threshold + 1 cm
APPROACHING:      deviation ≥ threshold + 1 cm AND slope < -0.1 cm/point (descending quickly)
DRIFTING:         deviation ≥ threshold + 1 cm AND slope > +0.1 cm/point (ascending quickly)
STABLE_DEVIATION: deviation ≥ threshold + 1 cm AND |slope| ≤ 0.1 cm/point
```

**Unit note:** `calculateSlope()` in `smoothing.ts` returns slope in **cm/point** (change in cm divided by number of points), not cm/s. At 50 ms sampling, 1 point = 0.05 s, so the conversion is: `slope_cm_per_s = slope_cm_per_point × 20`. The current `SLOPE_THRESHOLD = 0.1` cm/point is equivalent to **2 cm/s** — meaning only very rapid motion (faster than a 1 cm change in 0.5 seconds) currently triggers APPROACHING or DRIFTING.

**Problem:** Most clinically relevant drifts fall below the 2 cm/s effective threshold:
- Patient A: achieves 3 cm, then drifts to 8 cm over 15 seconds (0.33 cm/s = 0.017 cm/point) → below threshold → `STABLE_DEVIATION`
- Patient B: holds 4 cm stably for 10 seconds (slope ≈ 0) → `STABLE_DEVIATION`
- Patient C: slowly drifts from 4 cm to 4.3 cm over 10 seconds (0.03 cm/s = 0.0015 cm/point) → `STABLE_DEVIATION`

All three are clinically distinct outcomes, but the system presents them identically.

### Why Slow Drifts Are Missed

The short timescale (10 points, ~0.5 s) with a 0.1 cm/point threshold only fires on very rapid changes (>2 cm/s). A sustained drift of 0.33 cm/s over 15 seconds is well below this and is invisible to the current system. A 0.03 cm/s slow drift is even more so.

### Impact on Users

Without fusion, users lose visibility into meaningful progress:
- Clinicians cannot distinguish "good stable session" from "slowly deteriorating session"
- Cross-session analysis cannot reveal trends (e.g., "stability is degrading over time")
- Session quality is reduced to binary: "achieved fusion or not"

---

## 2. Design: Dual-Timescale Slope Detection

### 2.1 Core Principle

Compute slopes at two independent timescales and **convert both to cm/s** before threshold comparison:
- **Short window (0.5 s):** detects rapid transitions
- **Long window (5.0 s):** reveals sustained trends

Window lengths are specified in **seconds** and converted to points at runtime using the actual sampling rate. This keeps their intent unchanged if the sampling rate ever changes.

Use **OR logic** in classification: a point enters `APPROACHING` or `DRIFTING` if *either* slope (in cm/s) exceeds its threshold.

**Unit convention throughout this spec:** all slope values, thresholds, and window sizes are expressed in **cm/s** and **seconds** respectively. The implementation converts `calculateSlope()` output (cm/point) to cm/s by multiplying by the actual sampling rate, and converts window seconds to points by multiplying by the same rate. See Appendix for derivation.

### 2.2 Long-Window Boundary Lag and Refinement

Because `calculateSlope()` uses a **centered** window, a long window of 5 s has `halfWindow = 2.5 s`. This means every boundary detected by the long window is displaced by up to ~2.5 s relative to the true changepoint — on both the **enter** and **exit** side:

- **Enter lag:** a slow drift starting at t=5s isn't classified as `DRIFTING` until the centered window has enough data on both sides — roughly t=7.5s.
- **Exit lag:** a drift ending at t=10s continues to produce a non-zero long-window slope until roughly t=12.5s.

The short window (0.5 s) has only ±0.25 s lag but cannot detect slow drifts directly (its threshold is 1.0 cm/s). However, during a slow drift (e.g. 0.3 cm/s), the short-window slope is **above** `LONG_SLOPE_THRESHOLD` (0.02 cm/s) throughout the drift and drops to near-zero immediately when the drift ends. This makes it useful for **refining** boundaries within a bounded search range.

**Boundary refinement algorithm** — applied as a post-processing pass after initial segmentation, for every boundary of a `DRIFTING` or `APPROACHING` segment:

```typescript
const halfLongWindowS = LONG_SLOPE_WINDOW_S / 2;  // 2.5 s

// ENTER refinement: find actual start of DRIFTING/APPROACHING segment
// Scan forward from (T_detected - halfLongWindow) using short-window slopes
// crossing criterion: shortSlopes[i] > LONG_SLOPE_THRESHOLD (same threshold, noisier window)
function refineEnter(T_detected: number, shortSlopes: number[], times: number[]): number {
  const searchStart = T_detected - halfLongWindowS;
  for (let i = 0; i < times.length; i++) {
    if (times[i] >= searchStart && Math.abs(shortSlopes[i]) > LONG_SLOPE_THRESHOLD) {
      return times[i];  // first crossing in the bracket → refined enter
    }
  }
  return T_detected;  // fallback: no refinement found
}

// EXIT refinement: find actual end of DRIFTING/APPROACHING segment
// Scan backward from T_detected using short-window slopes
// crossing criterion: find last point where shortSlopes[i] > LONG_SLOPE_THRESHOLD
function refineExit(T_detected: number, shortSlopes: number[], times: number[]): number {
  const searchStart = T_detected - halfLongWindowS;
  let lastAbove = T_detected;
  for (let i = times.length - 1; i >= 0; i--) {
    if (times[i] < searchStart) break;
    if (Math.abs(shortSlopes[i]) > LONG_SLOPE_THRESHOLD) {
      lastAbove = times[i];
      break;
    }
  }
  return lastAbove;  // last crossing in the bracket → refined exit
}
```

**Why `LONG_SLOPE_THRESHOLD` as the crossing criterion:**
- For fast drifts (shortSlope > SHORT_SLOPE_THRESHOLD = 1.0 cm/s): short window is already precise; refinement finds a crossing very close to the already-accurate boundary.
- For slow/moderate drifts (shortSlope in range 0.02–1.0 cm/s): short window was always below SHORT_SLOPE_THRESHOLD (never triggered), but reliably crosses LONG_SLOPE_THRESHOLD both during and after the drift. The crossing gives ±0.25 s precision.
- Using SHORT_SLOPE_THRESHOLD as the criterion would fail for slow drifts — no crossing exists.

**Precision achieved:** ±(SHORT_SLOPE_WINDOW_S / 2) = **±0.25 s**, matching `MIN_SEGMENT_DURATION`. No finer resolution is needed.

**CUSUM as Phase 2 alternative:** For very slow drifts (slope near 0.02 cm/s) the short-window slope is noisy around the LONG_SLOPE_THRESHOLD, and the scan may find a slightly imprecise crossing. Cumulative Sum (CUSUM) detection within the same bracket would give statistically cleaner results by accumulating deviations from the expected stable value. Deferred to Phase 2 if refinement precision proves insufficient on real data.

### 2.3 FSM Classification Logic

```typescript
// Window lengths in seconds — sampling-rate independent
const SHORT_SLOPE_WINDOW_S = 0.5;    // seconds
const LONG_SLOPE_WINDOW_S  = 5.0;    // seconds

// Thresholds in cm/s
const SHORT_SLOPE_THRESHOLD = 1.0;   // cm/s — detects rapid changes (≥1 cm/s)
const LONG_SLOPE_THRESHOLD  = 0.02;  // cm/s — detects slow, sustained changes (≥0.02 cm/s)
const NEAR_FUSION_WIDTH = 1;         // cm (existing, unchanged)

// Sampling rate: derived from time series data
// pointsPerSecond = 1000 / medianIntervalMs  (typically ~20 at 50ms sampling)
const shortWindowPoints = Math.round(SHORT_SLOPE_WINDOW_S * pointsPerSecond); // e.g. 10 at 50ms
const longWindowPoints  = Math.round(LONG_SLOPE_WINDOW_S  * pointsPerSecond); // e.g. 100 at 50ms

// Compute slopes at both timescales
const shortSlopesRaw = calculateSlope(smoothed, shortWindowPoints);
const longSlopesRaw  = calculateSlope(smoothed, longWindowPoints);

// Convert cm/point → cm/s using actual sampling rate
const shortSlopes = shortSlopesRaw.map(s => s * pointsPerSecond);
const longSlopes  = longSlopesRaw.map(s => s * pointsPerSecond);

const classifications: SessionState[] = valuesToClassify.map((value, i) => {
  const shortSlope = shortSlopes[i] ?? 0;
  const longSlope  = longSlopes[i] ?? 0;

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
```

**Sampling rate computation** (to be done once per call, before classification):
```typescript
// Compute median interval from time series, then derive points/second
const intervals = timeSeries.slice(1).map((p, i) => p.t - timeSeries[i].t);
const sortedIntervals = [...intervals].sort((a, b) => a - b);
const medianIntervalMs = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
const pointsPerSecond = medianIntervalMs > 0 ? 1000 / medianIntervalMs : 20;
```

### 2.4 Behavior Examples

All slopes in cm/s. "Short slope" and "long slope" represent the converted values at the peak of the movement.

| Scenario | Short Slope (cm/s) | Long Slope (cm/s) | Classification | Triggering condition |
|----------|--------------------|-------------------|-----------------|----------------------|
| Fast divergence (0→8 cm in 1 s) | +8.0 | +8.0 | `DRIFTING` | Short: 8.0 > 1.0 |
| Moderate drift (3→8 cm in 15 s) | +0.33 | +0.33 | `DRIFTING` | Long: 0.33 > 0.02 |
| Slow drift (4→4.3 cm in 10 s) | +0.03 | +0.03 | `DRIFTING` | Long: 0.03 > 0.02 |
| Rapid stabilization (8→2 cm in 2 s) | −3.0 | −3.0 | `APPROACHING` | Short: −3.0 < −1.0 |
| Gentle convergence (4→3.8 cm in 10 s) | −0.02 | −0.02 | `APPROACHING` | Long: −0.02 < −0.02 |
| Holds steady (4 cm ± 0.1 cm for 10 s) | ≈0 | ≈0 | `STABLE_DEVIATION` | Both below thresholds |

**Note on noise:** For the slow drift and gentle convergence cases, the short-window slope may be masked by signal noise (noise-to-slope ratio is high at 0.5 s windows). The long window (5 s) averages over more points, suppressing noise and reliably revealing the underlying trend. This is the primary benefit of the dual-timescale approach—not a different slope magnitude, but better noise rejection for small slopes.

---

## 3. Segment Quality Metrics

### 3.1 New Type: SegmentMetrics

Attach quality information to each state segment for analysis and comparison. `SegmentMetrics` contains only computed quality values; timing/state fields already present in `StateSegment` are not duplicated.

```typescript
export interface SegmentMetrics {
  // Univariate statistics (from raw data within segment)
  medianDeviation: number;        // Median value within segment
  minDeviation: number;           // Best (lowest) achieved within segment
  maxDeviation: number;           // Worst (highest) within segment
  meanDeviation: number;          // Arithmetic mean within segment
  varianceWithinSegment: number;  // Population variance; low = stable, high = volatile
  stdDevWithinSegment: number;    // Standard deviation

  // Intra-segment trend (in cm/s, same unit convention as FSM thresholds)
  intraSegmentSlope: number;      // Mean slope within segment; negative = improving, positive = declining
}

export interface StateSegment {
  state: SessionState;
  startTime: number;
  endTime: number;
  duration: number;
  metrics?: SegmentMetrics;    // Computed eagerly during classifyStates(); always present after classification
}
```

### 3.2 Metrics Computation Algorithm

After segments are finalized (post-stretching, post-merging in `classifyStates()`), compute metrics for each segment. The `smoothed` array and `pointsPerSecond` are already available in scope.

```typescript
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
  // Last index where time <= endTime (findLastIndex equivalent)
  let endIdx = startIdx;
  for (let i = startIdx; i < timeSeries.length; i++) {
    if ((timeSeries[i].t - t0) / 1000 <= segment.endTime) endIdx = i;
    else break;
  }

  const segmentPoints = timeSeries.slice(startIdx, endIdx + 1);
  const values = segmentPoints.map(p => getMetricValue(p, metric));

  if (values.length === 0) {
    // Should not happen after stretching; defensive fallback
    return {
      medianDeviation: 0, minDeviation: 0, maxDeviation: 0, meanDeviation: 0,
      varianceWithinSegment: 0, stdDevWithinSegment: 0, intraSegmentSlope: 0,
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
  // Use a window up to LONG_SLOPE_WINDOW, but capped at segment length (odd, ≥3)
  const segmentSmoothed = smoothed.slice(startIdx, endIdx + 1);
  let intraSegmentSlope = 0;
  if (segmentSmoothed.length >= 3) {
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
```

**Short-segment fallback:** When a segment is shorter than `LONG_SLOPE_WINDOW_S` (5 s), the window is capped to the segment length (minus 1 if even, to keep it odd). This gives the best available slope estimate for short segments without crashing.

**Integration into `classifyStates()`:**

```typescript
// FOURTH PASS: Merge consecutive segments with the same state
const segments: StateSegment[] = [];
for (const seg of stretchedSegments) {
  if (segments.length > 0 && segments[segments.length - 1].state === seg.state) {
    segments[segments.length - 1].endTime = seg.endTime;
    segments[segments.length - 1].duration = seg.endTime - segments[segments.length - 1].startTime;
  } else {
    segments.push(seg);
  }
}

// FIFTH PASS: Compute quality metrics for each segment
segments.forEach(seg => {
  seg.metrics = computeSegmentMetrics(timeSeries, seg, metric, smoothed, pointsPerSecond);
});

return segments;
```

---

## 4. Implementation Details

### 4.1 Files to Modify

| File | Changes | Reason |
|------|---------|--------|
| `src/utils/sessionMetrics.ts` | 1. Compute `pointsPerSecond` from time series<br>2. Add `SHORT_SLOPE_WINDOW_S`, `LONG_SLOPE_WINDOW_S`, `SHORT_SLOPE_THRESHOLD`, `LONG_SLOPE_THRESHOLD` constants<br>3. Convert window seconds → points; convert slope outputs to cm/s<br>4. Update classification logic with OR condition<br>5. Add `refineEnter()` and `refineExit()` functions; apply as post-processing pass after merging<br>6. Add `computeSegmentMetrics()` function<br>7. Call metrics computation in final pass | Core FSM and metrics enhancement |
| `src/types/analysis.ts` | 1. Add `SegmentMetrics` interface (quality values only, no timing duplication)<br>2. Add optional `metrics` field to `StateSegment` | Type definitions |
| `src/utils/__tests__/sessionMetrics.test.ts` | 1. Update existing slope-dependent tests (effective thresholds change)<br>2. Add tests for moderate and slow drift detection<br>3. Add tests for `computeSegmentMetrics()` correctness | Validate new behavior |

### 4.2 Files to Review (No Changes Expected)

- `src/components/TimeSeriesSegmentationGraph.tsx` — consumes `StateSegment[]`; optional `metrics` field available for future tooltip enhancement
- `src/components/HistogramChart.tsx` — unaffected; works with segments as-is
- `src/components/StatCards.tsx` — can be extended to display segment metrics (future work)
- `src/services/storage.ts` — no change; segments serialized as before

### 4.3 Constants and Parameters

**In `src/utils/sessionMetrics.ts`:**

```typescript
// Slope detection windows in seconds — sampling-rate independent
const SHORT_SLOPE_WINDOW_S = 0.5;    // seconds; converted to points at runtime
const LONG_SLOPE_WINDOW_S  = 5.0;    // seconds; converted to points at runtime

// Slope thresholds (cm/s) — compared against slopes already converted to cm/s
const SHORT_SLOPE_THRESHOLD = 1.0;   // Detects rapid changes ≥ 1 cm/s
const LONG_SLOPE_THRESHOLD  = 0.02;  // Detects slow, sustained changes ≥ 0.02 cm/s

// Existing constants (unchanged)
const NEAR_FUSION_WIDTH = 1;          // cm
const MIN_SEGMENT_DURATION = 0.25;    // seconds
const DEFAULT_SG_WINDOW = 11;         // smoothing window (separate from slope windows)
```

**Tuning Guidance:**

- `SHORT_SLOPE_WINDOW_S = 0.5 s`: A half-second window reacts quickly to sudden movements. At 50 ms sampling this is 10 points; at 25 ms sampling it becomes 20 points automatically.
- `LONG_SLOPE_WINDOW_S = 5.0 s`: Five seconds is long enough to average out noise and reveal a sustained clinical trend without being so coarse that it misses session-level structure.
- `SHORT_SLOPE_THRESHOLD = 1.0 cm/s`: 1 cm change in 1 second is clearly a rapid movement. The previous implicit value was 2 cm/s (far too insensitive); 1 cm/s is a better clinical cut-off for "sudden drift or approach".
- `LONG_SLOPE_THRESHOLD = 0.02 cm/s`: A sustained drift of 0.02 cm/s over 5 seconds equals 0.1 cm net change — clinically perceptible. If real-world data shows false positives, raise to 0.03–0.04; if very slow drifts are still missed, lower to 0.01.
- Both windows compute slopes on the already-smoothed signal, providing additional noise filtering.

---

## 5. Use Cases & Examples

### 5.1 Non-Fusion User Comparing Two Sessions

**Session A: "Deteriorating" Session**
- Patient achieves 3 cm deviation, then drifts to 8 cm over 15 seconds, then stabilizes at 8 cm
- Long slope during drift: +0.33 cm/s > 0.02 → `DRIFTING`
- Timeline: `[APPROACHING (0–3s)] → [DRIFTING (3–18s)] → [STABLE_DEVIATION (18–60s)]`
- Segment metrics:
  - `APPROACHING`: minDev=2.5, meanDev=2.8, variance=0.01, intraSegmentSlope≈−0.5 cm/s
  - `DRIFTING`: minDev=3, maxDev=8, meanDev=5.5, variance=4.2, intraSegmentSlope=+0.33 cm/s
  - `STABLE_DEVIATION`: medianDev=8, variance=0.05, intraSegmentSlope≈0

**Session B: "Stable" Session**
- Patient achieves 4 cm deviation, holds it stable for 15 seconds, then slight degradation to 4.3 cm over 10s
- Slow degradation: long slope = +0.03 cm/s > 0.02 → `DRIFTING` (not hidden as `STABLE_DEVIATION`)
- Timeline: `[STABLE_DEVIATION (0–15s)] → [DRIFTING (15–25s)] → [STABLE_DEVIATION (25–60s)]`
- Segment metrics:
  - First `STABLE_DEVIATION`: medianDev=4.0, minDev=3.95, variance=0.002, intraSegmentSlope≈0
  - `DRIFTING`: meanDev=4.15, variance=0.01, intraSegmentSlope=+0.03 cm/s
  - Second `STABLE_DEVIATION`: medianDev=4.3, variance=0.01, intraSegmentSlope≈0

**Analysis:**
- Visual timeline: Session A shows extended DRIFTING at high deviation; Session B shows mostly low-deviation STABLE_DEVIATION with a brief, low-magnitude drift
- Metrics: Session A's DRIFTING segment spans 8 cm; Session B's spans only 0.3 cm with low variance
- Clinician conclusion: Session B demonstrates far better control, even though Session A briefly reached a lower deviation

### 5.2 Detecting Slow Fatigue Arc

**Session C: Progressive Fatigue**
- Patient starts at 2.5 cm, gradually loses focus, drifts to 5.5 cm over 45 seconds
- Short-window slopes are noisy and stay below 0.1 cm/s; long-window slope ≈ +0.067 cm/s > 0.02 → `DRIFTING` detected
- Timeline: `[DRIFTING (0–45s)] → [STABLE_DEVIATION (45–60s)]`

**Without dual-timescale:** Session C would show only `STABLE_DEVIATION` for the entire session.
**With dual-timescale:** `DRIFTING` is detected for the first 45 seconds, correctly revealing the fatigue arc.

---

## 6. Data Flow & Integration

### 6.1 Enhanced Flow

```
Session.timeSeries
    ↓
classifyStates() [ENHANCED]
    ├─ Compute pointsPerSecond from median sample interval  ← NEW
    ├─ Smooth data (moving average)
    ├─ Compute shortSlopesRaw and longSlopesRaw  ← NEW
    ├─ Convert both to cm/s using pointsPerSecond  ← NEW
    ├─ Classify each point using OR logic  ← MODIFIED
    ├─ Create candidate segments
    ├─ Filter by MIN_SEGMENT_DURATION
    ├─ Stretch to fill gaps
    ├─ Merge consecutive same-state segments
    ├─ Refine DRIFTING/APPROACHING enter & exit boundaries  ← NEW
    │    (scan ±halfLongWindow using shortSlopes vs LONG_SLOPE_THRESHOLD)
    ├─ Compute SegmentMetrics for each segment  ← NEW
    └─ Return StateSegment[] (with metrics)
    ↓
computeSessionMetrics()  [UNCHANGED]
    └─ Return SessionMetrics (with enhanced stateSegments)
    ↓
Visualizations consume metrics optionally
    ├─ TimeSeriesSegmentationGraph: tooltip on segment hover (future)
    ├─ StatCards: "best stable deviation", "stability score" (future)
    └─ HistoryPage: sort/filter by segment metrics (future)
```

---

## 7. Backward Compatibility

**No breaking changes.**

- `StateSegment.metrics` is optional (`metrics?: SegmentMetrics`)
- Existing consumers (visualizations, export) continue to work
- `StateSegment.state` values remain unchanged (5 states: FUSION, NEAR_FUSION, APPROACHING, DRIFTING, STABLE_DEVIATION)
- Session classification will change for existing stored sessions when viewed (because state boundaries shift with the corrected thresholds), but stored raw `timeSeries` data is untouched

**Notable behavior change:** Existing sessions will now show more `APPROACHING` and `DRIFTING` segments than before. Previously, only very rapid movement (>2 cm/s) triggered these states; after the change, moderate and slow drifts will also be classified correctly. This is intended and desired — the previous behavior was under-sensitive.

---

## 8. Testing Strategy

### 8.1 Unit Tests (src/utils/__tests__/sessionMetrics.test.ts)

1. **Dual-slope classification (all scenarios in Section 2.3):**
   - Fast DRIFTING: short slope > SHORT_SLOPE_THRESHOLD (rapid divergence in 1–2 s)
   - Moderate DRIFTING: long slope > LONG_SLOPE_THRESHOLD, short slope may or may not exceed SHORT_SLOPE_THRESHOLD (smooth linear drift over 15 s)
   - Slow DRIFTING: noisy signal where short-window slope is masked by noise but long-window slope > LONG_SLOPE_THRESHOLD
   - Fast APPROACHING: short slope < −SHORT_SLOPE_THRESHOLD
   - Slow APPROACHING: long slope < −LONG_SLOPE_THRESHOLD
   - STABLE_DEVIATION: both slopes near zero (constant or oscillating signal)

2. **Segment metrics:**
   - Metrics computed correctly for a known constant segment (variance = 0, slope = 0)
   - Metrics computed correctly for a known linear segment (slope matches input, min/max correct)
   - Edge case: single-point segment (fallback returns zeros gracefully)
   - Short segment (< LONG_SLOPE_WINDOW points): window capped to segment length, no crash

3. **Unit conversion:**
   - Verify `pointsPerSecond` is computed correctly from a regular time series
   - Verify slopes in cm/s match expected values for known input series

4. **Integration:**
   - `classifyStates()` returns segments with `metrics` attached (not undefined)
   - Segment `metrics.intraSegmentSlope` has correct sign for a drifting segment

### 8.2 Manual Testing (Browser)

1. **Record a non-fusion session:** achieve ~3–4 cm, drift to 8 cm over 30 seconds, stabilize
   - Verify timeline shows `DRIFTING` segment for the drift phase
   - Hover segment → confirm metrics display expected median and positive slope

2. **Record a stable session:** hold ~4 cm for 30 seconds with <0.1 cm variation
   - Verify timeline shows `STABLE_DEVIATION`
   - Metrics show low variance, near-zero slope

3. **Slow fatigue arc:** start near 2 cm, gradually drift to 5 cm over 60 seconds
   - Verify `DRIFTING` detected despite low short-window slope

### 8.3 Regression Testing

- Existing sessions with fusion may show revised segment boundaries (more APPROACHING detected before fusion events) — verify fusion event count and longestFusionStreak are unaffected or improved
- HistogramChart and TimeSeriesGraph render unchanged (no new props required)
- CSV export continues to work

---

## 9. Performance Considerations

### 9.1 Computational Cost

- **New operations per `classifyStates()` call:**
  - Median interval computation: O(N log N) for sort, but N ≤ 6000 — negligible
  - Additional `calculateSlope()` call: O(N)
  - `computeSegmentMetrics()`: O(N) across all segments combined
  - **Total overhead:** < 5% added CPU for a 5-minute session

- **Memory:**
  - `longSlopesRaw` array: same size as `shortSlopesRaw` (N floats)
  - `SegmentMetrics` per segment: ~7 numeric fields × typically 3–20 segments = minimal

### 9.2 Memoization Opportunities (Future)

- If `classifyStates()` is called repeatedly with the same data (e.g., threshold changes), cache the smoothed array and slopes
- Metrics computation can be deferred if only FSM segments are needed (pass a `computeMetrics: boolean` flag)

---

## 10. Future Extensions

**Phase 2:**
- Add bimodality detection to STABLE_DEVIATION segments (patient oscillating between two stable levels), using the Bimodality Coefficient (Sarle's BC) via `simple-statistics` (see `docs/stats_ideas.md` R6)
- Implement a session quality score for non-fusion sessions: weighted combination of best-maintained deviation, stability variance, and intraSegmentSlope trend
- Add "time-to-stable" metric: how long before patient first held deviation stably for >2 seconds

**Phase 3:**
- Implement changepoint detection (PELT or BOCPD) to formally identify "settling time" and "fatigue onset" timestamps
- Add session-to-session comparisons using Dynamic Time Warping (DTW) for trajectory similarity

---

## 11. Open Questions & Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Should metrics be computed eagerly or on-demand? | Eagerly, during `classifyStates()` | Simplifies API; metrics always available; overhead is negligible |
| Should segment metrics be persisted to IndexedDB? | No; recompute on load | Derived data; recomputing is cheap; avoids stale metrics if thresholds change in future |
| What if long window exceeds session length (session < 5 s)? | `calculateSlope()` uses available data; minimum session is 10 s (enforced by `computeSessionMetrics()`), so this cannot happen in practice | Minimum session length guard prevents edge case |
| What if a segment is shorter than `LONG_SLOPE_WINDOW_S` (5 s)? | Cap window to segment length (odd, ≥3 points) | Handled in `computeSegmentMetrics()` via `Math.min(longWindowPoints, ...)` |
| Should `LONG_SLOPE_THRESHOLD` be tunable per user? | No, use global default for now | Consistent clinical interpretation; per-user tuning deferred to Phase 2 |
| How should metrics be displayed in UI? | Start with tooltips in TimeSeriesSegmentationGraph; add StatCards in Phase 2 | Minimal UI change for MVP; evaluate feedback before adding cards |
| Should refinement be applied to all segment boundaries or only those triggered by long slope? | Apply uniformly to all DRIFTING/APPROACHING boundaries | For fast transitions (short slope triggered), refinement finds a crossing within ±0.25s of the existing boundary — essentially a no-op. Uniform application avoids needing to track which slope triggered each boundary. |
| What if refinement scan finds no crossing in the bracket? | Fall back to original detected boundary | Can happen if the signal is very noisy at the LONG_SLOPE_THRESHOLD level. Fallback preserves the ~2.5s-lagged boundary rather than crashing. |

---

## 12. Rollout Plan

1. **Code Implementation:** Modify `sessionMetrics.ts`, add `computeSegmentMetrics()`, update `analysis.ts` types, write tests
2. **Testing:** Unit tests pass; manual browser testing with recorded sessions of each type
3. **Documentation:** Update `docs/development.md` (FSM note, new constants) and `docs/architecture.md` (enhanced flow)
4. **Deployment:** No breaking changes to storage or visualizations; safe to deploy once tests pass
5. **Monitoring:** Console logs from `classifyStates()` already emit segment breakdown; verify DRIFTING/APPROACHING are now appearing for moderate-speed movements

---

## 13. References

- **Current FSM implementation:** `src/utils/sessionMetrics.ts`, `classifyStates()` function
- **State definitions:** `src/types/analysis.ts`, `SessionState` type
- **Slope calculation:** `src/utils/smoothing.ts`, `calculateSlope()` function
- **Research foundation:** `docs/stats_ideas.md`, Sections R2 (state classification), R3 (changepoint detection), R5 (quality scoring)

---

## Appendix: Mathematical Definitions

### Slope Calculation and Unit Conversion

`calculateSlope(data, windowSize)` in `smoothing.ts` computes:

```
slope[i] = (data[end] - data[start]) / (end - start)
```

where `end = min(N-1, i + halfWindow)` and `start = max(0, i - halfWindow)`.

The output is in **cm/point**. To convert to cm/s:

```
slope_cm_per_s = slope_cm_per_point × pointsPerSecond
```

where `pointsPerSecond = 1000 / medianSamplingIntervalMs` (typically ~20 at 50 ms sampling).

**Example:** At 50 ms sampling, a slope of 0.0015 cm/point = 0.0015 × 20 = **0.03 cm/s**.

### Threshold Derivation

| Threshold | Value (cm/s) | In cm/point at 50ms | Clinical meaning |
|-----------|-------------|---------------------|-----------------|
| `SHORT_SLOPE_THRESHOLD` | 1.0 | 0.05 | Movement faster than 1 cm/s over the 0.5 s window — clearly a rapid divergence or convergence |
| `LONG_SLOPE_THRESHOLD` | 0.02 | 0.001 | A sustained drift of 0.1 cm over 5 seconds — perceptible clinical loss of control |

**Previous effective threshold (for reference):** The old `SLOPE_THRESHOLD = 0.1` was implicitly 0.1 cm/point = 2 cm/s, which was too insensitive for most clinical drifts. `SHORT_SLOPE_THRESHOLD = 1.0 cm/s` halves this, catching meaningful rapid motion while remaining robust to noise.

---

**End of Specification Document**

Version: 1.1 (corrected unit handling, redundant fields, index computation, window descriptions)
Ready for implementation planning.
