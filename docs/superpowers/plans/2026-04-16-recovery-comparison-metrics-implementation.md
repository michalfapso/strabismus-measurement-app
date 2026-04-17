# Recovery Comparison Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend aggregate analysis with recovery success metrics — visualize recovery patterns, track recovery consistency over time, and rank exercises by recovery cycle production.

**Architecture:** Three coordinated changes: (1) ProgressGraphs visualization showing streak divergence, (2) Progress Insights tracking recovery consistency with trending, (3) Exercise Effectiveness ranking by recovery cycles per exercise. All calculations leverage existing trend infrastructure (linearRegressionSlope, regressionPValue, trendDirection).

**Tech Stack:** React · TypeScript · recharts · emotion · existing analysis utilities

---

## Task 1: Update Type Definitions

**Files:**
- Modify: `src/types/analysis.ts`

Add recovery-related fields to existing types.

- [ ] **Step 1: Read ProgressInsight type definition**

Run: `head -100 src/types/analysis.ts` or open the file

Find the `ProgressInsight` interface and note existing fields like `bestStableDeviationTrend`, `nearBestStableTimeTrend`, etc.

- [ ] **Step 2: Add recovery consistency fields to ProgressInsight**

Add these two fields to the `ProgressInsight` interface:

```typescript
recoveryConsistency: number;           // percentage 0-100
recoveryConsistencyTrend: TrendInfo;   // trend info with direction + significance
```

- [ ] **Step 3: Find ExerciseInsight type definition**

Locate the `ExerciseInsight` interface in the same file. Note existing fields like `medianLongestStreak`, `medianBestStableDeviation`, etc.

- [ ] **Step 4: Add recovery cycles fields to ExerciseInsight**

Add these two fields to the `ExerciseInsight` interface:

```typescript
medianRecoveryCycles: number;      // median qualityEpisodeCount for this exercise
recoveryCyclesTrend: TrendInfo;    // trend direction + significance
```

- [ ] **Step 5: Verify TrendInfo type exists**

Search for `type TrendInfo` or `interface TrendInfo` in the file. Confirm it has properties: `slope`, `direction`, `significance` (with `p` and `significant` properties).

If it doesn't exist, create it:
```typescript
interface TrendInfo {
  slope: number;
  direction: TrendDirection;
  significance: { p: number; significant: boolean };
}
```

- [ ] **Step 6: Commit type changes**

```bash
git add src/types/analysis.ts
git commit -m "types: add recovery consistency and recovery cycles fields"
```

---

## Task 2: Implement Recovery Consistency Calculation

**Files:**
- Modify: `src/utils/analysisInsights.ts` → `calculateProgressInsight()` function

Calculate recovery consistency (% of sessions with recovery) and its trend.

- [ ] **Step 1: Locate calculateProgressInsight function**

Open `src/utils/analysisInsights.ts` and find the `calculateProgressInsight()` function. This function receives a `SessionMetrics[]` array and returns a `ProgressInsight` object. Note where existing trends are computed (look for `linearRegressionSlope`, `regressionPValue`, `trendDirection` calls).

- [ ] **Step 2: Find the sorted sessions and existing trend calculations**

Inside `calculateProgressInsight()`, find where `sortedSessionMetrics` is created and where trends like `bestStableDeviationTrend` are computed. This is where recovery consistency calculations will go.

- [ ] **Step 3: Add recovery consistency calculation after existing trends**

At the end of the trend computation section (before the return statement), add:

```typescript
// Recovery Consistency: % of sessions where patient achieved recovery (qualityEpisodeCount > 1)
const sessionsWithRecovery = sortedSessionMetrics.filter(
  m => m.qualityEpisodeCount > 1
).length;

const recoveryConsistency = sortedSessionMetrics.length > 0
  ? (sessionsWithRecovery / sortedSessionMetrics.length) * 100
  : 0;
```

- [ ] **Step 4: Add recovery consistency trend calculation**

Immediately after the recovery consistency calculation, add the trend:

```typescript
// Trend: recovery consistency (binary: recovered or not per session)
const recoveryConsistencyPoints: [number, number][] = sortedSessionMetrics.map((m, i) => [
  i,
  m.qualityEpisodeCount > 1 ? 100 : 0  // binary: recovered (100) or not (0)
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

**Note:** The `trendDirection` function is called with `'recovery'` as the third argument. Verify this function accepts a string parameter for metric type. If it doesn't, use an existing metric type or check the function signature.

- [ ] **Step 5: Run tests to verify calculation doesn't break existing functionality**

Run: `npm run test -- analysisInsights` (or your test command for this file)

Expected: All existing tests pass (recovery consistency is new, so no new tests yet)

- [ ] **Step 6: Commit calculation changes**

```bash
git add src/utils/analysisInsights.ts
git commit -m "feat: add recovery consistency calculation and trend to progress insights"
```

---

## Task 3: Implement Exercise Recovery Cycles Calculation

**Files:**
- Modify: `src/utils/analysisInsights.ts` → `calculateExerciseInsights()` function

Calculate median recovery cycles and trend for each exercise.

- [ ] **Step 1: Locate calculateExerciseInsights function**

Open `src/utils/analysisInsights.ts` and find the `calculateExerciseInsights()` function. This function typically groups sessions by exercise and computes per-exercise metrics. Note the structure of the existing loop that computes `medianLongestStreak`, `medianFusionEventCount`, etc.

- [ ] **Step 2: Find the inner loop that processes each exercise**

Inside `calculateExerciseInsights()`, locate the section where it iterates through exercises and builds the `ExerciseInsight` objects. This is where recovery cycles metrics will be added.

- [ ] **Step 3: Add median recovery cycles calculation**

For each exercise, after existing median calculations (e.g., `medianBestStableDeviation`), add:

```typescript
// Median Recovery Cycles: median qualityEpisodeCount for this exercise
const recoveryCycles = sessionMetricsForExercise.map(m => m.qualityEpisodeCount);
const medianRecoveryCycles = calculateMedian(recoveryCycles);
```

**Note:** `calculateMedian()` function should already exist in this codebase (used for other median calculations). If it doesn't, you'll need to create or import it.

- [ ] **Step 4: Add recovery cycles trend calculation**

Immediately after the median calculation, add the trend:

```typescript
// Trend: recovery cycles for this exercise
const recoveryCyclePoints: [number, number][] = sessionMetricsForExercise.map((m, i) => [
  i,
  m.qualityEpisodeCount
]);

const recoveryCyclesSlope = linearRegressionSlope(recoveryCyclePoints) / (sessionMetricsForExercise.length / 52);
const recoveryCyclesP = regressionPValue(recoveryCyclePoints);

const recoveryCyclesTrend = {
  slope: recoveryCyclesSlope,
  direction: trendDirection(recoveryCyclesSlope, recoveryCyclesP, 'recovery'),
  significance: { p: recoveryCyclesP, significant: recoveryCyclesP < 0.05 },
};
```

- [ ] **Step 5: Add fields to ExerciseInsight object**

Ensure the `ExerciseInsight` object being returned includes:

```typescript
medianRecoveryCycles: medianRecoveryCycles,
recoveryCyclesTrend: recoveryCyclesTrend,
```

- [ ] **Step 6: Handle edge case: exercises with no sessions**

Verify that if `sessionMetricsForExercise.length === 0`, the code doesn't break. Add a guard if needed:

```typescript
if (sessionMetricsForExercise.length === 0) {
  // Skip or set defaults
  medianRecoveryCycles = 0;
  recoveryCyclesTrend = { slope: 0, direction: 'stable', significance: { p: 1, significant: false } };
}
```

- [ ] **Step 7: Run tests to verify calculation**

Run: `npm run test -- analysisInsights`

Expected: All existing tests pass

- [ ] **Step 8: Commit calculation changes**

```bash
git add src/utils/analysisInsights.ts
git commit -m "feat: add recovery cycles calculation per exercise"
```

---

## Task 4: Update ProgressGraphs Component — Add Recovery Streak Line

**Files:**
- Modify: `src/components/ProgressGraphs.tsx`

Add longestQualityStreak line to the "Near-Best Stable Time" chart and enhance tooltip.

- [ ] **Step 1: Read ProgressGraphs component structure**

Open `src/components/ProgressGraphs.tsx`. Identify:
- The `graphData` useMemo hook that builds the data object for recharts
- The `<LineChart>` component that renders the chart
- Existing `<Line>` components (there should be one for `nearBestStableTime`)
- The tooltip formatter function

- [ ] **Step 2: Add longestQualityStreak to graphData**

In the `graphData` useMemo, ensure that each data point includes `longestQualityStreak`. If the data is built from `sessionMetrics`, add:

```typescript
{
  // ... existing fields like nearBestStableTime, date
  longestQualityStreak: metric.longestQualityStreak,
  qualityEpisodeCount: metric.qualityEpisodeCount,
}
```

- [ ] **Step 3: Add new Line component for longestQualityStreak**

After the existing `<Line>` for `nearBestStableTime`, add:

```typescript
<Line
  type="monotone"
  dataKey="longestQualityStreak"
  stroke="#20b2aa"
  strokeDasharray="5 5"
  dot={false}
  name="Longest Quality Streak"
/>
```

**Note:** 
- Color `#20b2aa` is the recommended teal/cyan. Adjust if needed.
- `strokeDasharray="5 5"` creates a dashed line. Adjust or use `strokeOpacity={0.6}` instead if preferred.
- `dot={false}` hides the data point dots (matches existing lines).
- `name="Longest Quality Streak"` is the legend label.

- [ ] **Step 4: Locate and update tooltip formatter**

Find the tooltip formatter function (likely a function passed to `<Tooltip formatter={...} />` or `<Tooltip content={CustomTooltip} />`). 

If using a custom tooltip component, update it to include `qualityEpisodeCount`.

If using a simple formatter, update it to handle the new fields.

- [ ] **Step 5: Update tooltip to display qualityEpisodeCount**

Modify the tooltip to show:
```
Date: [sessionDate]
Near-Best Stable Time: [value]s
Longest Quality Streak: [value]s
Quality Episode Count: [value]
```

If using recharts' default `<Tooltip />`, this should work automatically if the data object has these fields. If using a custom component, update the rendering logic.

Example custom tooltip update:
```typescript
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div>
        <p>Date: {formatDate(data.date)}</p>
        <p>Near-Best Stable Time: {data.nearBestStableTime}s</p>
        <p>Longest Quality Streak: {data.longestQualityStreak}s</p>
        <p>Quality Episode Count: {data.qualityEpisodeCount}</p>
      </div>
    );
  }
  return null;
};
```

- [ ] **Step 6: Verify the legend displays both lines**

Check that the `<LineChart>` has a `<Legend />` component. If not, add:
```typescript
<Legend />
```

The legend should now show both "Near-Best Stable Time" and "Longest Quality Streak".

- [ ] **Step 7: Run dev server and verify visually**

Run: `npm run dev`

Navigate to a page that displays the ProgressGraphs (likely the multi-session aggregate view). Verify:
- The new line appears (dashed, teal/cyan color)
- It diverges from the main line when recovery occurs
- Tooltip shows all four fields when hovering

- [ ] **Step 8: Commit visualization changes**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat: add longest quality streak line to progress graphs and enhance tooltip"
```

---

## Task 5: Display Recovery Consistency in Progress Insights Panel

**Files:**
- Modify: `ProgressInsightsPanel` component (likely in `src/components/` — find the correct file name)

Add recovery consistency metric row to the progress insights display.

- [ ] **Step 1: Locate ProgressInsightsPanel component**

Search: `grep -r "ProgressInsightsPanel" src/components/`

Open the component file. Identify:
- Where other trends are rendered (look for `bestStableDeviationTrend`, `nearBestStableTimeTrend`)
- The structure of how metrics are displayed (likely rows with label + value + trend arrow)

- [ ] **Step 2: Find the rendering section for trends**

Locate where existing trends like `nearBestStableTimeTrend` are displayed. Note the format (e.g., "Near-Best Stable Time: 5.2s (↑ Improving)").

- [ ] **Step 3: Add recovery consistency row**

After existing trend rows, add:

```typescript
{progressInsight?.recoveryConsistency !== undefined && (
  <div>
    <strong>Recovery Consistency:</strong> {progressInsight.recoveryConsistency.toFixed(0)}% (
      <TrendArrow trend={progressInsight.recoveryConsistencyTrend} />
    )
  </div>
)}
```

**Note:**
- `TrendArrow` is the component used to display trend direction (↑ ↓ →). Verify it exists or use the same pattern as other trends.
- `.toFixed(0)` rounds to nearest whole percent.

- [ ] **Step 4: Handle undefined/null cases**

Verify the component safely handles cases where `recoveryConsistency` or `recoveryConsistencyTrend` is undefined (e.g., when calculating from small sample sizes).

- [ ] **Step 5: Verify styling matches existing trends**

Check that colors, font weight, and spacing match other trend metrics in the panel. Use the same CSS classes/emotion styles.

- [ ] **Step 6: Run dev server and verify display**

Run: `npm run dev`

Navigate to the Progress Insights panel (aggregate view). Verify:
- Recovery Consistency appears alongside other metrics
- Percentage displays correctly (0-100)
- Trend arrow appears (↑, ↓, or →)
- Styling matches other trends

- [ ] **Step 7: Commit UI changes**

```bash
git add src/components/[ProgressInsightsPanel file]
git commit -m "feat: display recovery consistency in progress insights panel"
```

---

## Task 6: Add Recovery Cycles Column to Exercise Effectiveness Panel

**Files:**
- Modify: `ExerciseEffectivenessPanel` component (likely in `src/components/`)

Add "Recovery Cycles" column to the exercise table showing median + trend.

- [ ] **Step 1: Locate ExerciseEffectivenessPanel component**

Search: `grep -r "ExerciseEffectivenessPanel" src/components/`

Open the component file. Identify:
- The table structure (HTML `<table>`, recharts, or custom component)
- Existing columns (Exercise Name, Median Longest Streak, Median Fusion Event Count, etc.)
- Where column headers are defined
- Where row data is rendered

- [ ] **Step 2: Find the table header section**

Locate where table column headers are defined (likely `<thead>` or similar structure).

- [ ] **Step 3: Add "Recovery Cycles" column header**

Add a new column header (maintaining existing order):

```typescript
<th>Recovery Cycles</th>
```

Place it logically (e.g., after "Median Longest Streak" or at the end before action columns, per the spec's question #4 — if not specified, add at the end).

- [ ] **Step 4: Find the table row rendering section**

Locate where each exercise's data is rendered as a row. This typically involves mapping over the exercise array.

- [ ] **Step 5: Add recovery cycles cell to each row**

In the row rendering for each exercise, add a new cell:

```typescript
<td>
  {exerciseInsight.medianRecoveryCycles?.toFixed(1)} (
    <TrendArrow trend={exerciseInsight.recoveryCyclesTrend} />
  )
</td>
```

**Note:**
- `.toFixed(1)` rounds to one decimal place (e.g., 3.5)
- `TrendArrow` component displays the trend direction symbol
- Use optional chaining (`?.`) to handle cases where the metric is undefined

- [ ] **Step 6: Verify table maintains existing sort order**

Confirm that the table still uses existing sort logic. Do NOT change sorting behavior. The new column should not affect the primary sort order.

- [ ] **Step 7: Verify styling matches other columns**

Check that padding, alignment, and font sizing match other numeric columns in the table.

- [ ] **Step 8: Handle edge case: exercises with no trend**

If an exercise has only one session, the trend may not be significant. Verify the display handles this gracefully (e.g., shows "→ Stable" or similar).

- [ ] **Step 9: Run dev server and verify display**

Run: `npm run dev`

Navigate to the Exercise Effectiveness panel (aggregate view). Verify:
- New "Recovery Cycles" column appears
- Median values display (e.g., 3.5, 2.8, 2.1)
- Trend arrows appear (↑, ↓, →)
- Column is aligned with headers
- Table sorting is unchanged

- [ ] **Step 10: Commit UI changes**

```bash
git add src/components/[ExerciseEffectivenessPanel file]
git commit -m "feat: add recovery cycles column to exercise effectiveness panel"
```

---

## Task 7: Integration Test & Verification

**Files:**
- Test: Create `src/__tests__/recoveryMetrics.integration.test.ts` (or add to existing integration tests)

Verify all pieces work together end-to-end.

- [ ] **Step 1: Write test for recovery consistency calculation**

```typescript
import { calculateProgressInsight } from '../utils/analysisInsights';

describe('Recovery Metrics Integration', () => {
  it('should calculate recovery consistency correctly', () => {
    const sessionMetrics = [
      { qualityEpisodeCount: 1, /* ... other fields */ },
      { qualityEpisodeCount: 3, /* ... other fields */ },
      { qualityEpisodeCount: 1, /* ... other fields */ },
      { qualityEpisodeCount: 2, /* ... other fields */ },
    ];

    const progressInsight = calculateProgressInsight(sessionMetrics);

    // 3 out of 4 sessions have recovery (qualityEpisodeCount > 1)
    expect(progressInsight.recoveryConsistency).toBe(75);
    expect(progressInsight.recoveryConsistencyTrend).toBeDefined();
    expect(progressInsight.recoveryConsistencyTrend.significance).toBeDefined();
  });
});
```

- [ ] **Step 2: Write test for exercise recovery cycles calculation**

```typescript
import { calculateExerciseInsights } from '../utils/analysisInsights';

describe('Exercise Recovery Cycles', () => {
  it('should calculate median recovery cycles per exercise', () => {
    const sessionMetrics = [
      { exerciseName: 'Brock String', qualityEpisodeCount: 3, /* ... */ },
      { exerciseName: 'Brock String', qualityEpisodeCount: 4, /* ... */ },
      { exerciseName: 'Pencil Push-ups', qualityEpisodeCount: 1, /* ... */ },
      { exerciseName: 'Pencil Push-ups', qualityEpisodeCount: 2, /* ... */ },
    ];

    const exerciseInsights = calculateExerciseInsights(sessionMetrics);

    const brockInsight = exerciseInsights.find(e => e.exerciseName === 'Brock String');
    expect(brockInsight.medianRecoveryCycles).toBe(3.5);
    expect(brockInsight.recoveryCyclesTrend).toBeDefined();
  });
});
```

- [ ] **Step 3: Run integration tests**

Run: `npm run test -- recoveryMetrics.integration.test.ts -v`

Expected: Both tests pass

- [ ] **Step 4: Run full test suite**

Run: `npm run test`

Expected: All tests pass, no regressions

- [ ] **Step 5: Manual end-to-end verification**

Run: `npm run dev`

1. Navigate to a session with known recovery patterns (qualityEpisodeCount > 1)
2. Open the aggregate (multi-session) view
3. Verify:
   - ProgressGraphs shows two lines (nearBestStableTime and longestQualityStreak)
   - Lines diverge when recovery occurs
   - Tooltip shows qualityEpisodeCount
   - Recovery Consistency metric displays in Progress Insights
   - Exercise Effectiveness table shows Recovery Cycles column with trends

4. Test filtering by exercise and date — verify calculations remain correct

- [ ] **Step 6: Commit tests**

```bash
git add src/__tests__/recoveryMetrics.integration.test.ts
git commit -m "test: add integration tests for recovery metrics"
```

- [ ] **Step 7: Final cleanup and verification**

Run: `npm run build`

Expected: Build succeeds with no TypeScript errors

Verify no console warnings in dev server.

- [ ] **Step 8: Final commit summary**

All features are now complete. The implementation includes:
- Type definitions for recovery metrics
- Calculation logic for recovery consistency and exercise recovery cycles
- ProgressGraphs visualization enhancements
- UI display in Progress Insights and Exercise Effectiveness panels
- Integration tests

---

## Success Criteria Checklist

- [ ] ProgressGraphs displays longestQualityStreak line alongside nearBestStableTime
- [ ] Tooltip includes qualityEpisodeCount
- [ ] Recovery Consistency metric computed and trends calculated correctly
- [ ] Recovery Consistency displays in Progress Insights with trend direction
- [ ] Exercise table shows new "Recovery Cycles" column with median + trend
- [ ] Sorting of exercise table unchanged (maintains existing order)
- [ ] All calculations use existing trend infrastructure
- [ ] No regressions to existing metrics or visualizations
- [ ] All tests pass
- [ ] Build succeeds

---

## Implementation Notes

**Dependencies already in codebase:**
- `linearRegressionSlope()` — existing trend function
- `regressionPValue()` — existing trend function
- `trendDirection()` — existing trend direction computation
- `calculateMedian()` — existing utility for median calculations
- `TrendArrow` component — existing component for displaying trends

**Color & Styling:**
- Recommend teal/cyan (`#20b2aa`) for longestQualityStreak line
- Use dashed stroke (`strokeDasharray="5 5"`) to distinguish from main metric
- Match existing styling for new UI elements (Recovery Consistency row, Recovery Cycles column)

**Edge Cases to Handle:**
- Sessions with zero qualityEpisodeCount (no recovery possible)
- Exercises with only one session (trend may not be significant)
- Empty session arrays (recoveryConsistency defaults to 0)
- Non-significant trends (p > 0.05 displays as "→ Stable")
