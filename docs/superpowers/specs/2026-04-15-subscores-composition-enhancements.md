# SubScores and Session Composition Enhancements

**Date:** 2026-04-15  
**Status:** Approved Design  
**Scope:** Single session view metrics + multi-session progress graphs

## Overview

Two related enhancements to the session analysis views:
1. Add "Near-Best Stable Time" metric to single session SubScores panel
2. Refactor Session Composition graph to show all 5 state types (currently missing STABLE_DEVIATION and NEAR_FUSION)

## Feature 1: Near-Best Stable Time in SubScores

### What It Represents
The total duration (in seconds) that the session spent in quality states (FUSION, NEAR_FUSION, or STABLE_DEVIATION) that remained within a 10% performance band of the session's best (lowest) mean deviation achieved.

**Formula:**
- best_mean_dev = minimum meanDeviation across all quality segments
- threshold_band = best_mean_dev + 10% × (session_max_dev - best_mean_dev)
- near_best_stable_time = sum of durations of all quality segments where meanDeviation ≤ threshold_band

### Implementation

**File:** `src/components/SubScoresPanel.tsx`

**Changes:**
- Add a new table row after "Longest fusion streak"
- Label: "Near-best stable time"
- Value: `metrics.nearBestStableTime.toFixed(1)}s`
- Conditional display: only show if `metrics.fusionAchieved` is true (similar to fusion streak metrics)

**Data source:** Already computed in `SessionMetrics.nearBestStableTime` via `computeSessionAggregateMetrics()`

---

## Feature 2: Session Composition — All 5 States

### Current Problem
Session Composition graph shows only 3 components:
- `qualityPercent` (complex threshold-based metric, sums FUSION+NEAR_FUSION+STABLE_DEVIATION within band)
- `driftingPercent` (all DRIFTING segments)
- `approachingPercent` (all APPROACHING segments)

These three do not sum to 100%, missing explicit representation of STABLE_DEVIATION and NEAR_FUSION segments outside the quality band.

### Solution
Display all 5 FSM states as independent stacked areas, each representing their percentage of total session duration:

| State | Definition | Color |
|-------|-----------|-------|
| FUSION | metric < threshold | `THEME.stateFusion` |
| NEAR_FUSION | threshold ≤ metric < threshold + 1cm | `THEME.stateNearFusion` |
| STABLE_DEVIATION | metric ≥ threshold + 1cm, no significant slope | `THEME.stateStable` (verify availability) |
| APPROACHING | negative slope detected | `THEME.stateApproaching` |
| DRIFTING | positive slope detected | `THEME.stateDrifting` |

Sum of all five percentages = 100% (by definition, each point in the time series belongs to exactly one state)

### Implementation

**File:** `src/components/ProgressGraphs.tsx`

**Changes:**

1. **Data preparation** (inside `ProgressGraphs` component, in the `graphData` useMemo):
   - For each session, calculate percentages of each state by:
     - Iterating through `session.stateSegments`
     - Summing duration for each state
     - Converting to percentage of `session.sessionDuration`
   
   ```typescript
   const calculateStatePercentages = (session: SessionMetrics) => {
     const stateTimings = {
       FUSION: 0,
       NEAR_FUSION: 0,
       STABLE_DEVIATION: 0,
       APPROACHING: 0,
       DRIFTING: 0,
     };
     
     for (const seg of session.stateSegments) {
       stateTimings[seg.state] += seg.duration;
     }
     
     return {
       fusionPercent: (stateTimings.FUSION / session.sessionDuration) * 100,
       nearFusionPercent: (stateTimings.NEAR_FUSION / session.sessionDuration) * 100,
       stableDeviationPercent: (stateTimings.STABLE_DEVIATION / session.sessionDuration) * 100,
       approachingPercent: (stateTimings.APPROACHING / session.sessionDuration) * 100,
       driftingPercent: (stateTimings.DRIFTING / session.sessionDuration) * 100,
     };
   };
   ```

2. **Data structure** (ProgressGraphsTooltipPayload):
   - Replace `qualityPercent, driftingPercent, approachingPercent` with all 5 state percentages
   - Update SharedTooltip to display all 5 values

3. **Graph areas** (AreaChart in Session Composition section):
   - Replace 3 Area components with 5
   - Stack order (bottom to top): FUSION → NEAR_FUSION → STABLE_DEVIATION → APPROACHING → DRIFTING
   - Colors: use theme colors for each state
   - Update legend names to match state names

---

## Data Flow

### SessionMetrics Enhancement
No changes to `SessionMetrics` type needed; all data already exists:
- `nearBestStableTime` — already present, ready to use
- `stateSegments` — already computed, contains all 5 states with durations

### ProgressGraphs Enhancement
Calculation is local to the component; no changes to data types needed.

---

## Testing Considerations

1. **SubScores:** Verify near-best stable time displays correctly; test edge cases (fusion achieved vs. not achieved)
2. **Session Composition:** 
   - Verify all 5 areas render
   - Check that they sum to 100% (or very close, accounting for floating point)
   - Verify tooltip shows all 5 percentages
   - Test color scheme is applied correctly
   - Test with sessions of varying state composition (edge cases: all FUSION, all DRIFTING, mixed)

---

## Files to Modify

1. `src/components/SubScoresPanel.tsx` — Add row with nearBestStableTime
2. `src/components/ProgressGraphs.tsx` — Calculate and display all 5 states

## Files Not Modified

- `src/types/analysis.ts` — SessionMetrics type unchanged
- `src/utils/sessionMetrics.ts` — No changes to computation logic
- `src/theme.ts` — Use existing color scheme
