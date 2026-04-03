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
1. Compute slopes at two timescales (1 second and 5 seconds)
2. Use OR logic for state classification: enter `APPROACHING` or `DRIFTING` if *either* timescale shows movement
3. Attach segment-level metrics (median, variance, intra-segment slope) for fine-grained analysis
4. FSM remains at 5 states—no explosion, semantic meaning preserved

---

## 1. Problem Statement

### Current System Behavior

The existing FSM classifies each data point into one of five states based on deviation value and short-term slope (1-second window):

```
FUSION:           deviation < threshold
NEAR_FUSION:      threshold ≤ deviation < threshold + 1 cm
APPROACHING:      deviation ≥ threshold + 1 cm AND slope < -0.1 cm/s (descending quickly)
DRIFTING:         deviation ≥ threshold + 1 cm AND slope > +0.1 cm/s (ascending quickly)
STABLE_DEVIATION: deviation ≥ threshold + 1 cm AND |slope| ≤ 0.1 cm/s
```

**Problem:** For users without fusion capacity, all sessions fall into `STABLE_DEVIATION`, regardless of quality:
- Patient A: achieves 3 cm, then drifts to 8 cm over 15 seconds → single `STABLE_DEVIATION` segment (or fast alternation)
- Patient B: holds 4 cm stably for 10 seconds → single `STABLE_DEVIATION` segment
- Patient C: slowly drifts from 4 cm to 4.3 cm over 10 seconds → single `STABLE_DEVIATION` segment

These are clinically distinct outcomes, but the system presents them identically.

### Why Slow Drifts Are Missed

The short timescale (1 second, ~20 points at 50 ms sampling) is optimized to detect rapid changes:
- A 0.33 cm/s drift (3 cm → 8 cm in 15 s) is caught as `DRIFTING`
- A 0.03 cm/s drift (4 cm → 4.3 cm in 10 s) is below the 0.1 cm/s threshold and classified as `STABLE_DEVIATION`

Yet both represent loss of control—one sudden, one gradual—and both matter clinically.

### Impact on Users

Without fusion, users lose visibility into meaningful progress:
- Clinicians cannot distinguish "good stable session" from "slowly deteriorating session"
- Cross-session analysis cannot reveal trends (e.g., "stability is degrading over time")
- Session quality is reduced to binary: "achieved fusion or not"

---

## 2. Design: Dual-Timescale Slope Detection

### 2.1 Core Principle

Compute slopes at two independent timescales:
- **Short window (1 s, ~20 points):** detects rapid transitions (existing behavior)
- **Long window (5 s, ~100 points):** reveals sustained trends

Use **OR logic** in classification: a point enters `APPROACHING` or `DRIFTING` if *either* slope exceeds its threshold.

### 2.2 FSM Classification Logic

```typescript
const SHORT_SLOPE_WINDOW = 10;    // points; ~1s at 50ms sampling
const LONG_SLOPE_WINDOW = 100;    // points; ~5s at 50ms sampling
const SHORT_SLOPE_THRESHOLD = 0.1;  // cm/s
const LONG_SLOPE_THRESHOLD = 0.02;  // cm/s
const NEAR_FUSION_WIDTH = 1;      // cm (existing)

// Compute slopes at both timescales
const shortSlopes = calculateSlope(smoothed, SHORT_SLOPE_WINDOW);
const longSlopes = calculateSlope(smoothed, LONG_SLOPE_WINDOW);

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
```

### 2.3 Behavior Examples

| Scenario | Short Slope | Long Slope | Classification | Rationale |
|----------|------------|-----------|-----------------|-----------|
| Fast divergence (0→8 cm in 1 s) | +8 cm/s | +8 cm/s | `DRIFTING` | Both thresholds exceeded |
| Slow divergence (4→4.3 cm in 10 s) | +0.03 cm/s | +0.03 cm/s | `DRIFTING` | Long slope exceeds 0.02 threshold |
| Rapid stabilization (8→2 cm in 2 s) | -3 cm/s | -3 cm/s | `APPROACHING` | Both thresholds exceeded |
| Gentle convergence (4→3.8 cm in 10 s) | -0.02 cm/s | -0.02 cm/s | `APPROACHING` | Long slope below -0.02 threshold |
| Holds steady (4 cm ± 0.1 cm for 10 s) | ≈0 | ≈0 | `STABLE_DEVIATION` | Both slopes near zero |

---

## 3. Segment Quality Metrics

### 3.1 New Type: SegmentMetrics

Attach rich quality information to each state segment for analysis and comparison.

```typescript
export interface SegmentMetrics {
  // Identification
  state: SessionState;
  startTime: number;              // seconds from session start
  endTime: number;                // seconds from session start
  duration: number;               // endTime - startTime

  // Univariate statistics (from raw data within segment)
  medianDeviation: number;        // Median value within segment
  minDeviation: number;           // Best (lowest) achieved within segment
  maxDeviation: number;           // Worst (highest) within segment
  meanDeviation: number;          // Arithmetic mean within segment
  varianceWithinSegment: number;  // Sample variance; low = stable, high = volatile
  stdDevWithinSegment: number;    // Standard deviation

  // Trend within segment
  intraSegmentSlope: number;      // cm/s; computed from smoothed long window
                                  // Negative = improving, Positive = declining
}

export interface StateSegment {
  state: SessionState;
  startTime: number;
  endTime: number;
  duration: number;
  metrics?: SegmentMetrics;       // Optional; computed on demand or during classification
}
```

### 3.2 Metrics Computation Algorithm

After segments are finalized (post-stretching, post-merging in `classifyStates()`), compute metrics for each segment:

```typescript
function computeSegmentMetrics(
  timeSeries: TimeSeries[],
  segment: StateSegment,
  metric: 'deviation' | 'rotation',
  smoothed: number[]
): SegmentMetrics {
  // Extract data points within this segment's time range
  const segmentPoints = timeSeries.filter(p => {
    const time = (p.t - timeSeries[0].t) / 1000;
    return time >= segment.startTime && time <= segment.endTime;
  });

  // Extract metric values (deviation or rotation)
  const values = segmentPoints.map(p => getMetricValue(p, metric));

  if (values.length === 0) {
    // Edge case: segment has no points (should not happen after stretching)
    return {
      state: segment.state,
      startTime: segment.startTime,
      endTime: segment.endTime,
      duration: segment.duration,
      medianDeviation: 0,
      minDeviation: 0,
      maxDeviation: 0,
      meanDeviation: 0,
      varianceWithinSegment: 0,
      stdDevWithinSegment: 0,
      intraSegmentSlope: 0,
    };
  }

  // Compute statistics
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  // Variance and standard deviation
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Intra-segment slope (using smoothed data within segment)
  const segmentStartIdx = timeSeries.findIndex(p =>
    (p.t - timeSeries[0].t) / 1000 >= segment.startTime
  );
  const segmentEndIdx = timeSeries.findIndex(p =>
    (p.t - timeSeries[0].t) / 1000 >= segment.endTime
  );

  const segmentSmoothed = smoothed.slice(segmentStartIdx, segmentEndIdx + 1);

  // Compute slope over the segment using long window
  const segmentSlopes = segmentSmoothed.length >= 5
    ? calculateSlope(segmentSmoothed, Math.min(11, segmentSmoothed.length % 2 === 0 ? segmentSmoothed.length - 1 : segmentSmoothed.length))
    : Array(segmentSmoothed.length).fill(0);

  const meanSlope = segmentSlopes.length > 0
    ? segmentSlopes.reduce((a, b) => a + b, 0) / segmentSlopes.length
    : 0;

  return {
    state: segment.state,
    startTime: segment.startTime,
    endTime: segment.endTime,
    duration: segment.duration,
    medianDeviation: median,
    minDeviation: min,
    maxDeviation: max,
    meanDeviation: mean,
    varianceWithinSegment: variance,
    stdDevWithinSegment: stdDev,
    intraSegmentSlope: meanSlope,
  };
}
```

**Integration into `classifyStates()`:**

After the fourth pass (merging consecutive same-state segments), compute metrics:

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
  seg.metrics = computeSegmentMetrics(timeSeries, seg, metric, smoothed);
});

return segments;
```

---

## 4. Implementation Details

### 4.1 Files to Modify

| File | Changes | Reason |
|------|---------|--------|
| `src/utils/sessionMetrics.ts` | 1. Add `LONG_SLOPE_WINDOW` and `LONG_SLOPE_THRESHOLD` constants<br>2. Compute `longSlopes` in `classifyStates()`<br>3. Update classification logic with OR condition<br>4. Add `computeSegmentMetrics()` function<br>5. Call metrics computation in final pass | Core FSM and metrics enhancement |
| `src/types/analysis.ts` | 1. Add `SegmentMetrics` interface<br>2. Update `StateSegment.metrics` to optional field | Type definitions |
| `src/utils/__tests__/sessionMetrics.test.ts` | 1. Update existing tests (slopes may differ)<br>2. Add tests for slow drift detection<br>3. Add tests for metrics computation | Validate new behavior |

### 4.2 Files to Review (No Changes)

- `src/components/TimeSeriesSegmentationGraph.tsx` — consumes `StateSegment[]; optional `metrics` field available for tooltips
- `src/components/HistogramChart.tsx` — unaffected; works with segments as-is
- `src/components/StatCards.tsx` — can be extended to display segment metrics (future work)
- `src/services/storage.ts` — no change; segments serialized as before

### 4.3 Constants and Parameters

**In `src/utils/sessionMetrics.ts`:**

```typescript
// Slope detection windows (points; sampled at ~50 ms)
const SHORT_SLOPE_WINDOW = 10;      // ~1 second
const LONG_SLOPE_WINDOW = 100;      // ~5 seconds

// Slope thresholds (cm/s)
const SHORT_SLOPE_THRESHOLD = 0.1;  // Detects rapid changes
const LONG_SLOPE_THRESHOLD = 0.02;  // Detects slow, sustained changes

// Existing constants (unchanged)
const NEAR_FUSION_WIDTH = 1;        // cm
const MIN_SEGMENT_DURATION = 0.25;  // seconds
const DEFAULT_SG_WINDOW = 11;       // Savitzky-Golay window for smoothing
```

**Tuning Guidance:**

- `SHORT_SLOPE_THRESHOLD = 0.1 cm/s`: Tuned to existing behavior; preserves rapid change detection
- `LONG_SLOPE_THRESHOLD = 0.02 cm/s`: Set to 1/5 of short threshold. Rationale: a sustained 0.02 cm/s drift over 5 seconds (net 0.1 cm change) is clinically meaningful but not noise. If real-world data shows false positives, raise to 0.03–0.04; if slow drifts are missed, lower to 0.01.
- Both windows use `calculateSlope()` with the same smoothing pipeline, ensuring consistency.

---

## 5. Use Cases & Examples

### 5.1 Non-Fusion User Comparing Two Sessions

**Session A: "Bad" Session**
- Patient achieves 3 cm deviation, then drifts to 8 cm over 15 seconds, then stabilizes at 8 cm
- Timeline: `[APPROACHING (0-3s)] → [DRIFTING (3-18s)] → [STABLE_DEVIATION (18-60s)]`
- Segment metrics:
  - `APPROACHING`: minDev=2.5cm, meanDev=2.8cm, varianceDev=0.01
  - `DRIFTING`: minDev=3cm, maxDev=8cm, meanDev=5.5cm, variance=4.2, intraSegmentSlope=+0.33
  - `STABLE_DEVIATION`: medianDev=8cm, variance=0.05, intraSegmentSlope≈0

**Session B: "Good" Session**
- Patient achieves 4 cm deviation, holds it stable for 15 seconds, slight degradation to 4.3 cm over 10s
- Timeline: `[STABLE_DEVIATION (0-15s)] → [DRIFTING (15-25s)] → [STABLE_DEVIATION (25-60s)]`
- Segment metrics:
  - First `STABLE_DEVIATION`: medianDev=4cm, minDev=3.95cm, variance=0.002, intraSegmentSlope≈0
  - `DRIFTING`: meanDev=4.15cm, variance=0.01, intraSegmentSlope=+0.03
  - Second `STABLE_DEVIATION`: medianDev=4.3cm, variance=0.01, intraSegmentSlope≈0

**Analysis:**
- Visual timeline immediately distinguishes: Session A has extended DRIFTING and high-deviation STABLE_DEVIATION; Session B has mostly stable low deviation with brief drift
- Metrics reveal: Session A worst-case is 8 cm with high variance; Session B worst-case is 4.3 cm with low variance
- Clinician conclusion: Session B demonstrates better control despite slightly higher final deviation

### 5.2 Detecting Slow Fatigue Arc

**Session C: Progressive Fatigue**
- Patient starts at 2.5 cm, gradually loses focus, drifts to 5.5 cm over 45 seconds (rest is stable)
- Timeline: `[DRIFTING (0-45s)] → [STABLE_DEVIATION (45-60s)]`
- Segment metrics:
  - `DRIFTING`: shortSlope varies (0 to +0.2), but longSlope ≈ +0.067 cm/s (exceeds 0.02 threshold)
  - `STABLE_DEVIATION`: medianDev=5.5cm, intraSegmentSlope≈0

**Without dual-timescale:** Session C might show only `STABLE_DEVIATION` if short-window slopes are near-threshold.
**With dual-timescale:** `DRIFTING` is detected because `longSlope = +0.067 cm/s > 0.02 cm/s`, revealing the fatigue arc.

---

## 6. Data Flow & Integration

### 6.1 Existing Flow (Unchanged)

```
Session.timeSeries
    ↓
classifyStates()
    ├─ Smooth data
    ├─ Classify each point
    ├─ Create candidate segments
    ├─ Filter by MIN_SEGMENT_DURATION
    ├─ Stretch to fill gaps
    ├─ Merge consecutive same-state segments
    └─ Return StateSegment[]
    ↓
computeSessionMetrics()  [existing function]
    └─ Return SessionMetrics (with stateSegments field)
```

### 6.2 Enhanced Flow

```
Session.timeSeries
    ↓
classifyStates() [ENHANCED]
    ├─ Smooth data (Savitzky-Golay)
    ├─ Compute slopes at SHORT and LONG windows  ← NEW
    ├─ Classify each point using OR logic  ← MODIFIED
    ├─ Create candidate segments
    ├─ Filter by MIN_SEGMENT_DURATION
    ├─ Stretch to fill gaps
    ├─ Merge consecutive same-state segments
    ├─ Compute SegmentMetrics for each segment  ← NEW
    └─ Return StateSegment[] (with metrics)
    ↓
computeSessionMetrics()  [UNCHANGED]
    └─ Return SessionMetrics (with enhanced stateSegments)
    ↓
Visualizations consume metrics optionally
    ├─ TimeSeriesSegmentationGraph: tooltip on segment hover
    ├─ StatCards: "best stable deviation", "stability variance"
    └─ HistoryPage: sort/filter by segment metrics
```

---

## 7. Backward Compatibility

**No breaking changes.**

- `StateSegment.metrics` is optional (`metrics?: SegmentMetrics`)
- Existing consumers (visualizations, export) continue to work
- `StateSegment.state` values remain unchanged (still 5 states: FUSION, NEAR_FUSION, APPROACHING, DRIFTING, STABLE_DEVIATION)
- Metrics computation is a pure addition; can be skipped if performance requires

**Verification:**
- All existing tests should pass after updating slope expectations
- Visualizations render as before if metrics are not used
- Storage layer is unaffected (segments serialize as JSON)

---

## 8. Testing Strategy

### 8.1 Unit Tests (src/utils/__tests__/sessionMetrics.test.ts)

1. **Dual-slope classification:**
   - Fast DRIFTING: high shortSlope
   - Slow DRIFTING: high longSlope, low shortSlope
   - Fast APPROACHING: low shortSlope
   - Slow APPROACHING: low longSlope, high shortSlope
   - STABLE_DEVIATION: both slopes near zero

2. **Segment metrics:**
   - Metrics computed correctly (median, variance, slope)
   - Edge cases (single-point segments, all-constant segments)
   - Empty segments (should not occur after stretching, but handle gracefully)

3. **Integration:**
   - `classifyStates()` returns segments with metrics attached
   - Metrics are consistent with segment's state and duration

### 8.2 Manual Testing (Browser)

1. **Record a non-fusion session:** achieve ~3–4 cm, drift to 8 cm over 30 seconds, stabilize
   - Verify timeline shows `DRIFTING` segment (not STABLE_DEVIATION)
   - Hover segment → check metrics display median and slope

2. **Record a stable session:** hold ~4 cm for 30 seconds with <0.1 cm variance
   - Verify timeline shows `STABLE_DEVIATION`
   - Metrics show low variance, near-zero slope

3. **Slow fatigue arc:** start 2 cm, gradually drift to 5 cm over 60 seconds
   - Verify `DRIFTING` detected despite low short-window slope
   - Metrics show positive intraSegmentSlope

### 8.3 Regression Testing

- Existing test sessions (with fusion) should produce same segment counts and states (within tolerance of updated slope expectations)
- HistogramChart and TimeSeriesGraph visualizations render unchanged
- CSV export works as before

---

## 9. Performance Considerations

### 9.1 Computational Cost

- **New operations:**
  - Additional `calculateSlope()` call: O(N) where N = session length (~200–6000 points)
  - `computeSegmentMetrics()`: O(N) over all segments (should be 3–20 segments); O(N) per segment for variance calculation
  - **Total overhead:** < 5% CPU for a 5-minute session; negligible for browser performance

- **Memory:**
  - `longSlopes` array: same size as `shortSlopes` (N floats); ~1–50 KB depending on session length
  - `SegmentMetrics` per segment: ~15 fields × ~50 segments = minimal

### 9.2 Memoization Opportunities (Future)

- If `calculateSlope()` is called repeatedly on the same data, memoize results
- Defer metrics computation to "on demand" (e.g., compute only when segment is hovered, not at load time)

---

## 10. Future Extensions

**Phase 2:**
- Add bimodality detection to STABLE_DEVIATION segments (patient oscillating between two stable levels)
- Implement session quality score: weighted combination of best-maintained-deviation, stability, and recovery
- Add "time-to-stable" metric: how long before patient first held deviation < threshold_stable for >2 seconds

**Phase 3:**
- Implement changepoint detection (PELT or BOCPD) to identify "settling time" and "fatigue onset"
- Add session-to-session comparisons using Dynamic Time Warping (DTW) for trajectory similarity

---

## 11. Open Questions & Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Should metrics be computed during `classifyStates()` or on-demand? | During classification (eager) | Simplifies API; metrics always available; performance overhead negligible for typical session sizes |
| Should segment metrics be persisted to IndexedDB? | No; recompute on load | Metrics are derived from segment boundaries; recomputing is cheap and ensures consistency if thresholds change |
| What if long window exceeds session length? | Fall back to short window | Handle gracefully; if session < 5s, `longSlopes` will be computed over available data |
| Should `LONG_SLOPE_THRESHOLD` be tunable per user? | No, use global default for now | Global threshold ensures consistent clinical interpretation; user/exercise-specific tuning can be Phase 2 |
| How should metrics be displayed in UI? | Start with tooltips; add StatCard later | Minimal UI changes for MVP; evaluate user feedback before adding new cards |

---

## 12. Rollout Plan

1. **Code Implementation:** Modify `sessionMetrics.ts`, add tests, update types
2. **Testing:** Unit tests pass; manual browser testing with sample sessions
3. **Documentation:** Update `docs/architecture.md` and `docs/development.md` with new FSM and metrics
4. **Deployment:** No breaking changes; safe to deploy once tests pass
5. **Monitoring:** Log sample sessions to console; verify metrics match visual timeline
6. **Future UI:** Add optional metric displays based on user feedback

---

## 13. References

- **Current FSM implementation:** `src/utils/sessionMetrics.ts`, `classifyStates()` function
- **State definitions:** `src/types/analysis.ts`, `SessionState` type
- **Slope calculation:** `src/utils/smoothing.ts`, `calculateSlope()` function
- **Research foundation:** `docs/stats_ideas.md`, Sections 1–2 (event-based metrics, state classification)

---

## Appendix: Mathematical Definitions

### Slope Calculation

Both `shortSlopes` and `longSlopes` are computed using:

```typescript
export function calculateSlope(smoothed: number[], windowSize: number): number[] {
  const slopes = new Array(smoothed.length).fill(0);
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < smoothed.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(smoothed.length - 1, i + halfWindow);

    if (start === end) {
      slopes[i] = 0;
    } else {
      // Linear regression slope: Δy / Δx
      const dy = smoothed[end] - smoothed[start];
      const dx = end - start;
      slopes[i] = dy / dx;  // in units of data-points^-1; converted to cm/s in classification
    }
  }

  return slopes;
}
```

**Unit conversion:** `slopes[i]` is in cm/point. To convert to cm/s at 50 ms sampling:
- 1 point = 50 ms = 0.05 s
- slope_cm_per_s = slope_cm_per_point / 0.05 = slope_cm_per_point × 20
- Thresholds are set in cm/s; internal slope calculation must be converted or thresholds scaled

**Refinement needed:** Ensure `calculateSlope()` output is in consistent units (cm/s) before comparison with thresholds.

---

**End of Specification Document**

Version: 1.0
Ready for implementation planning.
