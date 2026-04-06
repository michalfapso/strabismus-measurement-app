# Non-Fusion User Metrics & Multi-Session Progress Visualization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable meaningful session comparison and progress tracking for users who never achieve fusion, using segment-derived metrics and a unified stacked multi-graph visualization.

**Architecture:** Extend the metrics system to compute per-session aggregates from segment data, unify all users (fusion and non-fusion) under a single metric set, and display temporal progress across multiple aligned graphs with shared hover state.

**Tech Stack:** TypeScript, React, recharts (existing), IndexedDB

---

## Problem Statement

Current system:
- Non-fusion users (all sessions STABLE_DEVIATION/DRIFTING) have `longestFusionStreak = 0`, `fusionEventCount = 0` always.
- Insight functions rely on `minValue` (a single raw measurement point) as the fallback trend metric, which is noisy and unstable.
- No way to distinguish between a non-fusion user at 3 cm (good) and one at 7 cm (poor) across sessions.
- Segment data now includes per-segment `meanDeviation`, `stdDev`, `intraSegmentSlope` but is never consumed by insights.

**Solution**: Compute session-level aggregates from segment statistics, create a unified metric framework that works for all users, and visualize multi-session trends with segment-aware metrics.

---

## Metric Definitions

### Core Metrics (Computed per Session)

**Quality segment identification:**
1. `bestStableDeviation` = min `meanDeviation` across all {FUSION, NEAR_FUSION, STABLE_DEVIATION} segments
2. `nearBestThreshold` = `bestStableDeviation + 0.1 × (sessionMaxDeviation - bestStableDeviation)`
3. **Quality segments** = {FUSION, NEAR_FUSION, STABLE_DEVIATION segments with `meanDeviation ≤ nearBestThreshold`}
4. `nearBestStableTime` = sum of durations of quality segments (seconds)

**Session composition:**
5. `qualityPercent` = total quality segment duration / session duration × 100
6. `driftingPercent` = total DRIFTING duration / session duration × 100
7. `approachingPercent` = total APPROACHING duration / session duration × 100

### Rationale

- `bestStableDeviation` anchors the quality band to the patient's own best performance in that session.
- For fusion users, this is 0–1 cm (FUSION mean). For non-fusion users, it's their lowest stable level (e.g., 3 cm).
- `nearBestThreshold` creates a session-relative band ±10% of the deviation range, capturing meaningful sustained periods.
- `nearBestStableTime` is meaningful for all users: fusion users track how long they sustain fusion/near-fusion, non-fusion users track how long they sustain their best stable level.
- Percentages are session-length independent, allowing comparison across sessions of different durations.
- Metrics work for all users without special-casing.

### Backward Compatibility

- Delete `minValue` from `SessionMetrics`. It is superseded by `bestStableDeviation` (more robust, segment-based).
- Codebase is experimental; no legacy migrations needed.

---

## Type Changes

### `src/types/analysis.ts`

**Remove from `SessionMetrics`:**
- `minValue: number`

**Add to `SessionMetrics`:**
```typescript
export interface SessionMetrics {
  // ... existing fields (including longestFusionStreak, fusionEventCount,
  //     fusionTimePercent, fusionAchieved — all unchanged, always computed) ...

  // Segment-derived metrics (new, always computed for all users)
  bestStableDeviation: number;      // min meanDeviation across quality segments
  nearBestStableTime: number;       // total duration of quality segments (seconds)
  qualityPercent: number;           // % of session in quality segments
  driftingPercent: number;          // % of session in DRIFTING
  approachingPercent: number;       // % of session in APPROACHING
}
```

Note: `longestFusionStreak`, `fusionEventCount`, `fusionTimePercent`, `fusionAchieved` remain in `SessionMetrics` and are always computed per-session. The 30% threshold applies only to whether `analysisInsights.ts` includes fusion trends in the returned `ProgressInsight` — not to whether the fields exist in `SessionMetrics`.

---

## Computation Logic

### `src/utils/sessionMetrics.ts`

After `classifyStates()` produces `stateSegments: StateSegment[]` (with `metrics: SegmentMetrics` on each), add a function to compute session-level aggregates:

```typescript
function computeSessionAggregateMetrics(
  stateSegments: StateSegment[],
  timeSeries: TimeSeries[]
): {
  bestStableDeviation: number;
  nearBestStableTime: number;
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

  // 3. Compute threshold
  const nearBestThreshold = bestMeanDev + 0.1 * (sessionMaxDev - bestMeanDev);

  // 4. Filter to quality segments and sum durations
  let nearBestTotalTime = 0;
  for (const seg of stateSegments) {
    const isQuality = (seg.state === 'FUSION' || seg.state === 'NEAR_FUSION' || seg.state === 'STABLE_DEVIATION');
    if (isQuality && seg.metrics && seg.metrics.meanDeviation <= nearBestThreshold) {
      nearBestTotalTime += seg.duration;
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
    qualityPercent,
    driftingPercent: (driftingTime / sessionDuration) * 100,
    approachingPercent: (approachingTime / sessionDuration) * 100,
  };
}
```

Call this during `calculateSessionMetrics()` and merge the result into the returned `SessionMetrics` object.

---

## Insight Function Updates

### `src/utils/analysisInsights.ts`

**Strategy**: All users always get segment-derived metric trends computed. Additionally, fusion-specific trends are computed when `fusionAchievedRate >= FUSION_RATE_THRESHOLD_PERCENT`.

#### `calculateProgressInsight()`

**Current**: Trends `longestFusionStreak` unconditionally. Returns `minValueTrend`.

**New**:
- Compute `fusionAchievedRate = (fusionAchievedCount / totalSessions) * 100`
- Always compute trends on `bestStableDeviation`, `nearBestStableTime`, and `qualityPercent`
- If `fusionAchievedRate >= FUSION_RATE_THRESHOLD_PERCENT`: additionally compute trends on `longestFusionStreak` and `fusionEventCount`
- Remove `minValueTrend` (metric no longer exists)

**Output structure** (replaces current `ProgressInsight`):
```typescript
export interface ProgressInsight {
  metric: 'deviation' | 'rotation';
  fusionAchievedRate: number;  // % of sessions where fusion was achieved
  fusionAchievedCount: number;
  totalSessions: number;
  aggregateHistogram: HistogramBin[];

  // Segment-derived trends (always computed, all users)
  bestStableDeviationTrend: {
    slope: number;
    direction: 'improving' | 'declining' | 'stable';
    significance: { p: number; significant: boolean };
  };
  nearBestStableTimeTrend: {
    slope: number;
    direction: 'improving' | 'declining' | 'stable';
    significance: { p: number; significant: boolean };
  };
  qualityPercentTrend: {
    slope: number;
    direction: 'improving' | 'declining' | 'stable';
    significance: { p: number; significant: boolean };
  };

  // Fusion trends (only present if fusionAchievedRate >= FUSION_RATE_THRESHOLD_PERCENT)
  fusionStreakTrend?: {
    slope: number;
    direction: 'improving' | 'declining' | 'stable';
    significance: { p: number; significant: boolean };
  };
  fusionEventCountTrend?: {
    slope: number;
    direction: 'improving' | 'declining' | 'stable';
    significance: { p: number; significant: boolean };
  };
}
```

#### `calculateExerciseInsights()`

Add fields:
```typescript
export interface ExerciseInsight {
  // ... existing fields ...
  medianBestStableDeviation: number;
  medianNearBestStableTime: number;
}
```

Compute as `median(bestStableDeviation)` and `median(nearBestStableTime)` for sessions of that exercise.

#### `calculateSessionQualityInsight()`

**Current**: Uses `longestFusionStreak` for outlier detection when fusion rate is high; falls back to `minValue` when fusion rate is low.

**New**: Use `bestStableDeviation` as the primary outlier detection metric for all users unconditionally. Remove the `fusionRate >= 30%` branching logic. `bestStableDeviation` is always computed and is a better outlier signal than the noisy single-point `minValue`.

#### `calculateMilestoneInsight()`

Add a new readiness indicator: "best stable level approaching target"
```typescript
{
  type: 'best_stable_level_approaching',
  value: bestStableDeviationProgress, // (startValue - currentValue) / (startValue - targetThreshold) * 100
  met: bestStableDeviationProgress > 50,
}
```

---

## UI: Stacked Multi-Graph Component

### New Component: `src/components/ProgressGraphs.tsx`

**Props**:
```typescript
interface ProgressGraphsProps {
  sessions: SessionMetrics[];
  onDrillDown?: (sessionId: string) => void;
  exerciseFilter?: string; // filter to single exercise
}
```

**Structure**: Three stacked recharts `LineChart`/`AreaChart` components in a vertical flex container:
1. **Graph 1**: `bestStableDeviation` (y-axis: cm, line chart)
2. **Graph 2**: `nearBestStableTime` (y-axis: seconds, line chart)
3. **Graph 3**: `qualityPercent` + `driftingPercent` + `approachingPercent` (y-axis: %, stacked area chart with shared y-axis)

**X-axis specification**:
- Data points indexed by session index (0, 1, 2, ...)
- Tick labels show datetime in format "YYYY-MM-DD hh:mm:ss"
- Spacing: show tick every N sessions (auto-calculate based on total session count to avoid label crowding)

**Shared hover state**:
- Single custom tooltip component synchronized across all three graphs
- Displays: session date, exercise tag, session index, all metric values from the hovered x-position
- On hover, all three graphs highlight the same x-position visually
- Trigger: mouse over any graph OR direct touch on a point

**Zoom & Pan**:
- Mouse scroll wheel over any graph → zoom in/out on x-axis (session index range)
- Touch pinch-zoom on mobile → zoom x-axis
- Pan by dragging horizontally to shift the visible date range
- All three graphs zoom/pan together (synchronized state)

**Interaction**:
- Click on a data point → call `onDrillDown(sessionId)` to drill into single-session detail view
- Exercise filter dropdown → re-render graphs with filtered sessions only

**Data prep**: Sort sessions by date/time, assign session indices, compute datetime labels for x-axis.

---

## Navigation & State Preservation

### Integration with History/Progress Page

**Existing flow**: History page shows session list on left panel. Click single session → detail view on right. Click multiple sessions → Analysis view.

**New flow**:
1. User selects multiple sessions on History page → Analysis view opens
2. Analysis view includes ProgressGraphs component showing all selected sessions (or filtered by exercise)
3. User clicks a data point on any graph → drill down to single-session detail view for that session
4. The left panel (normally showing session list) is replaced by a **Back button**
5. Clicking Back button → returns to ProgressGraphs with the same filters/selections/zoom level preserved

**State persistence**:
- Use URL params to encode: selected sessions, exercise filter, zoom range (x-axis bounds), current drilled-down sessionId (if any)
- Format: `?sessions=id1,id2,id3&exercise=ExerciseName&zoomStart=5&zoomEnd=25&detail=sessionId4`
- On mount or back-button click, restore all state from URL
- This allows bookmarking and browser back-button to work naturally

**Mobile responsiveness**:
- On small screens (< 768px): ProgressGraphs stacks graphs more tightly, uses smaller fonts
- Back button is prominent and always visible
- Zoom/pan gestures work on touch
- Drill-down transitions to full-screen detail view

---

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| No FUSION/NEAR_FUSION/STABLE_DEVIATION segments | `bestStableDeviation` = `sessionMaxDeviation` (worst case) |
| Only DRIFTING/APPROACHING segments in session | `bestStableDeviation` = `sessionMaxDeviation` as fallback; `nearBestStableTime` = 0 |
| Very short session (< 1s) | Metrics compute as normal, graphs show zero/minimal values |
| Empty timeSeries | Return default values: `bestStableDeviation = 0`, durations = 0, percents = 0 |
| Single session | Graphs show single point, no trend visible (expected) |

---

## Testing Strategy

### Unit Tests: `src/utils/__tests__/sessionMetrics.test.ts`

- [ ] `computeSessionAggregateMetrics()` with known segment data
- [ ] nearBestThreshold boundary conditions (edge of band, outside band)
- [ ] Session with no quality segments
- [ ] Session with only FUSION segments
- [ ] Session with mixed STABLE_DEVIATION and DRIFTING
- [ ] Verify percentages sum to ~100% (allowing rounding error)
- [ ] Edge case: sessionDuration = 0

### Unit Tests: `src/utils/__tests__/analysisInsights.test.ts`

- [ ] `calculateProgressInsight()` computes all three segment-derived trends (bestStableDeviation, nearBestStableTime, qualityPercent) for all users
- [ ] `calculateProgressInsight()` additionally computes fusion trends when fusionRate >= 30%
- [ ] Trend slopes and p-values computed correctly from time-series data
- [ ] `calculateExerciseInsights()` includes new median fields (bestStableDeviation, nearBestStableTime)
- [ ] `calculateSessionQualityInsight()` detects outliers on `bestStableDeviation` instead of `minValue`
- [ ] `calculateMilestoneInsight()` includes "best stable level approaching" indicator

### Integration Tests: `src/components/__tests__/ProgressGraphs.test.tsx`

- [ ] Renders three stacked graphs
- [ ] Hover tooltip shows data from all graphs
- [ ] Click drill-down calls `onDrillDown` with correct sessionId
- [ ] Exercise filter updates graph data
- [ ] Navigation back button visible and functional
- [ ] Back button preserves filter state

### Manual/Visual Tests

- [ ] Load real session data (test_data/*.csv, existing sessions)
- [ ] Verify graphs render without crashing
- [ ] Verify tooltip values match session data
- [ ] Verify drill-down and back-button work end-to-end
- [ ] Test with fusion users (> 30% fusion rate) and non-fusion users
- [ ] Test with single session, 5 sessions, 50 sessions

---

## Files to Create/Modify

**Create:**
- `src/components/ProgressGraphs.tsx` — three stacked recharts with synchronized zoom/pan and shared hover tooltip
- `src/utils/__tests__/sessionMetrics.aggregate.test.ts` — unit tests for `computeSessionAggregateMetrics()`

**Modify:**
- `src/types/analysis.ts` — add new `SessionMetrics` fields (`bestStableDeviation`, `nearBestStableTime`, `qualityPercent`, `driftingPercent`, `approachingPercent`), remove `minValue`
- `src/utils/sessionMetrics.ts` — add `computeSessionAggregateMetrics()` function, define constants, integrate into `calculateSessionMetrics()`
- `src/utils/analysisInsights.ts` — update all insight functions to compute segment-derived trends always, define constants, extend `ProgressInsight` and `ExerciseInsight` return types
- `src/utils/__tests__/analysisInsights.test.ts` — add tests for new metrics and segment-based trends
- `src/components/AnalysisPanel.tsx` or `AggregateResultsPanel.tsx` — integrate ProgressGraphs component, handle state preservation via URL params
- `src/hooks/useSessionAnalysisState.ts` or similar — manage drill-down state, zoom level, filters (persisted to URL)
- `docs/development.md` — document new metrics, computation, and component usage

---

## Success Criteria

- [ ] All three graphs render correctly with real session data
- [ ] Hover tooltip shows consistent, correct values across graphs
- [ ] Non-fusion users' sessions show meaningful progress trends on `bestStableDeviation` and `nearBestStableTime`
- [ ] Fusion users' sessions show both fusion metrics (when rate >= 30%) and segment metrics
- [ ] Navigation to single-session view and back is seamless
- [ ] All tests pass (unit + integration)
- [ ] No performance regression on multi-session rendering (< 2s for 100+ sessions)

---

## Constants

Define at the top of relevant source files:

```typescript
// src/utils/sessionMetrics.ts
const NEAR_BEST_THRESHOLD_BAND_PERCENT = 10;  // band width as % of (max - min) deviation

// src/utils/analysisInsights.ts
const FUSION_RATE_THRESHOLD_PERCENT = 30;  // switch to fusion metrics when fusionRate >= 30%
```

## Design Decisions Confirmed

1. **X-axis representation**: Session index (0-based), with x-axis tick labels showing datetime ("YYYY-MM-DD hh:mm:ss")
2. **Composition metrics**: Single stacked area chart showing qualityPercent, driftingPercent, approachingPercent with shared y-axis (%)
3. **State persistence**: URL-encoded (session list, filters, zoom range, drill-down state) for bookmarkable, shareable links
4. **Mobile**: Full responsive design with touch-friendly zoom/pan, prominent back button, stacked layout on small screens
