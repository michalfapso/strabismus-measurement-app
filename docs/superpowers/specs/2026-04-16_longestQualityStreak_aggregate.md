# Aggregate Analysis: Quality Episode Recovery Metrics

**Date:** 2026-04-16  
**Status:** Design Brainstorm (Future Implementation)  
**Scope:** Multi-session progress insights using `longestQualityStreak` and episode recovery data

---

## Overview

Once `longestQualityStreak` is correctly defined (longest continuous time *within* the quality threshold band), it enables a new clinical insight: **recovery ability** — the patient's capacity to regain quality after drifting away.

The comparison of two metrics reveals this:
- **`longestQualityStreak`**: Longest single quality episode
- **`nearBestStableTime`**: Total accumulated quality time across all episodes

When these diverge, it means multiple quality episodes → the patient is recovering. This document outlines how to expose recovery patterns in aggregate (multi-session) analysis and visualization.

---

## New Per-Session Metric: `qualityEpisodeCount`

### Definition

Count of distinct quality episodes in a session. An episode is a run of consecutive quality-band segments (segments where `meanDeviation ≤ nearBestThreshold`).

Episodes are distinct when **between them the user goes above the threshold** — i.e., at least one intervening segment has `meanDeviation > nearBestThreshold`.

### Algorithm

```
episodeCount = 0
inEpisode = false

for each segment in stateSegments:
  isQualityBand = (segment.state in [FUSION, NEAR_FUSION, STABLE_DEVIATION] 
                   AND segment.metrics.meanDeviation ≤ nearBestThreshold)
  
  if isQualityBand:
    if not inEpisode:
      episodeCount++
      inEpisode = true
  else if segment.metrics.meanDeviation > nearBestThreshold:
    inEpisode = false
  // Note: segments with meanDeviation ≤ threshold but non-quality state 
  // don't break episodes (though theoretically rare)
```

### Clinical Meaning

- **High `qualityEpisodeCount`**: Multiple separate quality periods → patient is regaining quality repeatedly
- **Low `qualityEpisodeCount`** (e.g., 1): Single monolithic quality period → either consistently good or lucky once
- Combined with `longestQualityStreak`: a patient with `nearBestStableTime = 8s`, `longestQualityStreak = 2s`, `qualityEpisodeCount = 4` is demonstrating strong recovery ability (4 episodes averaging 2s each)

### Implementation Location

- **Compute in:** `src/utils/sessionMetrics.ts` → `computeSessionAggregateMetrics()` (same loop as `longestQualityStreak`)
- **Add to:** `SessionMetrics` type (new field: `qualityEpisodeCount: number`)
- **Return from:** `computeSessionAggregateMetrics()` return object

---

## ProgressGraphs Changes: Visualize Streak vs. Total

### Current State

ProgressGraphs displays two charts for multi-session views:
1. **Best Stable Deviation (cm)** — line chart
2. **Near-Best Stable Time (s)** — line chart

### Proposed: Add `longestQualityStreak` to the Near-Best Stable Time chart

Display both `nearBestStableTime` (existing line) and `longestQualityStreak` (new line) on the same chart.

**Purpose:** Visual pattern recognition of recovery ability
- When lines **converge** → ratios approach 1.0 → single episodes dominating
- When lines **diverge** → ratios < 1.0 → multiple episodes, demonstrating recovery

**Implementation:**
- Add `longestQualityStreak` to the data object returned by the `graphData` useMemo
- Add second `Line` component to the "Near-Best Stable Time" LineChart with:
  - `dataKey="longestQualityStreak"`
  - Different color (e.g., `THEME.stateNearFusion` or a new recovery indicator color)
  - Legend label: "Longest Quality Streak"
  - Stroke pattern: dashed or different width to distinguish from main metric
- Update tooltip to show both values

**File:** `src/components/ProgressGraphs.tsx`

---

## Aggregate Trend Analysis: `calculateProgressInsight` Changes

### Current Trends Computed

`calculateProgressInsight()` currently computes:
- `bestStableDeviationTrend` (always)
- `nearBestStableTimeTrend` (always)
- `qualityPercentTrend` (always)
- `fusionStreakTrend` (only when `fusionAchievedRate >= 30%`)
- `fusionEventCountTrend` (only when `fusionAchievedRate >= 30%`)

### New Trends to Add

**1. `longestQualityStreakTrend`** (always computed)
- Same structure as other trends: `{ slope, direction, significance }`
- OLS linear regression across sorted sessions
- Computed even for non-fusion sessions
- **Interpretation:** 
  - Positive slope = getting better at achieving longer individual quality episodes
  - Negative slope = quality episodes are getting shorter
  - Can indicate whether training is building endurance or fragmenting ability

**2. `qualityEpisodeCountTrend`** (always computed)
- Same structure
- **Interpretation:**
  - Increasing trend = patient is learning to recover more frequently
  - Decreasing trend = consolidating multiple short episodes into fewer long ones (also good, different pattern)
  - Combined with `longestQualityStreakTrend`: tells whether training develops sustained vs. repeated quality

### Implementation

File: `src/utils/analysisInsights.ts` → `calculateProgressInsight()`

Add to the function, after computing existing trends:

```typescript
// Trend: longest quality streak (always computed)
const longestQualityStreakPoints: [number, number][] = sorted.map((m, i) => [i, m.longestQualityStreak]);
const longestQualityStreakSlope = linearRegressionSlope(longestQualityStreakPoints) / (sorted.length / 52);
const longestQualityStreakP = regressionPValue(longestQualityStreakPoints);

progressInsight.longestQualityStreakTrend = {
  slope: longestQualityStreakSlope,
  direction: trendDirection(longestQualityStreakSlope, longestQualityStreakP, 'streak'),
  significance: { p: longestQualityStreakP, significant: longestQualityStreakP < 0.05 },
};

// Trend: quality episode count (always computed)
const qualityEpisodeCountPoints: [number, number][] = sorted.map((m, i) => [i, m.qualityEpisodeCount]);
const qualityEpisodeCountSlope = linearRegressionSlope(qualityEpisodeCountPoints) / (sorted.length / 52);
const qualityEpisodeCountP = regressionPValue(qualityEpisodeCountPoints);

progressInsight.qualityEpisodeCountTrend = {
  slope: qualityEpisodeCountSlope,
  direction: trendDirection(qualityEpisodeCountSlope, qualityEpisodeCountP, 'episode'),
  significance: { p: qualityEpisodeCountP, significant: qualityEpisodeCountP < 0.05 },
};
```

Update `ProgressInsight` type in `src/types/analysis.ts`:
```typescript
longestQualityStreakTrend: TrendInfo;
qualityEpisodeCountTrend: TrendInfo;
```

---

## Exercise Insights: `calculateExerciseInsights` Changes

### Current Metrics per Exercise

`calculateExerciseInsights()` currently computes per exercise:
- `medianLongestStreak` (fusion-only)
- `medianFusionEventCount` (fusion-only)
- `medianBestStableDeviation`
- `medianNearBestStableTime`

### New Metrics to Add

**1. `medianLongestQualityStreak`** — median of `longestQualityStreak` across sessions using this exercise
- Shows which exercises develop sustained individual quality periods
- Useful for assessing exercise difficulty and patient's ability to maintain focus

**2. `medianQualityEpisodeCount`** — median of `qualityEpisodeCount` across sessions using this exercise
- Shows whether the exercise tends to produce single episodes or multiple recoveries
- Interpretation: higher episode count might indicate the exercise involves frequent transitions (e.g., Brock string with visual targets)

### Implementation

File: `src/utils/analysisInsights.ts` → `calculateExerciseInsights()`

For each exercise grouping:

```typescript
const longestStreaks = sessionMetricsForExercise.map(m => m.longestQualityStreak);
const medianLongestQualityStreak = calculateMedian(longestStreaks);

const episodeCounts = sessionMetricsForExercise.map(m => m.qualityEpisodeCount);
const medianQualityEpisodeCount = calculateMedian(episodeCounts);

// Add to ExerciseInsight for this exercise:
medianLongestQualityStreak,
medianQualityEpisodeCount,
```

Update `ExerciseInsight` type in `src/types/analysis.ts`:
```typescript
medianLongestQualityStreak: number;
medianQualityEpisodeCount: number;
```

---

## Clinical Use Cases

### Case 1: Assessing Recovery Ability Over Time

**Scenario:** Patient's `nearBestStableTime` is increasing, but you want to understand why.

**Using the new metrics:**
- If `qualityEpisodeCountTrend` is increasing and `longestQualityStreakTrend` is flat → patient is learning to achieve quality more often but not holding longer
- If `longestQualityStreakTrend` is increasing and `qualityEpisodeCountTrend` is flat → patient is getting better at sustained focus, but not recovering as frequently after drift

### Case 2: Exercise Selection

**Scenario:** Recommending the best exercise for this patient.

**Using exercise insights:**
- Patient struggles with sustained focus → choose exercises with high `medianLongestQualityStreak`
- Patient is learning quickly from repeated attempts → choose exercises with high `medianQualityEpisodeCount` (more frequent transitions)

### Case 3: Session-Level Recovery Pattern

**Scenario:** Single-session SubScoresPanel shows:
- `nearBestStableTime: 8.0s`
- `longestQualityStreak: 2.1s`
- (new) `qualityEpisodeCount: 4`

**Interpretation:** Patient had 4 separate quality episodes, with 2.1s being the longest. This is good — it shows the patient was regaining quality repeatedly after losing it. Not one lucky long streak.

---

## Data Dependencies

All new metrics depend on:
- `StateSegment[]` with `metrics.meanDeviation` for each segment
- `nearBestThreshold` (already computed in `computeSessionAggregateMetrics`)
- Existing FSM state classification

No new dependencies on external systems or APIs.

---

## Open Questions for Implementation

1. **Episode break for non-quality segments:** Should a DRIFTING segment with `meanDeviation <= nearBestThreshold` (theoretically possible but rare) break an episode? Current algorithm: no. Confirm this is correct?

2. **Visualization:** What color for `longestQualityStreak` line in ProgressGraphs? Suggest using `THEME.stateNearFusion` or a new "recovery" indicator color (e.g., teal/cyan).

3. **Trend p-value threshold:** Use same `p < 0.05` as existing trends, or different for episode count (which may be sparse/integer)?

4. **Exercise median calculation:** Use existing median function or implement new one? Confirm location of `calculateMedian()` utility if it exists.

---

## Future Enhancements (Beyond Scope)

- **Recovery resilience score:** Composite metric combining streak consistency, episode count variability, and recovery time
- **Episode duration distribution:** Histogram or box plot of individual episode lengths per exercise
- **Recovery time metric:** Average duration between episodes (gap between end of one quality period and start of next)
- **Sustained recovery streak:** Count of consecutive sessions with `qualityEpisodeCount > 1`
