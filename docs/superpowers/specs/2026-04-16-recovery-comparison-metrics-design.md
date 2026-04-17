# Recovery Comparison Metrics Enhancement

**Date:** 2026-04-16  
**Status:** Design (Ready for Implementation)  
**Scope:** Add recovery success indicators and comparison capabilities to aggregate analysis

---

## Overview

This design extends the aggregate analysis (longestQualityStreak foundation) with recovery success metrics and trend analysis. The goal is to expose **how well and how consistently** a patient recovers after drifting away from quality state.

Three coordinated changes:
1. **ProgressGraphs:** Visualize streak divergence to surface recovery patterns
2. **Progress Insights:** Track recovery consistency over time (trending)
3. **Exercise Effectiveness:** Rank exercises by recovery cycle production

---

## Part 1: ProgressGraphs Enhancement

### Current State
The "Near-Best Stable Time (seconds)" LineChart shows a single line tracking total quality time per session.

### Proposed: Add Longest Quality Streak Line

**New line:** `longestQualityStreak` (dashed or distinct stroke, color: recovery indicator — recommend teal/cyan)

**Visual logic:**
- When `nearBestStableTime` and `longestQualityStreak` **converge** → single quality episode (no recovery between states)
- When they **diverge** → multiple recovery cycles (patient regained quality after drifting away)
- Gap size = visual proxy for recovery frequency

**Example visualization:**
```
Near-Best Stable Time: ━━━━━━━━━━━━━━━ (8.0s total)
Longest Quality Streak: ━━━━ (2.1s max single streak)
                        ↑ divergence indicates 4 episodes
```

### Enhanced Tooltip

Hover on any data point shows:
```
Date: [session date]
Near-Best Stable Time: [value]s
Longest Quality Streak: [value]s
Quality Episode Count: [value]
```

**Rationale:** Users can see not just the metrics, but confirm recovery happened via episode count.

### Implementation Details

**File:** `src/components/ProgressGraphs.tsx`

**Changes:**
1. Add `longestQualityStreak` to `graphData` useMemo (pull from session metrics)
2. Add new `<Line>` component to LineChart:
   - `dataKey="longestQualityStreak"`
   - Stroke color: recovery indicator (suggest `#20b2aa` or similar teal)
   - Stroke style: dashed or reduced opacity to distinguish from main metric
   - Legend label: "Longest Quality Streak"
3. Update tooltip formatter to include `qualityEpisodeCount` in the data and display it

---

## Part 2: Progress Insights — Recovery Consistency

### New Metric: Recovery Consistency

**Definition:** Percentage of sessions where patient achieved recovery.

```
recoveryConsistency = (sessionsWithRecovery / totalSessions) × 100

where: sessionsWithRecovery = count of sessions where qualityEpisodeCount > 1
```

**Interpretation:**
- **100%** = Patient recovered in every session
- **50%** = Patient recovered in half their sessions  
- **0%** = Patient never achieved recovery (always single-episode sessions)

**Clinical meaning:** Recovery consistency tells you *how reliably* the patient can regain quality after drifting — not just whether they can, but whether they do it regularly.

### New Trend: Recovery Consistency Trend

**Definition:** Linear regression of recovery consistency across sorted sessions, with direction and significance.

**Structure:**
```typescript
recoveryConsistencyTrend: {
  slope: number,           // rate of change per week
  direction: TrendDirection, // "improving" | "declining" | "stable"
  significance: { p: number, significant: boolean }
}
```

**Interpretation:**
- **Positive slope + significant** = Patient is recovering more frequently over time (strong progress signal)
- **Negative slope + significant** = Recovery frequency declining (concerning trend, may warrant intervention)
- **Non-significant** = Natural variability, no clear trend yet

### UI Display

In the Progress Insights panel (alongside existing trend metrics):

```
Recovery Consistency: 75% (↑ Improving)
```

Optional expanded view with explanation:
> "Patient recovered after drift in 75% of recent sessions. Recovery frequency trending upward — good progress on regaining focus after difficulty."

### Implementation Details

**File:** `src/utils/analysisInsights.ts` → `calculateProgressInsight()`

**Algorithm:**

```typescript
// Count sessions with recovery (qualityEpisodeCount > 1)
const sessionsWithRecovery = sortedSessionMetrics.filter(
  m => m.qualityEpisodeCount > 1
).length;

const recoveryConsistency = sortedSessionMetrics.length > 0
  ? (sessionsWithRecovery / sortedSessionMetrics.length) * 100
  : 0;

// Compute trend: recovery consistency per session
const recoveryConsistencyPoints: [number, number][] = sortedSessionMetrics.map((m, i) => [
  i,
  m.qualityEpisodeCount > 1 ? 100 : 0  // binary: recovered or not
]);

const recoveryConsistencySlope = linearRegressionSlope(recoveryConsistencyPoints) / (sortedSessionMetrics.length / 52);
const recoveryConsistencyP = regressionPValue(recoveryConsistencyPoints);

progressInsight.recoveryConsistency = recoveryConsistency;
progressInsight.recoveryConsistencyTrend = {
  slope: recoveryConsistencySlope,
  direction: trendDirection(recoveryConsistencySlope, recoveryConsistencyP, 'recovery'),
  significance: { p: recoveryConsistencyP, significant: recoveryConsistencyP < 0.05 },
};
```

**Type updates:** `src/types/analysis.ts` → `ProgressInsight`

Add fields:
```typescript
recoveryConsistency: number;           // percentage 0-100
recoveryConsistencyTrend: TrendInfo;   // trend info with direction + significance
```

**UI implementation:** `ProgressInsightsPanel` — add new row displaying recovery consistency + trend

---

## Part 3: Exercise Effectiveness — Recovery Cycles Column

### New Column: Recovery Cycles

Add a single column to the existing exercise table showing recovery cycle production per exercise.

**Column format:**

```
Exercise Name          | Recovery Cycles | [Other existing columns...]
────────────────────────────────────────────────────────────────────────
Brock String           | 3.5 (↑)         | ...
Convergence Jumps      | 2.8 (→)         | ...
Pencil Push-ups        | 2.1 (↓)         | ...
```

**Content:** Median `qualityEpisodeCount` + trend direction symbol (↑ ↓ →)

**Clinical meaning:**
- **High median (e.g., 3.5)** = This exercise naturally produces frequent recovery cycles
- **Low median (e.g., 1.5)** = This exercise tends to produce sustained focus (single long episodes)
- **Trend arrow** = Whether recovery production is improving, stable, or declining with this exercise

**Sort order:** Maintain existing exercise table sort — no new sorting behavior.

### New Metrics per Exercise

**1. Median Recovery Cycles**
```typescript
medianRecoveryCycles = calculateMedian(
  sessionMetricsForExercise.map(m => m.qualityEpisodeCount)
)
```

**2. Recovery Cycles Trend**
```typescript
// Linear regression of qualityEpisodeCount for sessions using this exercise
const recoveryCyclePoints: [number, number][] = sessionMetricsForExercise
  .map((m, i) => [i, m.qualityEpisodeCount]);

recoveryCyclesTrend = {
  slope: linearRegressionSlope(recoveryCyclePoints) / (sessionMetricsForExercise.length / 52),
  direction: trendDirection(slope, pValue, 'recovery'),
  significance: { p: pValue, significant: pValue < 0.05 }
}
```

### Implementation Details

**File:** `src/utils/analysisInsights.ts` → `calculateExerciseInsights()`

**Algorithm:**

For each exercise grouping:

```typescript
const sessionMetricsForExercise = sessionMetrics.filter(
  m => m.exerciseName === exerciseName
);

// Calculate median recovery cycles
const recoveryCycles = sessionMetricsForExercise.map(m => m.qualityEpisodeCount);
const medianRecoveryCycles = calculateMedian(recoveryCycles);

// Calculate trend
const recoveryCyclePoints: [number, number][] = sessionMetricsForExercise.map((m, i) => [i, m.qualityEpisodeCount]);
const recoveryCyclesSlope = linearRegressionSlope(recoveryCyclePoints) / (sessionMetricsForExercise.length / 52);
const recoveryCyclesP = regressionPValue(recoveryCyclePoints);

// Add to ExerciseInsight for this exercise
exerciseInsight.medianRecoveryCycles = medianRecoveryCycles;
exerciseInsight.recoveryCyclesTrend = {
  slope: recoveryCyclesSlope,
  direction: trendDirection(recoveryCyclesSlope, recoveryCyclesP, 'recovery'),
  significance: { p: recoveryCyclesP, significant: recoveryCyclesP < 0.05 }
};
```

**Type updates:** `src/types/analysis.ts` → `ExerciseInsight`

Add fields:
```typescript
medianRecoveryCycles: number;      // median qualityEpisodeCount for this exercise
recoveryCyclesTrend: TrendInfo;    // trend direction + significance
```

**UI implementation:** `ExerciseEffectivenessPanel` — add new column to existing exercise table

---

## Data Dependencies

All metrics depend on:
- `SessionMetrics.qualityEpisodeCount` (from existing aggregate spec)
- `SessionMetrics.longestQualityStreak` (from existing aggregate spec)
- Existing FSM state classification and threshold logic

No new external dependencies.

---

## Success Criteria

- [ ] ProgressGraphs displays longestQualityStreak line alongside nearBestStableTime
- [ ] Tooltip includes qualityEpisodeCount
- [ ] Recovery Consistency metric computed and trends calculated correctly
- [ ] Recovery Consistency displays in Progress Insights with trend direction
- [ ] Exercise table shows new "Recovery Cycles" column with median + trend
- [ ] Sorting of exercise table unchanged (maintains existing order)
- [ ] All calculations use existing trend infrastructure (linearRegressionSlope, regressionPValue, trendDirection)
- [ ] No regressions to existing metrics or visualizations

---

## Open Questions

1. **Color choice for longestQualityStreak line:** Recommend teal/cyan (e.g., `#20b2aa`). Confirm or suggest alternative?
2. **Stroke style for longestQualityStreak:** Dashed, dotted, or reduced opacity? Current preference: dashed.
3. **Recovery Consistency tooltip:** Should we show it in the Progress Insights detail view, or is the percentage + trend arrow sufficient?
4. **Exercise table column order:** Where should "Recovery Cycles" appear relative to existing columns (median longestStreak, median fusionEventCount, etc.)?

