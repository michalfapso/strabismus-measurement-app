# Non-Fusion Metrics & Progress Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement metrics computation, insight functions, and multi-session progress visualization UI for non-fusion users.

**Architecture:** Seven-phase implementation: (1) types & constants, (2) metrics computation, (3) insight updates, (4) UI component with zoom/pan, (5) state management, (6) tests, (7) documentation.

**Tech Stack:** TypeScript, React, recharts, emotion

---

## Phase 1: Types & Constants

### Task 1: Update SessionMetrics type and define constants

**Files:**
- Modify: `src/types/analysis.ts`
- Modify: `src/utils/sessionMetrics.ts`

- [ ] **Step 1: Read current SessionMetrics interface**

Run: `cat src/types/analysis.ts | grep -A 30 "interface SessionMetrics"`

Expected: See current interface with `minValue`, fusion fields, etc.

- [ ] **Step 2: Update SessionMetrics interface in analysis.ts**

Replace the interface to add new fields and remove `minValue`:

```typescript
export interface SessionMetrics {
  sessionId: string;
  date: string;
  exerciseTag: string;
  metric: 'deviation' | 'rotation';
  sessionDuration: number;
  histogram: HistogramBin[];

  // Segment-derived metrics (new, always computed)
  bestStableDeviation: number;      // min meanDeviation across quality segments
  nearBestStableTime: number;       // total duration of quality segments (seconds)
  qualityPercent: number;           // % of session in quality segments
  driftingPercent: number;          // % of session in DRIFTING
  approachingPercent: number;       // % of session in APPROACHING

  // Sub-scores (existing, keep)
  timeToFirstFusion: number | null;
  fusionEventCount: number;
  longestFusionStreak: number;
  largeDeviationTimePercent: number;
  trajectoryRatio: number | null;

  // Supporting (existing, keep)
  fusionTime: number;
  fusionTimePercent: number;
  fusionAchieved: boolean;
  nearFusionTime: number;
  nearFusionTimePercent: number;
  largeDeviationTime: number;

  // FSM (existing, keep)
  stateSegments: StateSegment[];
}
```

- [ ] **Step 3: Define constants in sessionMetrics.ts**

Add at the top of the file after existing imports:

```typescript
// Metrics computation constants
const NEAR_BEST_THRESHOLD_BAND_PERCENT = 10;  // band width as % of (max - min) deviation
```

- [ ] **Step 4: Define constant in analysisInsights.ts**

Add at the top of `src/utils/analysisInsights.ts`:

```typescript
const FUSION_RATE_THRESHOLD_PERCENT = 30;  // switch to fusion metrics when fusionRate >= 30%
```

- [ ] **Step 5: Run TypeScript compiler to verify no immediate errors**

Run: `npm run build 2>&1 | head -50`

Expected: Should show type errors related to removed `minValue` in several places (expected, will fix in later tasks)

- [ ] **Step 6: Commit**

```bash
git add src/types/analysis.ts src/utils/sessionMetrics.ts src/utils/analysisInsights.ts
git commit -m "feat: add new segment-derived metrics to SessionMetrics and define constants

- Add bestStableDeviation, nearBestStableTime, qualityPercent, driftingPercent, approachingPercent
- Remove minValue (superseded by bestStableDeviation)
- Define NEAR_BEST_THRESHOLD_BAND_PERCENT (10%)
- Define FUSION_RATE_THRESHOLD_PERCENT (30%)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Metrics Computation

### Task 2: Implement computeSessionAggregateMetrics function

**Files:**
- Modify: `src/utils/sessionMetrics.ts`
- Create: `src/utils/__tests__/sessionMetrics.aggregate.test.ts`

- [ ] **Step 1: Write failing test for computeSessionAggregateMetrics**

Create `src/utils/__tests__/sessionMetrics.aggregate.test.ts`:

```typescript
import { computeSessionAggregateMetrics } from '../sessionMetrics';
import { StateSegment, SegmentMetrics } from '../../types/analysis';
import { TimeSeries } from '../../types';

describe('computeSessionAggregateMetrics', () => {
  it('should compute metrics from segments with quality state in range', () => {
    // Build test segments: FUSION (0.5 cm, 2s) + STABLE_DEVIATION (3 cm, 3s) + DRIFTING (5 cm, 1s)
    const segments: StateSegment[] = [
      {
        state: 'FUSION',
        startTime: 0,
        endTime: 2,
        duration: 2,
        metrics: { meanDeviation: 0.5, medianDeviation: 0.5, minDeviation: 0.4, maxDeviation: 0.6,
                   varianceWithinSegment: 0.01, stdDevWithinSegment: 0.1, intraSegmentSlope: -0.1 },
      },
      {
        state: 'STABLE_DEVIATION',
        startTime: 2,
        endTime: 5,
        duration: 3,
        metrics: { meanDeviation: 3.0, medianDeviation: 3.0, minDeviation: 2.9, maxDeviation: 3.1,
                   varianceWithinSegment: 0.01, stdDevWithinSegment: 0.1, intraSegmentSlope: 0.0 },
      },
      {
        state: 'DRIFTING',
        startTime: 5,
        endTime: 6,
        duration: 1,
        metrics: { meanDeviation: 5.0, medianDeviation: 5.0, minDeviation: 4.5, maxDeviation: 5.5,
                   varianceWithinSegment: 0.1, stdDevWithinSegment: 0.3, intraSegmentSlope: 1.0 },
      },
    ];

    // Build time series with max deviation 5.5
    const timeSeries: TimeSeries[] = [
      { t: 0, x: 0.5, y: 0, r: 0 },
      { t: 1000, x: 0.4, y: 0, r: 0 },
      { t: 2000, x: 3.0, y: 0, r: 0 },
      { t: 5000, x: 5.5, y: 0, r: 0 },
      { t: 6000, x: 5.5, y: 0, r: 0 },
    ];

    const result = computeSessionAggregateMetrics(segments, timeSeries);

    // bestStableDeviation = min(0.5, 3.0) = 0.5
    // sessionMaxDev = 5.5
    // nearBestThreshold = 0.5 + 0.1 * (5.5 - 0.5) = 0.5 + 0.5 = 1.0
    // Quality segments within threshold: FUSION (0.5 <= 1.0) [2s] + STABLE_DEVIATION (3.0 > 1.0) [excluded]
    // nearBestStableTime = 2s
    // qualityPercent = 2 / 6 * 100 = 33.33%
    // driftingPercent = 1 / 6 * 100 = 16.67%
    // approachingPercent = 0 / 6 * 100 = 0%

    expect(result.bestStableDeviation).toBe(0.5);
    expect(result.nearBestStableTime).toBe(2);
    expect(result.qualityPercent).toBeCloseTo(33.33, 1);
    expect(result.driftingPercent).toBeCloseTo(16.67, 1);
    expect(result.approachingPercent).toBeCloseTo(0, 1);
  });

  it('should handle no quality segments by using sessionMaxDeviation as fallback', () => {
    const segments: StateSegment[] = [
      {
        state: 'DRIFTING',
        startTime: 0,
        endTime: 5,
        duration: 5,
        metrics: { meanDeviation: 3.0, medianDeviation: 3.0, minDeviation: 2.5, maxDeviation: 3.5,
                   varianceWithinSegment: 0.1, stdDevWithinSegment: 0.3, intraSegmentSlope: 0.5 },
      },
    ];

    const timeSeries: TimeSeries[] = [
      { t: 0, x: 2.5, y: 0, r: 0 },
      { t: 2500, x: 3.0, y: 0, r: 0 },
      { t: 5000, x: 3.5, y: 0, r: 0 },
    ];

    const result = computeSessionAggregateMetrics(segments, timeSeries);

    // No quality segments → bestStableDeviation = sessionMaxDev = 3.5
    expect(result.bestStableDeviation).toBe(3.5);
    expect(result.nearBestStableTime).toBe(0);
    expect(result.qualityPercent).toBe(0);
    expect(result.driftingPercent).toBeCloseTo(100, 1);
  });

  it('should compute percentages that sum to ~100%', () => {
    const segments: StateSegment[] = [
      {
        state: 'APPROACHING',
        startTime: 0,
        endTime: 2,
        duration: 2,
        metrics: { meanDeviation: 2.0, medianDeviation: 2.0, minDeviation: 1.8, maxDeviation: 2.2,
                   varianceWithinSegment: 0.04, stdDevWithinSegment: 0.2, intraSegmentSlope: -0.5 },
      },
      {
        state: 'FUSION',
        startTime: 2,
        endTime: 5,
        duration: 3,
        metrics: { meanDeviation: 0.5, medianDeviation: 0.5, minDeviation: 0.4, maxDeviation: 0.6,
                   varianceWithinSegment: 0.01, stdDevWithinSegment: 0.1, intraSegmentSlope: 0.0 },
      },
      {
        state: 'DRIFTING',
        startTime: 5,
        endTime: 10,
        duration: 5,
        metrics: { meanDeviation: 4.0, medianDeviation: 4.0, minDeviation: 3.5, maxDeviation: 4.5,
                   varianceWithinSegment: 0.25, stdDevWithinSegment: 0.5, intraSegmentSlope: 1.0 },
      },
    ];

    const timeSeries: TimeSeries[] = Array.from({ length: 11 }, (_, i) => ({
      t: i * 1000,
      x: i < 2 ? 2 - i * 0.1 : (i < 5 ? 0.5 : 4 + (i - 5) * 0.1),
      y: 0,
      r: 0,
    }));

    const result = computeSessionAggregateMetrics(segments, timeSeries);

    const sum = result.qualityPercent + result.driftingPercent + result.approachingPercent;
    expect(sum).toBeCloseTo(100, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/__tests__/sessionMetrics.aggregate.test.ts --no-coverage 2>&1 | tail -30`

Expected: FAIL with "computeSessionAggregateMetrics is not exported from sessionMetrics"

- [ ] **Step 3: Implement computeSessionAggregateMetrics in sessionMetrics.ts**

Add this function before the `calculateSessionMetrics` function:

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

  // 3. Compute threshold using band percent constant
  const nearBestThreshold = bestMeanDev + (NEAR_BEST_THRESHOLD_BAND_PERCENT / 100) * (sessionMaxDev - bestMeanDev);

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

- [ ] **Step 4: Export the function**

Add to the export list at the top of the file where other functions are exported (or add `export` keyword if needed).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/utils/__tests__/sessionMetrics.aggregate.test.ts --no-coverage`

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/utils/sessionMetrics.ts src/utils/__tests__/sessionMetrics.aggregate.test.ts
git commit -m "feat: implement computeSessionAggregateMetrics function

- Computes bestStableDeviation, nearBestStableTime, qualityPercent, driftingPercent, approachingPercent
- Uses NEAR_BEST_THRESHOLD_BAND_PERCENT constant for quality band calculation
- Handles edge case of no quality segments by using sessionMaxDeviation as fallback
- Includes comprehensive unit tests for basic case, edge case, and percent validation

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Task 3: Integrate computeSessionAggregateMetrics into calculateSessionMetrics

**Files:**
- Modify: `src/utils/sessionMetrics.ts`

- [ ] **Step 1: Find calculateSessionMetrics function**

Run: `grep -n "export.*calculateSessionMetrics" src/utils/sessionMetrics.ts`

Expected: Line number of the function

- [ ] **Step 2: Locate where stateSegments is computed**

Read the function to find where `classifyStates()` is called and where the return object is created.

- [ ] **Step 3: Add call to computeSessionAggregateMetrics after classification**

In `calculateSessionMetrics`, after `stateSegments` is created but before returning `SessionMetrics`, add:

```typescript
// Compute session-level aggregate metrics from segments
const aggregateMetrics = computeSessionAggregateMetrics(stateSegments, timeSeries);
```

- [ ] **Step 4: Merge aggregateMetrics into returned object**

Modify the return statement to include the new metrics:

```typescript
return {
  // ... existing fields ...
  stateSegments,

  // Add new metrics
  bestStableDeviation: aggregateMetrics.bestStableDeviation,
  nearBestStableTime: aggregateMetrics.nearBestStableTime,
  qualityPercent: aggregateMetrics.qualityPercent,
  driftingPercent: aggregateMetrics.driftingPercent,
  approachingPercent: aggregateMetrics.approachingPercent,
};
```

- [ ] **Step 5: Run existing sessionMetrics tests**

Run: `npm test -- src/utils/__tests__/sessionMetrics.test.ts --no-coverage 2>&1 | tail -20`

Expected: All existing tests still pass (no breaking changes to interface yet, since we're only adding fields)

- [ ] **Step 6: Run TypeScript compiler**

Run: `npm run build 2>&1 | head -20`

Expected: Should still see errors related to removed `minValue`, but no new errors from the integration

- [ ] **Step 7: Commit**

```bash
git add src/utils/sessionMetrics.ts
git commit -m "feat: integrate computeSessionAggregateMetrics into calculateSessionMetrics

- Call computeSessionAggregateMetrics after classifyStates
- Merge results into returned SessionMetrics object
- New metrics now available in all session calculations

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Insight Function Updates

### Task 4: Update ProgressInsight type and calculateProgressInsight function

**Files:**
- Modify: `src/types/analysis.ts`
- Modify: `src/utils/analysisInsights.ts`

- [ ] **Step 1: Define TrendInfo helper type**

Add to `src/types/analysis.ts` before `ProgressInsight`:

```typescript
export interface TrendInfo {
  slope: number;
  direction: 'improving' | 'declining' | 'stable';
  significance: { p: number; significant: boolean };
}
```

- [ ] **Step 2: Update ProgressInsight interface**

Replace the entire interface in `src/types/analysis.ts`:

```typescript
export interface ProgressInsight {
  metric: 'deviation' | 'rotation';
  fusionAchievedRate: number;  // % of sessions where fusion was achieved
  fusionAchievedCount: number;
  totalSessions: number;
  aggregateHistogram: HistogramBin[];

  // Segment-derived trends (always computed, all users)
  bestStableDeviationTrend: TrendInfo;
  nearBestStableTimeTrend: TrendInfo;
  qualityPercentTrend: TrendInfo;

  // Fusion trends (only present if fusionAchievedRate >= FUSION_RATE_THRESHOLD_PERCENT)
  fusionStreakTrend?: TrendInfo;
  fusionEventCountTrend?: TrendInfo;
}
```

- [ ] **Step 3: Rewrite calculateProgressInsight**

Replace the function in `src/utils/analysisInsights.ts`:

```typescript
export function calculateProgressInsight(
  metrics: SessionMetrics[],
  thresholds: { deviation: number; rotation: number }
): ProgressInsight {
  const metric = metrics[0]?.metric || 'deviation';
  const threshold = metric === 'deviation' ? thresholds.deviation : thresholds.rotation;

  // Sort by date for time-series
  const sorted = [...metrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Compute fusion rate
  const fusionAchievedCount = sorted.filter(m => m.fusionAchieved).length;
  const fusionAchievedRate = (fusionAchievedCount / sorted.length) * 100;

  // Segment-derived trends (always computed)
  // bestStableDeviation trend
  const bestStableDevPoints: [number, number][] = sorted.map((m, i) => [i, m.bestStableDeviation]);
  const bestStableDevSlope = linearRegressionSlope(bestStableDevPoints) / (sorted.length / 52);
  const bestStableDevP = regressionPValue(bestStableDevPoints);

  // nearBestStableTime trend
  const nearBestTimePoints: [number, number][] = sorted.map((m, i) => [i, m.nearBestStableTime]);
  const nearBestTimeSlope = linearRegressionSlope(nearBestTimePoints) / (sorted.length / 52);
  const nearBestTimeP = regressionPValue(nearBestTimePoints);

  // qualityPercent trend
  const qualityPercentPoints: [number, number][] = sorted.map((m, i) => [i, m.qualityPercent]);
  const qualityPercentSlope = linearRegressionSlope(qualityPercentPoints) / (sorted.length / 52);
  const qualityPercentP = regressionPValue(qualityPercentPoints);

  // Aggregate histogram
  const aggregateHistogram = sorted[0]?.histogram || [];

  const progressInsight: ProgressInsight = {
    metric,
    fusionAchievedRate,
    fusionAchievedCount,
    totalSessions: sorted.length,
    aggregateHistogram,
    bestStableDeviationTrend: {
      slope: bestStableDevSlope,
      direction: trendDirection(bestStableDevSlope, bestStableDevP, 'stream'),
      significance: { p: bestStableDevP, significant: bestStableDevP < 0.05 },
    },
    nearBestStableTimeTrend: {
      slope: nearBestTimeSlope,
      direction: trendDirection(nearBestTimeSlope, nearBestTimeP, 'stream'),
      significance: { p: nearBestTimeP, significant: nearBestTimeP < 0.05 },
    },
    qualityPercentTrend: {
      slope: qualityPercentSlope,
      direction: trendDirection(qualityPercentSlope, qualityPercentP, 'stream'),
      significance: { p: qualityPercentP, significant: qualityPercentP < 0.05 },
    },
  };

  // Fusion trends (only if fusionAchievedRate >= threshold)
  if (fusionAchievedRate >= FUSION_RATE_THRESHOLD_PERCENT) {
    const streakPoints: [number, number][] = sorted.map((m, i) => [i, m.longestFusionStreak]);
    const streakSlope = linearRegressionSlope(streakPoints) / (sorted.length / 52);
    const streakP = regressionPValue(streakPoints);

    const eventPoints: [number, number][] = sorted.map((m, i) => [i, m.fusionEventCount]);
    const eventSlope = linearRegressionSlope(eventPoints) / (sorted.length / 52);
    const eventP = regressionPValue(eventPoints);

    progressInsight.fusionStreakTrend = {
      slope: streakSlope,
      direction: trendDirection(streakSlope, streakP, 'streak'),
      significance: { p: streakP, significant: streakP < 0.05 },
    };
    progressInsight.fusionEventCountTrend = {
      slope: eventSlope,
      direction: trendDirection(eventSlope, eventP, 'stream'),
      significance: { p: eventP, significant: eventP < 0.05 },
    };
  }

  return progressInsight;
}
```

- [ ] **Step 4: Update ExerciseInsight interface**

Add new fields to `src/types/analysis.ts`:

```typescript
export interface ExerciseInsight {
  exerciseTag: string;
  metric: 'deviation' | 'rotation';
  sessionCount: number;
  medianLongestStreak: number;
  medianFusionEventCount: number;
  // NEW FIELDS:
  medianBestStableDeviation: number;
  medianNearBestStableTime: number;
  fusionAchievedRate: number;
  trendDirection: 'improving' | 'declining' | 'stable';
  trendSlope: number;
  improvementRate?: number;
}
```

- [ ] **Step 5: Update calculateExerciseInsights to compute new fields**

In `src/utils/analysisInsights.ts`, modify the function to add:

```typescript
const medianBestStableDeviation = median(sorted.map(m => m.bestStableDeviation));
const medianNearBestStableTime = median(sorted.map(m => m.nearBestStableTime));
```

And include these in the returned object for each exercise.

- [ ] **Step 6: Run TypeScript compiler**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -20`

Expected: Errors only related to `minValue` removal, not new fields

- [ ] **Step 7: Commit**

```bash
git add src/types/analysis.ts src/utils/analysisInsights.ts
git commit -m "feat: update ProgressInsight and calculateProgressInsight for segment metrics

- Add TrendInfo helper type
- Update ProgressInsight: always compute bestStableDeviation, nearBestStableTime, qualityPercent trends
- Fusion trends only when fusionAchievedRate >= 30%
- Remove minValueTrend (minValue is deleted)
- Update ExerciseInsight with medianBestStableDeviation and medianNearBestStableTime
- Update calculateExerciseInsights to compute new median fields

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Task 5: Update calculateSessionQualityInsight

**Files:**
- Modify: `src/utils/analysisInsights.ts`

- [ ] **Step 1: Find calculateSessionQualityInsight function**

Run: `grep -n "calculateSessionQualityInsight" src/utils/analysisInsights.ts | head -1`

- [ ] **Step 2: Understand current implementation**

Read the function to see how it currently uses `minValue` as fallback.

- [ ] **Step 3: Update to use bestStableDeviation**

Replace outlier detection logic to always use `bestStableDeviation`:

```typescript
export function calculateSessionQualityInsight(
  metrics: SessionMetrics[]
): SessionQualityInsight {
  if (metrics.length === 0) {
    return {
      metric: 'deviation',
      outliers: [],
      variability: { level: 'low', streakRange: { min: 0, max: 0 } },
    };
  }

  const metric = metrics[0].metric;
  const bestStableDevValues = metrics.map(m => m.bestStableDeviation);

  const outlierMean = mean(bestStableDevValues);
  const outlierStd = stdDev(bestStableDevValues);

  const outliers = metrics
    .map(m => {
      const z = computeZScore(m.bestStableDeviation, outlierMean, outlierStd);
      return { m, z };
    })
    .filter(({ z }) => Math.abs(z) > 2)
    .map(({ m, z }) => ({
      sessionId: m.sessionId,
      date: m.date,
      exerciseTag: m.exerciseTag,
      longestFusionStreak: m.longestFusionStreak,
      fusionEventCount: m.fusionEventCount,
      bestStableDeviation: m.bestStableDeviation,  // Changed from minValue
      zScore: z,
      direction: z > 0 ? ('unusually_good' as const) : ('unusually_poor' as const),
    }));

  const streakRange = {
    min: Math.min(...bestStableDevValues),
    max: Math.max(...bestStableDevValues)
  };
  const streakSpread = streakRange.max - streakRange.min;
  const variability: 'low' | 'moderate' | 'high' =
    streakSpread < 5 ? 'low' : streakSpread < 20 ? 'moderate' : 'high';

  return {
    metric,
    outliers,
    variability: { level: variability, streakRange },
  };
}
```

- [ ] **Step 4: Update SessionQualityInsight type if needed**

Check if the interface needs to replace `minValue` with `bestStableDeviation`. Update in `src/types/analysis.ts`:

```typescript
export interface SessionQualityInsight {
  metric: 'deviation' | 'rotation';
  outliers: Array<{
    sessionId: string;
    date: string;
    exerciseTag: string;
    longestFusionStreak: number;
    fusionEventCount: number;
    bestStableDeviation: number;  // Changed from minValue
    zScore: number;
    direction: 'unusually_good' | 'unusually_poor';
  }>;
  variability: {
    level: 'low' | 'moderate' | 'high';
    streakRange: { min: number; max: number };
  };
  consistencyScore?: number;
}
```

- [ ] **Step 5: Run TypeScript compiler**

Run: `npm run build 2>&1 | grep -E "error" | head -10`

Expected: No new errors related to SessionQualityInsight

- [ ] **Step 6: Commit**

```bash
git add src/utils/analysisInsights.ts src/types/analysis.ts
git commit -m "feat: update calculateSessionQualityInsight to use bestStableDeviation

- Replace minValue with bestStableDeviation for outlier detection
- Use bestStableDeviation for all users unconditionally
- Remove fusionRate branching logic (no longer needed)
- Update SessionQualityInsight type to use bestStableDeviation in outlier objects

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Task 6: Update calculateMilestoneInsight

**Files:**
- Modify: `src/utils/analysisInsights.ts`
- Modify: `src/types/analysis.ts`

- [ ] **Step 1: Find calculateMilestoneInsight function**

Run: `grep -n "calculateMilestoneInsight" src/utils/analysisInsights.ts | head -1`

- [ ] **Step 2: Update MilestoneInsight type**

In `src/types/analysis.ts`, add new indicator type to the readiness indicators:

```typescript
export type ReadinessIndicatorType =
  | 'sustained_fusion'
  | 'min_value_approaching_threshold'
  | 'best_stable_level_approaching';  // NEW
```

And update the interface:

```typescript
export interface MilestoneInsight {
  metric: 'deviation' | 'rotation';
  sustainedFusionEvents: Array<{
    startDate: string;
    endDate: string;
    durationDays: number;
  }>;
  minValueProgress: {
    startValue: number;
    currentValue: number;
    targetThreshold: number;
    progressPercent: number;
  };
  bestStableDeviationProgress?: {  // NEW
    startValue: number;
    currentValue: number;
    targetThreshold: number;
    progressPercent: number;
  };
  readinessIndicators: Array<{
    type: ReadinessIndicatorType;
    value: number;
    met: boolean;
  }>;
}
```

- [ ] **Step 3: Update calculateMilestoneInsight function**

Add computation for best stable deviation progress:

```typescript
// After computing minValueProgress, add:
let bestStableDeviationProgress: typeof milestoneInsight.bestStableDeviationProgress | undefined;
if (startValue > threshold) {  // only compute if user is not already at threshold
  const bestStableDevStart = sorted[0]?.bestStableDeviation || startValue;
  const bestStableDevCurrent = sorted[sorted.length - 1]?.bestStableDeviation || startValue;
  const bestStableDevChange = (bestStableDevStart - bestStableDevCurrent) / (bestStableDevStart - threshold) * 100;

  bestStableDeviationProgress = {
    startValue: bestStableDevStart,
    currentValue: bestStableDevCurrent,
    targetThreshold: threshold,
    progressPercent: Math.max(0, Math.min(100, bestStableDevChange)),
  };
}
```

And add to readiness indicators:

```typescript
{
  type: 'best_stable_level_approaching' as const,
  value: bestStableDeviationProgress?.progressPercent || 0,
  met: (bestStableDeviationProgress?.progressPercent || 0) > 50,
},
```

- [ ] **Step 4: Run TypeScript compiler**

Run: `npm run build 2>&1 | grep -E "error" | head -10`

Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/utils/analysisInsights.ts src/types/analysis.ts
git commit -m "feat: add best stable level progress to calculateMilestoneInsight

- Add bestStableDeviationProgress computation
- Track progress from start to current best stable deviation vs target threshold
- Add 'best_stable_level_approaching' readiness indicator
- Update MilestoneInsight and ReadinessIndicatorType

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: UI Component

### Task 7: Create ProgressGraphs component scaffold

**Files:**
- Create: `src/components/ProgressGraphs.tsx`

- [ ] **Step 1: Create scaffold with prop types**

Create `src/components/ProgressGraphs.tsx`:

```typescript
import React, { useState, useMemo } from 'react';
import { SessionMetrics } from '../types/analysis';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { css } from '@emotion/react';

interface ProgressGraphsProps {
  sessions: SessionMetrics[];
  onDrillDown?: (sessionId: string) => void;
  exerciseFilter?: string;
}

/**
 * ProgressGraphs: Three stacked graphs showing progression over multiple sessions
 * - Graph 1: bestStableDeviation (cm)
 * - Graph 2: nearBestStableTime (seconds)
 * - Graph 3: qualityPercent + driftingPercent + approachingPercent (%)
 */
export function ProgressGraphs({ sessions, onDrillDown, exerciseFilter }: ProgressGraphsProps) {
  const [zoomStart, setZoomStart] = useState(0);
  const [zoomEnd, setZoomEnd] = useState(sessions.length);

  // Filter sessions by exercise if needed
  const filteredSessions = useMemo(() => {
    if (!exerciseFilter) return sessions;
    return sessions.filter(s => s.exerciseTag === exerciseFilter);
  }, [sessions, exerciseFilter]);

  // Prepare data for graphs: sort by date, add session indices, prepare for recharts
  const graphData = useMemo(() => {
    const sorted = [...filteredSessions].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return sorted.map((session, index) => ({
      sessionIndex: index,
      sessionId: session.sessionId,
      date: session.date,
      exerciseTag: session.exerciseTag,
      bestStableDeviation: session.bestStableDeviation,
      nearBestStableTime: session.nearBestStableTime,
      qualityPercent: session.qualityPercent,
      driftingPercent: session.driftingPercent,
      approachingPercent: session.approachingPercent,
    }));
  }, [filteredSessions]);

  if (graphData.length === 0) {
    return <div>No sessions to display</div>;
  }

  return (
    <div css={styles.container}>
      <div css={styles.graphContainer}>
        <h3>Best Stable Deviation (cm)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={graphData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sessionIndex" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="bestStableDeviation"
              stroke="#8884d8"
              onClick={(data) => onDrillDown?.(data.payload.sessionId)}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div css={styles.graphContainer}>
        <h3>Near-Best Stable Time (seconds)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={graphData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sessionIndex" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="nearBestStableTime"
              stroke="#82ca9d"
              onClick={(data) => onDrillDown?.(data.payload.sessionId)}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div css={styles.graphContainer}>
        <h3>Session Composition (%)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={graphData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sessionIndex" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="qualityPercent" stackId="1" stroke="#8884d8" fill="#8884d8" />
            <Area type="monotone" dataKey="driftingPercent" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
            <Area type="monotone" dataKey="approachingPercent" stackId="1" stroke="#ffc658" fill="#ffc658" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const styles = {
  container: css`
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  `,
  graphContainer: css`
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 12px;
  `,
};
```

- [ ] **Step 2: Run TypeScript compiler**

Run: `npm run build 2>&1 | grep -E "error" | head -10`

Expected: Should compile without errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat: create ProgressGraphs component scaffold

- Three stacked graphs: bestStableDeviation, nearBestStableTime, composition
- Basic recharts LineChart and AreaChart integration
- Session filtering by exercise tag
- Simple styling with emotion
- TODO: Add shared tooltip, zoom/pan, datetime labels, mobile responsiveness

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Task 8: Add shared tooltip and improve labels

**Files:**
- Modify: `src/components/ProgressGraphs.tsx`

- [ ] **Step 1: Create shared tooltip component**

Add before the ProgressGraphs function:

```typescript
interface SharedTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: any;
}

function SharedTooltip({ active, payload }: SharedTooltipProps) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div css={styles.tooltip}>
        <p><strong>{data.date}</strong></p>
        <p>Exercise: {data.exerciseTag}</p>
        <p>Session #{data.sessionIndex + 1}</p>
        <hr />
        <p>Best Stable Deviation: {data.bestStableDeviation.toFixed(2)} cm</p>
        <p>Near-Best Stable Time: {data.nearBestStableTime.toFixed(1)}s</p>
        <p>Quality: {data.qualityPercent.toFixed(1)}%</p>
        <p>Drifting: {data.driftingPercent.toFixed(1)}%</p>
        <p>Approaching: {data.approachingPercent.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
}
```

- [ ] **Step 2: Update Graph 1 to use shared tooltip and format labels**

Replace Graph 1 LineChart:

```typescript
<ResponsiveContainer width="100%" height={250}>
  <LineChart data={graphData} margin={{ right: 30, left: 0, bottom: 60, top: 10 }}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis
      dataKey="sessionIndex"
      label={{ value: 'Session Index', position: 'insideBottomRight', offset: -10 }}
    />
    <YAxis label={{ value: 'Deviation (cm)', angle: -90, position: 'insideLeft' }} />
    <Tooltip content={<SharedTooltip />} />
    <Legend />
    <Line
      type="monotone"
      dataKey="bestStableDeviation"
      stroke="#8884d8"
      name="Best Stable Deviation"
      isAnimationActive={false}
      onClick={(data) => {
        if (data && data.payload && data.payload.sessionId) {
          onDrillDown?.(data.payload.sessionId);
        }
      }}
    />
  </LineChart>
</ResponsiveContainer>
```

- [ ] **Step 3: Update Graph 2 similarly**

Replace Graph 2 LineChart with similar structure, using `nearBestStableTime` dataKey and appropriate labels.

- [ ] **Step 4: Update Graph 3 (composition) with shared tooltip and proper labels**

Replace Graph 3 AreaChart with shared tooltip and legend for the three areas.

- [ ] **Step 5: Add tooltip and legend styling**

Add to styles object:

```typescript
tooltip: css`
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;

  p {
    margin: 4px 0;
  }

  hr {
    margin: 4px 0;
    border: none;
    border-top: 1px solid #ddd;
  }
`,
```

- [ ] **Step 6: Run build and test**

Run: `npm run build && npm test -- src/components/ProgressGraphs 2>&1 | head -20`

Expected: No build errors, component renders without crashing

- [ ] **Step 7: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat: add shared tooltip and improve axis labels in ProgressGraphs

- Create SharedTooltip component showing all metrics for hovered point
- Update all three graphs to use shared tooltip
- Add axis labels with proper positioning
- Add session date, exercise tag, and session index to tooltip
- Improve legend visibility

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Task 9: Add zoom and pan functionality

**Files:**
- Modify: `src/components/ProgressGraphs.tsx`

- [ ] **Step 1: Add state for zoom and pan**

Update component state:

```typescript
const [zoomRange, setZoomRange] = useState({ start: 0, end: Math.min(20, graphData.length) });
```

- [ ] **Step 2: Create custom hook for synchronized zoom**

Add before ProgressGraphs component:

```typescript
function useZoomPan(dataLength: number) {
  const [zoomStart, setZoomStart] = useState(0);
  const [zoomEnd, setZoomEnd] = useState(Math.min(20, dataLength));

  const handleZoom = (factor: number) => {
    const center = (zoomStart + zoomEnd) / 2;
    const span = zoomEnd - zoomStart;
    const newSpan = Math.max(2, span / factor);
    const newStart = Math.max(0, Math.floor(center - newSpan / 2));
    const newEnd = Math.min(dataLength, Math.ceil(newStart + newSpan));
    setZoomStart(newStart);
    setZoomEnd(newEnd);
  };

  const handlePan = (direction: 'left' | 'right') => {
    const span = zoomEnd - zoomStart;
    const shift = Math.floor(span * 0.2);
    if (direction === 'left') {
      const newStart = Math.max(0, zoomStart - shift);
      const newEnd = Math.min(dataLength, newStart + span);
      setZoomStart(newStart);
      setZoomEnd(newEnd);
    } else {
      const newEnd = Math.min(dataLength, zoomEnd + shift);
      const newStart = Math.max(0, newEnd - span);
      setZoomStart(newStart);
      setZoomEnd(newEnd);
    }
  };

  return { zoomStart, zoomEnd, handleZoom, handlePan };
}
```

- [ ] **Step 3: Integrate zoom hook into ProgressGraphs**

Add to component:

```typescript
const { zoomStart, zoomEnd, handleZoom, handlePan } = useZoomPan(graphData.length);

// Filter data based on zoom
const visibleData = useMemo(() => {
  return graphData.slice(Math.floor(zoomStart), Math.ceil(zoomEnd));
}, [graphData, zoomStart, zoomEnd]);
```

- [ ] **Step 4: Add zoom controls**

Add UI controls above the graphs:

```typescript
<div css={styles.controls}>
  <button onClick={() => handlePan('left')}>← Pan Left</button>
  <button onClick={() => handleZoom(1.2)}>🔍- Zoom Out</button>
  <button onClick={() => handleZoom(0.8)}>🔍+ Zoom In</button>
  <button onClick={() => handlePan('right')}>Pan Right →</button>
  <span css={styles.zoomInfo}>
    Showing sessions {Math.floor(zoomStart) + 1} - {Math.ceil(zoomEnd)} of {graphData.length}
  </span>
</div>
```

- [ ] **Step 5: Update graphs to use visibleData**

Replace all three LineChart and AreaChart `data` props to use `visibleData` instead of `graphData`.

- [ ] **Step 6: Add styles for controls**

Add to styles object:

```typescript
controls: css`
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
  flex-wrap: wrap;

  button {
    padding: 6px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;

    &:hover {
      background: #f5f5f5;
    }
  }
`,
zoomInfo: css`
  font-size: 12px;
  color: #666;
  margin-left: auto;
`,
```

- [ ] **Step 7: Run build**

Run: `npm run build 2>&1 | grep -E "error" | head -10`

Expected: No build errors

- [ ] **Step 8: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat: add zoom and pan controls to ProgressGraphs

- Create useZoomPan hook for synchronized zoom across all graphs
- Add pan left/right buttons (20% of visible range per click)
- Add zoom in/out buttons (1.2x / 0.8x factor)
- Display current zoom range (session X of Y)
- Filter displayed data based on zoom range
- All three graphs update together

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Task 10: Add datetime labels and mobile responsiveness

**Files:**
- Modify: `src/components/ProgressGraphs.tsx`

- [ ] **Step 1: Create datetime label formatter**

Add helper function:

```typescript
function formatDatetimeLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return dateStr;
  }
}
```

- [ ] **Step 2: Update X-axis to show datetime labels**

Modify all three graphs to use custom X-axis with datetime labels. Add a new custom XAxis component or use tickFormatter:

```typescript
<XAxis
  dataKey="sessionIndex"
  label={{ value: 'Session Index', position: 'insideBottomRight', offset: -10 }}
  tickFormatter={(index) => {
    if (visibleData && visibleData[index]) {
      return formatDatetimeLabel(visibleData[index].date);
    }
    return index.toString();
  }}
  angle={-45}
  textAnchor="end"
  height={80}
/>
```

- [ ] **Step 3: Add mobile responsiveness**

Wrap graphs in container with media queries. Update container style:

```typescript
container: css`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;

  @media (max-width: 768px) {
    padding: 12px;
    gap: 12px;
  }
`,
```

And graph containers:

```typescript
graphContainer: css`
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;

  @media (max-width: 768px) {
    padding: 8px;

    h3 {
      font-size: 14px;
      margin: 4px 0 8px 0;
    }
  }
`,
```

- [ ] **Step 4: Make controls responsive**

Update controls styling:

```typescript
controls: css`
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: 4px;

    button {
      padding: 4px 8px;
      font-size: 12px;
    }
  }

  button {
    padding: 6px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;

    &:hover {
      background: #f5f5f5;
    }
  }
`,
```

- [ ] **Step 5: Reduce graph heights on mobile**

Update ResponsiveContainer heights based on screen size:

```typescript
const graphHeight = window.innerWidth < 768 ? 180 : 250;

// Then use graphHeight in all ResponsiveContainer height props
<ResponsiveContainer width="100%" height={graphHeight}>
```

- [ ] **Step 6: Run build and test**

Run: `npm run build 2>&1 | grep -E "error"`

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat: add datetime labels and mobile responsiveness to ProgressGraphs

- Format X-axis tick labels as datetime (YYYY-MM-DD hh:mm:ss)
- Angle labels 45 degrees for better readability
- Add media queries for mobile (<768px): smaller padding, fonts, heights
- Reduce graph heights on mobile (180px vs 250px on desktop)
- Make controls responsive with font size and padding adjustments
- Responsive graph containers and spacing

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Task 11: Add touch gestures for pinch-zoom

**Files:**
- Modify: `src/components/ProgressGraphs.tsx`

- [ ] **Step 1: Add touch event handlers**

Add new hook for touch pinch-zoom:

```typescript
function useTouchZoom(onZoom: (factor: number) => void) {
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchStart(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStart !== null) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = touchStart / distance;
      if (factor > 0.9 && factor < 1.1) {
        onZoom(factor);
      }
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
  };

  return { handleTouchStart, handleTouchMove, handleTouchEnd };
}
```

- [ ] **Step 2: Integrate touch handler into ProgressGraphs**

Add to component:

```typescript
const touchHandlers = useTouchZoom((factor) => {
  handleZoom(factor > 1 ? 0.9 : 1.1);
});
```

And attach to main container:

```typescript
<div
  css={styles.container}
  onTouchStart={touchHandlers.handleTouchStart}
  onTouchMove={touchHandlers.handleTouchMove}
  onTouchEnd={touchHandlers.handleTouchEnd}
>
```

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | grep -E "error"`

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat: add touch pinch-zoom gesture support

- Create useTouchZoom hook for touch gesture detection
- Detect two-finger pinch and convert to zoom factor
- Integrate into main container for mobile users
- Zoom in/out based on pinch distance ratio

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: State Management & Integration

### Task 12: Create useSessionAnalysisState hook for URL persistence

**Files:**
- Create: `src/hooks/useSessionAnalysisState.ts`

- [ ] **Step 1: Create hook scaffold**

Create `src/hooks/useSessionAnalysisState.ts`:

```typescript
import { useEffect, useState } from 'react';

export interface SessionAnalysisState {
  selectedSessionIds: string[];
  exerciseFilter?: string;
  zoomStart: number;
  zoomEnd: number;
  drilledDownSessionId?: string;
}

export function useSessionAnalysisState() {
  const [state, setState] = useState<SessionAnalysisState>(() => parseUrlState());

  // Parse state from URL on mount
  function parseUrlState(): SessionAnalysisState {
    if (typeof window === 'undefined') {
      return { selectedSessionIds: [], zoomStart: 0, zoomEnd: 20 };
    }

    const params = new URLSearchParams(window.location.search);
    const sessionIds = params.get('sessions')?.split(',').filter(id => id.length > 0) || [];
    const exerciseFilter = params.get('exercise') || undefined;
    const zoomStart = parseInt(params.get('zoomStart') || '0');
    const zoomEnd = parseInt(params.get('zoomEnd') || '20');
    const drilledDownSessionId = params.get('detail') || undefined;

    return { selectedSessionIds: sessionIds, exerciseFilter, zoomStart, zoomEnd, drilledDownSessionId };
  }

  // Update URL whenever state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams();
    if (state.selectedSessionIds.length > 0) {
      params.set('sessions', state.selectedSessionIds.join(','));
    }
    if (state.exerciseFilter) {
      params.set('exercise', state.exerciseFilter);
    }
    params.set('zoomStart', state.zoomStart.toString());
    params.set('zoomEnd', state.zoomEnd.toString());
    if (state.drilledDownSessionId) {
      params.set('detail', state.drilledDownSessionId);
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [state]);

  return { state, setState };
}
```

- [ ] **Step 2: Run TypeScript compiler**

Run: `npm run build 2>&1 | grep -E "error"`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSessionAnalysisState.ts
git commit -m "feat: create useSessionAnalysisState hook for URL persistence

- Parse state from URL params (sessions, exercise, zoomStart, zoomEnd, detail)
- Synchronize state changes back to URL
- Enable bookmarking and sharing of analysis views
- Browser back-button support via URL history

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Task 13: Integrate ProgressGraphs into AggregateResultsPanel

**Files:**
- Modify: `src/components/AggregateResultsPanel.tsx` or equivalent analysis panel

- [ ] **Step 1: Find the analysis panel component**

Run: `find src/components -name "*Aggregate*" -o -name "*Analysis*" | grep -v test`

Expected: Find the component that shows multi-session analysis

- [ ] **Step 2: Read current component to understand structure**

Read the file to understand how it's currently structured.

- [ ] **Step 3: Add ProgressGraphs to the component**

Import and add ProgressGraphs:

```typescript
import { ProgressGraphs } from './ProgressGraphs';
import { useSessionAnalysisState } from '../hooks/useSessionAnalysisState';

export function AggregateResultsPanel({ sessions }: { sessions: SessionMetrics[] }) {
  const { state, setState } = useSessionAnalysisState();

  const handleDrillDown = (sessionId: string) => {
    setState({ ...state, drilledDownSessionId: sessionId });
  };

  const handleZoomChange = (zoomStart: number, zoomEnd: number) => {
    setState({ ...state, zoomStart, zoomEnd });
  };

  const handleExerciseFilterChange = (exerciseFilter?: string) => {
    setState({ ...state, exerciseFilter });
  };

  if (state.drilledDownSessionId) {
    return <UnifiedSessionPanel sessionId={state.drilledDownSessionId} onBack={() => setState({ ...state, drilledDownSessionId: undefined })} />;
  }

  return (
    <div>
      {/* Existing content */}

      <h2>Progress Over Time</h2>
      <ProgressGraphs
        sessions={sessions}
        onDrillDown={handleDrillDown}
        exerciseFilter={state.exerciseFilter}
      />

      {/* Rest of existing content */}
    </div>
  );
}
```

- [ ] **Step 4: Add back button to UnifiedSessionPanel**

In `src/components/UnifiedSessionPanel.tsx`, add a back button:

```typescript
export function UnifiedSessionPanel({ sessionId, onBack }: { sessionId: string; onBack?: () => void }) {
  return (
    <div>
      {onBack && (
        <button onClick={onBack} css={styles.backButton}>
          ← Back to Analysis
        </button>
      )}
      {/* Rest of component */}
    </div>
  );
}
```

- [ ] **Step 5: Run build**

Run: `npm run build 2>&1 | grep -E "error" | head -20`

Expected: No new errors (may have existing ones from incomplete refactoring, which is fine)

- [ ] **Step 6: Commit**

```bash
git add src/components/AggregateResultsPanel.tsx src/components/UnifiedSessionPanel.tsx src/hooks/useSessionAnalysisState.ts
git commit -m "feat: integrate ProgressGraphs into AggregateResultsPanel

- Add ProgressGraphs component to multi-session analysis view
- Wire zoom and exercise filter state through useSessionAnalysisState hook
- Add drill-down support: click graph → single-session detail view
- Add back button to UnifiedSessionPanel for returning to analysis
- Preserve state across drill-down via URL

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Phase 6: Tests

### Task 14: Add unit tests for computeSessionAggregateMetrics edge cases

**Files:**
- Modify: `src/utils/__tests__/sessionMetrics.aggregate.test.ts`

- [ ] **Step 1: Add edge case tests**

Add to the test file:

```typescript
it('should handle empty timeSeries', () => {
  const segments: StateSegment[] = [];
  const timeSeries: TimeSeries[] = [];

  const result = computeSessionAggregateMetrics(segments, timeSeries);

  expect(result.bestStableDeviation).toBe(0);
  expect(result.nearBestStableTime).toBe(0);
  expect(result.qualityPercent).toBeNaN();  // 0 / 1 * 100 = 0, but division by zero if we use 0
});

it('should handle single-point timeSeries', () => {
  const segments: StateSegment[] = [
    {
      state: 'STABLE_DEVIATION',
      startTime: 0,
      endTime: 0,
      duration: 0,
      metrics: { meanDeviation: 1.0, /* ... */ },
    },
  ];

  const timeSeries: TimeSeries[] = [{ t: 0, x: 1.0, y: 0, r: 0 }];

  const result = computeSessionAggregateMetrics(segments, timeSeries);

  expect(result.bestStableDeviation).toBe(1.0);
  expect(result.qualityPercent).toBeCloseTo(0, 1);  // 0 duration
});

it('should prioritize FUSION over STABLE_DEVIATION in quality band', () => {
  const segments: StateSegment[] = [
    {
      state: 'STABLE_DEVIATION',
      startTime: 0,
      endTime: 5,
      duration: 5,
      metrics: { meanDeviation: 2.0, /* ... */ },
    },
    {
      state: 'FUSION',
      startTime: 5,
      endTime: 7,
      duration: 2,
      metrics: { meanDeviation: 0.3, /* ... */ },
    },
  ];

  const timeSeries: TimeSeries[] = [
    { t: 0, x: 2.0, y: 0, r: 0 },
    { t: 7000, x: 5.0, y: 0, r: 0 },
  ];

  const result = computeSessionAggregateMetrics(segments, timeSeries);

  // bestStableDeviation should be min(2.0, 0.3) = 0.3
  expect(result.bestStableDeviation).toBe(0.3);
  // nearBestThreshold = 0.3 + 0.1 * (5.0 - 0.3) = 0.3 + 0.47 = 0.77
  // Only FUSION (0.3) qualifies
  expect(result.nearBestStableTime).toBe(2);
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- src/utils/__tests__/sessionMetrics.aggregate.test.ts --no-coverage`

Expected: All tests pass (5 total: 3 original + 2 new edge cases)

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/sessionMetrics.aggregate.test.ts
git commit -m "test: add edge case tests for computeSessionAggregateMetrics

- Empty timeSeries case
- Single-point timeSeries
- FUSION prioritization in quality band
- All tests passing

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Task 15: Add unit tests for updated insight functions

**Files:**
- Modify: `src/utils/__tests__/analysisInsights.test.ts`

- [ ] **Step 1: Write test for calculateProgressInsight with segment metrics**

Add to test file:

```typescript
describe('calculateProgressInsight with segment metrics', () => {
  it('should compute segment-derived trends for all users', () => {
    const metrics: SessionMetrics[] = [
      {
        // Session 1
        bestStableDeviation: 3.0,
        nearBestStableTime: 10,
        qualityPercent: 50,
        fusionAchieved: false,
        fusionAchievedCount: 0,
        /* ... other fields ... */
      },
      {
        // Session 2: improving
        bestStableDeviation: 2.5,
        nearBestStableTime: 15,
        qualityPercent: 55,
        fusionAchieved: false,
        fusionAchievedCount: 0,
        /* ... other fields ... */
      },
      {
        // Session 3: further improving
        bestStableDeviation: 2.0,
        nearBestStableTime: 20,
        qualityPercent: 60,
        fusionAchieved: false,
        fusionAchievedCount: 0,
        /* ... other fields ... */
      },
    ];

    const result = calculateProgressInsight(metrics, { deviation: 1.0, rotation: 30 });

    expect(result.bestStableDeviationTrend).toBeDefined();
    expect(result.bestStableDeviationTrend.direction).toBe('improving');  // decreasing value = improving
    expect(result.nearBestStableTimeTrend).toBeDefined();
    expect(result.nearBestStableTimeTrend.direction).toBe('improving');  // increasing value = improving
    expect(result.qualityPercentTrend).toBeDefined();
    expect(result.qualityPercentTrend.direction).toBe('improving');
    expect(result.fusionAchievedRate).toBe(0);
    expect(result.fusionStreakTrend).toBeUndefined();  // < 30%, no fusion trends
  });

  it('should compute fusion trends when fusionRate >= 30%', () => {
    const metrics: SessionMetrics[] = Array.from({ length: 10 }, (_, i) => ({
      bestStableDeviation: 3.0 - i * 0.2,
      nearBestStableTime: 10 + i * 2,
      qualityPercent: 50 + i * 2,
      fusionAchieved: i >= 3,  // 7/10 = 70% > 30%
      fusionEventCount: i >= 3 ? i - 2 : 0,
      longestFusionStreak: i >= 3 ? (i - 2) * 5 : 0,
      /* ... other required fields ... */
    }));

    const result = calculateProgressInsight(metrics, { deviation: 1.0, rotation: 30 });

    expect(result.fusionAchievedRate).toBe(70);
    expect(result.fusionStreakTrend).toBeDefined();
    expect(result.fusionEventCountTrend).toBeDefined();
  });
});
```

- [ ] **Step 2: Write test for calculateExerciseInsights with new fields**

Add:

```typescript
it('should compute median bestStableDeviation and nearBestStableTime', () => {
  const metrics: SessionMetrics[] = [
    { exerciseTag: 'Brock String', bestStableDeviation: 2.0, nearBestStableTime: 10, /* ... */ },
    { exerciseTag: 'Brock String', bestStableDeviation: 3.0, nearBestStableTime: 15, /* ... */ },
    { exerciseTag: 'Brock String', bestStableDeviation: 2.5, nearBestStableTime: 12, /* ... */ },
  ];

  const result = calculateExerciseInsights(metrics);
  const brockInsight = result.find(e => e.exerciseTag === 'Brock String');

  expect(brockInsight?.medianBestStableDeviation).toBe(2.5);
  expect(brockInsight?.medianNearBestStableTime).toBe(12);
});
```

- [ ] **Step 3: Write test for calculateSessionQualityInsight with bestStableDeviation**

Add:

```typescript
it('should detect outliers using bestStableDeviation', () => {
  const metrics: SessionMetrics[] = [
    { sessionId: '1', bestStableDeviation: 2.0, /* ... */ },
    { sessionId: '2', bestStableDeviation: 2.1, /* ... */ },
    { sessionId: '3', bestStableDeviation: 2.0, /* ... */ },
    { sessionId: '4', bestStableDeviation: 7.0, /* ... */ },  // Outlier (worse)
  ];

  const result = calculateSessionQualityInsight(metrics);

  expect(result.outliers.length).toBeGreaterThan(0);
  const outlier = result.outliers.find(o => o.sessionId === '4');
  expect(outlier).toBeDefined();
  expect(outlier?.direction).toBe('unusually_poor');
});
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/utils/__tests__/analysisInsights.test.ts --no-coverage 2>&1 | tail -30`

Expected: All new tests pass

- [ ] **Step 5: Commit**

```bash
git add src/utils/__tests__/analysisInsights.test.ts
git commit -m "test: add unit tests for updated insight functions

- Test calculateProgressInsight computes segment-derived trends for all users
- Test fusion trends computed only when fusionRate >= 30%
- Test calculateExerciseInsights computes medians for new fields
- Test calculateSessionQualityInsight detects outliers on bestStableDeviation

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Task 16: Add component tests for ProgressGraphs

**Files:**
- Create: `src/components/__tests__/ProgressGraphs.test.tsx`

- [ ] **Step 1: Write component scaffold test**

Create `src/components/__tests__/ProgressGraphs.test.tsx`:

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgressGraphs } from '../ProgressGraphs';
import { SessionMetrics } from '../../types/analysis';

// Mock recharts to avoid rendering complexity
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ data, children }: any) => (
    <div data-testid="line-chart" data-count={data.length}>
      {children}
    </div>
  ),
  AreaChart: ({ data, children }: any) => (
    <div data-testid="area-chart" data-count={data.length}>
      {children}
    </div>
  ),
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: ({ content }: any) => <div data-testid="tooltip">{content}</div>,
  Legend: () => null,
  Line: ({ dataKey, onClick }: any) => <div data-testid={`line-${dataKey}`} />,
  Area: ({ dataKey }: any) => <div data-testid={`area-${dataKey}`} />,
}));

describe('ProgressGraphs', () => {
  const mockSessions: SessionMetrics[] = [
    {
      sessionId: '1',
      date: '2026-04-01',
      exerciseTag: 'Brock String',
      bestStableDeviation: 2.0,
      nearBestStableTime: 10,
      qualityPercent: 50,
      driftingPercent: 30,
      approachingPercent: 20,
      /* ... other required fields ... */
    },
    {
      sessionId: '2',
      date: '2026-04-02',
      exerciseTag: 'Pencil Push-ups',
      bestStableDeviation: 1.5,
      nearBestStableTime: 15,
      qualityPercent: 55,
      driftingPercent: 25,
      approachingPercent: 20,
      /* ... other required fields ... */
    },
  ];

  it('should render three graphs', () => {
    render(<ProgressGraphs sessions={mockSessions} />);

    const lineCharts = screen.getAllByTestId('line-chart');
    const areaCharts = screen.getAllByTestId('area-chart');

    expect(lineCharts).toHaveLength(2);  // bestStableDeviation, nearBestStableTime
    expect(areaCharts).toHaveLength(1);  // composition
  });

  it('should filter sessions by exercise', () => {
    render(<ProgressGraphs sessions={mockSessions} exerciseFilter="Brock String" />);

    const lineCharts = screen.getAllByTestId('line-chart');
    expect(lineCharts[0]).toHaveAttribute('data-count', '1');  // Only one session matches
  });

  it('should call onDrillDown when clicking a data point', async () => {
    const onDrillDown = jest.fn();
    render(<ProgressGraphs sessions={mockSessions} onDrillDown={onDrillDown} />);

    // Note: actual click handling would require unmoicking recharts, so this is simplified
    // In real test, would simulate click on actual Line element
  });

  it('should show no sessions message when empty', () => {
    render(<ProgressGraphs sessions={[]} />);

    screen.getByText('No sessions to display');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- src/components/__tests__/ProgressGraphs.test.tsx --no-coverage 2>&1 | tail -20`

Expected: Tests pass (some may be skipped due to recharts mocking complexity)

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/ProgressGraphs.test.tsx
git commit -m "test: add component tests for ProgressGraphs

- Mock recharts to avoid rendering complexity
- Test three graphs render (2 lines, 1 area)
- Test exercise filtering
- Test empty sessions case
- Basic structure tests passing

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Task 17: Run full test suite and fix any issues

**Files:**
- N/A (test verification only)

- [ ] **Step 1: Run all new tests**

Run: `npm test -- src/utils/__tests__/sessionMetrics.aggregate.test.ts src/utils/__tests__/analysisInsights.test.ts src/components/__tests__/ProgressGraphs.test.tsx --no-coverage 2>&1 | tail -40`

Expected: All tests pass

- [ ] **Step 2: Run full build**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -20`

Expected: No TypeScript errors (some warnings are acceptable)

- [ ] **Step 3: Document any test gaps**

If there are tests that couldn't be completed due to mocking complexity, note them for manual testing phase.

- [ ] **Step 4: Commit**

```bash
git commit -m "test: verify all new tests pass, full build compiles

- All 10+ new unit tests for computeSessionAggregateMetrics pass
- All new insight function tests pass
- Component tests structured and mocked
- TypeScript compiler shows no errors
- Ready for integration testing

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Phase 7: Documentation

### Task 18: Update development.md documentation

**Files:**
- Modify: `docs/development.md`

- [ ] **Step 1: Find or create documentation section**

Check if `docs/development.md` exists and has a metrics section:

Run: `head -50 docs/development.md | grep -i metric`

- [ ] **Step 2: Add metrics computation section**

Add to docs/development.md:

```markdown
## Segment-Derived Metrics

As of April 2026, `SessionMetrics` includes computed aggregates derived from segment data:

### New Fields on SessionMetrics
- `bestStableDeviation` (number): Minimum mean deviation across FUSION, NEAR_FUSION, and STABLE_DEVIATION segments. For non-fusion users, this is their baseline stable level. For fusion users, this is near zero.
- `nearBestStableTime` (number): Total duration (seconds) of quality segments within the "near-best band" (see below).
- `qualityPercent` (number): Percentage of session time spent in quality states (0–100%).
- `driftingPercent` (number): Percentage of session time in DRIFTING state (0–100%).
- `approachingPercent` (number): Percentage of session time in APPROACHING state (0–100%).

### Quality Band Calculation
The "near-best band" is computed per-session using a relative threshold:
```
nearBestThreshold = bestStableDeviation + 0.1 × (sessionMaxDeviation - bestStableDeviation)
```
This ensures the band is contextual to the patient's session range. Quality segments are those in {FUSION, NEAR_FUSION, STABLE_DEVIATION} with meanDeviation ≤ nearBestThreshold.

### Computation in calculateSessionMetrics()
After `classifyStates()` produces state segments, `computeSessionAggregateMetrics()` computes these metrics. See `src/utils/sessionMetrics.ts` for implementation.

---

## Multi-Session Progress Visualization

### ProgressGraphs Component
New component `src/components/ProgressGraphs.tsx` displays three stacked graphs:
1. **Best Stable Deviation** (cm): Tracks improvement in the patient's stable baseline
2. **Near-Best Stable Time** (seconds): Tracks duration sustained at or near the best level
3. **Session Composition** (%): Stacked area showing qualityPercent, driftingPercent, approachingPercent

### Features
- **Synchronized zoom/pan**: All graphs zoom/pan together via `useZoomPan()` hook
- **Shared tooltip**: Single tooltip shows all metrics for hovered session
- **Touch gestures**: Two-finger pinch for zoom on mobile
- **Datetime labels**: X-axis shows session datetime (YYYY-MM-DD hh:mm:ss)
- **Exercise filtering**: Filter displayed sessions by exercise tag
- **Drill-down**: Click a session to view detail in UnifiedSessionPanel
- **State persistence**: Zoom range, filters, and drill-down state saved to URL via `useSessionAnalysisState()` hook

### Integration
ProgressGraphs is integrated into AggregateResultsPanel (multi-session analysis view). Back button in detail view returns to ProgressGraphs with state preserved.

---

## Insight Function Updates

### calculateProgressInsight()
Always computes trends for segment-derived metrics:
- `bestStableDeviationTrend`: Is the patient's stable baseline improving? (decreasing = improving)
- `nearBestStableTimeTrend`: Are they sustaining their best level longer? (increasing = improving)
- `qualityPercentTrend`: Is the fraction of stable time increasing? (increasing = improving)

Additionally computes fusion trends when `fusionAchievedRate >= 30%`:
- `fusionStreakTrend`: If fusion is reliable, is the longest streak improving?
- `fusionEventCountTrend`: If fusion is reliable, how often are they achieving it?

### calculateExerciseInsights()
Now includes median fields for non-fusion comparison:
- `medianBestStableDeviation`: Median stable level across all sessions of that exercise
- `medianNearBestStableTime`: Median time sustained at that level

### calculateSessionQualityInsight()
Outlier detection now uses `bestStableDeviation` instead of `minValue` (more robust, segment-based).

### calculateMilestoneInsight()
New readiness indicator: `'best_stable_level_approaching'` tracks if the patient's stable baseline is converging toward the fusion threshold.

---

## Constants
- `NEAR_BEST_THRESHOLD_BAND_PERCENT = 10` (src/utils/sessionMetrics.ts)
- `FUSION_RATE_THRESHOLD_PERCENT = 30` (src/utils/analysisInsights.ts)
```

- [ ] **Step 3: Add new types reference**

Add to documentation:

```markdown
## New Types

### TrendInfo
```typescript
interface TrendInfo {
  slope: number;
  direction: 'improving' | 'declining' | 'stable';
  significance: { p: number; significant: boolean };
}
```

Represents a time-series trend with direction and statistical significance (p < 0.05).

### SessionAnalysisState
URL-persisted state for multi-session analysis view:
```typescript
interface SessionAnalysisState {
  selectedSessionIds: string[];
  exerciseFilter?: string;
  zoomStart: number;
  zoomEnd: number;
  drilledDownSessionId?: string;
}
```
Managed by `useSessionAnalysisState()` hook.
```

- [ ] **Step 4: Run doc linting (if applicable)**

Run: `npm run lint docs/development.md 2>&1 | head -20`

Or manually review for markdown formatting.

- [ ] **Step 5: Commit**

```bash
git add docs/development.md
git commit -m "docs: add non-fusion metrics and progress visualization documentation

- Document segment-derived metrics (bestStableDeviation, nearBestStableTime, etc.)
- Explain quality band calculation and per-session context
- Document ProgressGraphs component features (zoom, tooltip, filters, drill-down)
- Document insight function updates for all user types
- Document new constants and types
- Update development guide for future maintainers

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Final Checklist

- [ ] All 18 tasks completed
- [ ] All TypeScript compilation succeeds (`npm run build`)
- [ ] All unit tests pass (`npm test`)
- [ ] ProgressGraphs renders without crashing (manual verification needed)
- [ ] Zoom/pan works on desktop and mobile
- [ ] URL state persistence works (refresh page, back button)
- [ ] Drill-down navigation works (click → detail → back)
- [ ] No console errors or warnings
- [ ] Code follows project style (emotion for CSS, TypeScript strict mode)
- [ ] Git history is clean with descriptive commit messages
