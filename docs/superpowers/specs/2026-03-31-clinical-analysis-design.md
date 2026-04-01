# Clinical Analysis System Design

**Date:** 2026-03-31 (last updated 2026-04-01)
**Status:** Approved
**Scope:** Phase 1 — Session metric extraction, enhanced single-session view, multi-session analysis

## Overview

Enhance the app with clinically meaningful session metrics derived from time series data, surfaced across three contexts:

1. **Post-recording summary** — immediate feedback shown right after a session ends
2. **History page — single session** — rich session detail replacing the current basic StatCards
3. **History page — multi-session** — analysis report when ≥2 sessions are selected (replaces current aggregate view)

The History page becomes the single entry point for all session review and analysis. A separate Analysis route is not needed.

**Key principles:**
- `SessionMetrics` is computed fresh from raw time series at display time, never stored
- Report snapshots store only config (thresholds, baseline, date range); insights recalculate on load
- Mean deviation is not used anywhere in analysis — histogram-derived and event-based metrics replace it
- Sessions shorter than 10 seconds are excluded from all analysis

## Goals & Success Criteria

1. **Clinically meaningful metrics** — fusion events, streaks, approach patterns, and minimum deviation replace mean deviation
2. **Progress visible even without fusion** — minimum deviation trend shows improvement before fusion is achieved
3. **Curated multi-session insights** — progress trends, exercise effectiveness, session quality, readiness, and recommendations in one view
4. **Saved report history** — named snapshots preserve config for clinical records
5. **No regression** — existing History browsing, filtering, and time series display unchanged

Success criteria:
- A clinician can understand a patient's progress in <60 seconds from the multi-session view
- Single-session view communicates whether the session was productive without requiring chart interpretation
- Post-recording summary gives actionable immediate feedback

## Architecture

### Routing

Replace the current `activePage` state in `App.tsx` with **React Router**:
- `/` — Measurement page (AssessmentCanvas)
- `/history` — Combined session browser + analysis (replaces both History and planned Analysis page)
- Browser back/forward navigation supported

The `/history` route reads optional URL params for pre-applied filters:
`/history?exercise=BrockString&from=2026-03-01&to=2026-03-31&sessions=<id1>,<id2>`

### User Settings: Analysis Configuration

Stored in localStorage under key `"strabismus_analysis_settings"`. Pre-fills all new analysis views and report generation.

```typescript
interface AnalysisSettings {
  goal: {
    thresholds: {
      deviation: number;        // default: 0.5 cm
      rotation: number;         // default: 1°
    };
    sustainedDays: number; // default: 7
  };
}
```

Accessible via a settings panel (gear icon or dedicated Settings route, TBD). Changes apply immediately to any non-saved analysis view.

### Data Model

**ReportSnapshot (IndexedDB, new `reports` store)**

Stores only config; insights are recalculated from live session data each time a snapshot is viewed.

```typescript
interface ReportSnapshot {
  reportId: string;             // UUID
  name?: string;                // User-provided label (optional; auto-named if blank)
  sessionIds: string[];         // Explicit session IDs included in this report
  metrics: ('deviation' | 'rotation')[]; // At least one required
  goal: {
    thresholds: {
      deviation?: number;       // Present if 'deviation' in metrics
      rotation?: number;        // Present if 'rotation' in metrics
    };
    sustainedDays: number;      // default: 7
  };
  baseline?: {
    dateRange: [number, number]; // [fromMs, toMs]
    exerciseTypes?: string[];    // absent = all exercise types
  };
  savedAt: number;              // Unix ms timestamp
}
```

**Notes:**
- `sessionIds` replaces a date range — the snapshot captures exactly which sessions were analysed, so adding new sessions later does not silently change a saved report's scope
- `thresholds` keys match `metrics` — only keys for selected metrics are present
- Designed to extend with optional `llmOutput` in future without migration
- Structure is intentionally minimal; full insight caching deferred to future if performance requires it

### Session Metric Extraction

#### Motivation

Mean deviation is an insufficient summary statistic. A session where the user achieves fusion for 3 seconds then drifts looks identical in mean to a session with consistently moderate deviation — yet these are entirely different clinical outcomes. For sessions where fusion is never achieved, mean deviation still fails to show whether the patient is getting closer.

Every session is reduced to a `SessionMetrics` object before any analysis or display. All insight calculations, StatCards, and post-recording summaries operate on `SessionMetrics`, never on raw `TimeSeries` arrays.

#### Signal Pre-processing

Before metric extraction, the raw time series is smoothed using a **Savitzky-Golay filter** (window ≈ 5–11 points, polynomial order 2) from the `ml-savitzky-golay` library. This preserves fusion event peaks while reducing noise. The smoothed series is used for state classification and slope calculations; the raw series is used for fusion time calculations to preserve sub-bin precision.

#### Per-Session Metric Structure

```typescript
interface SessionMetrics {
  sessionId: string;
  date: string;
  exerciseTag: string;
  metric: 'deviation' | 'rotation';
  sessionDuration: number;           // seconds; sessions < 10s excluded from analysis

  // Full histogram (1cm bins for deviation, 1° for rotation)
  // Delegates to existing calculateSessionHistogram() in histogram.ts
  histogram: HistogramBin[];

  // --- Sub-scores (replace the deprecated single sessionScore) ---

  // Responsiveness: how quickly user achieved fusion (null if never achieved)
  timeToFirstFusion: number | null;  // seconds from session start

  // Repeatability: distinct fusion episodes (each entry into sub-threshold zone counts)
  fusionEventCount: number;          // integer ≥ 0

  // Peak capability: longest single continuous period below threshold
  longestFusionStreak: number;       // seconds (0 if no fusion)

  // Best approach: minimum metric value reached (key progress indicator for no-fusion sessions)
  minValue: number;                  // cm (deviation) or ° (rotation); absolute minimum in session

  // Stability: time spent in large deviation zone (> 2 × threshold), as % of session
  largeDeviationTimePercent: number; // lower is better

  // Session trajectory: did the patient improve during the session?
  // Positive = second half had lower mean than first half (improving)
  // Negative = second half worse (fatiguing or struggling)
  trajectoryRatio: number;           // (firstHalfMean - secondHalfMean) / firstHalfMean

  // --- Supporting metrics ---

  fusionTime: number;                // seconds with metric < threshold (raw, not %)
  fusionTimePercent: number;         // fusionTime / sessionDuration * 100
  fusionAchieved: boolean;

  nearFusionTime: number;            // seconds in [threshold, threshold + 1 bin)
  nearFusionTimePercent: number;

  largeDeviationTime: number;        // seconds > 2 × threshold

  // --- State segmentation (rule-based FSM) ---
  stateSegments: StateSegment[];
}

type SessionState =
  | 'DRIFTING'       // high deviation, no clear convergence
  | 'APPROACHING'    // deviation decreasing steadily toward threshold
  | 'NEAR_FUSION'    // within one bin above threshold
  | 'FUSION'         // below threshold
  | 'LOSING_FUSION'; // deviation increasing from sub-threshold

interface StateSegment {
  state: SessionState;
  startTime: number;   // seconds from session start
  endTime: number;     // seconds from session start
  duration: number;    // seconds
}
```

#### Calculation Details

**Pre-processing:** Apply Savitzky-Golay smoothing to raw metric values before state classification. Use raw values for fusion time, nearFusionTime, and largeDeviationTime to preserve threshold precision.

**Fusion metrics** (raw time series scan):
For each consecutive pair of points `[i, i+1]`, `duration = (t[i+1] - t[i]) / 1000`. Classify by raw `metricValue(i)`:
- `< threshold` → fusionTime
- `[threshold, threshold + 1 bin)` → nearFusionTime (1cm or 1°)
- `> 2 × threshold` → largeDeviationTime

**fusionEventCount**: Count transitions from any non-FUSION state into FUSION state in `stateSegments`.

**longestFusionStreak**: Maximum `duration` among all segments with `state === 'FUSION'`.

**timeToFirstFusion**: `startTime` of the first FUSION segment, or `null` if none.

**minValue**: `Math.min(...timeSeries.map(metricValue))` on the raw series.

**trajectoryRatio**: Split session at midpoint; compute mean metric value for each half using raw series. `(firstHalfMean - secondHalfMean) / firstHalfMean`. A positive ratio means the second half improved.

**Rule-based FSM state classification** (operates on smoothed series):
1. Compute local slope over a sliding window (~10 points) at each time step
2. At each point, classify:
   - smoothedValue < threshold → `FUSION`
   - smoothedValue in [threshold, threshold + nearFusionWidth) → `NEAR_FUSION`
   - smoothedValue > nearFusionWidth + threshold AND slope < −slopeThreshold → `APPROACHING`
   - previous state was FUSION or NEAR_FUSION AND slope > +slopeThreshold → `LOSING_FUSION`
   - otherwise → `DRIFTING`
3. Merge consecutive same-state points into segments
4. Drop segments shorter than 0.5s (noise suppression)
5. slopeThreshold: 0.1 cm/s for deviation, 0.1°/s for rotation (tunable in Phase 2)

**Histogram**: Delegate to existing `calculateSessionHistogram(session, metric)`.

#### How Insights Use SessionMetrics

| Context | Metrics used |
|---------|-------------|
| **Post-recording summary** | All sub-scores + stateSegments |
| **History — single session StatCards** | All sub-scores + stateSegments |
| **History — multi-session analysis** | Sub-scores aggregated across sessions for each insight section |

For multi-session analysis, `SessionMetrics` objects are computed for each session, then aggregated:
- `ProgressInsight` trends on `longestFusionStreak` and `minValue` over time
- `ExerciseInsight` ranks by median `longestFusionStreak` + median `fusionEventCount`
- `SessionQualityInsight` outliers by z-score of `longestFusionStreak`
- `MilestoneInsight` tracks `fusionAchieved` streaks and `minValue` trend
- Sessions without fusion contribute `minValue` trend to progress even when `fusionAchieved = false`

### Insight Structures (multi-session analysis)

Calculated at display time from `SessionMetrics[]`. Never stored.

```typescript
interface ProgressInsight {
  metric: 'deviation' | 'rotation';

  // Primary trend: longestFusionStreak over the period
  fusionStreakTrend: {
    slope: number;               // seconds/week
    direction: 'improving' | 'declining' | 'stable';
    significance: { p: number; significant: boolean };
  };

  // Progress even without fusion: minValue trend across sessions
  minValueTrend: {
    slope: number;               // cm/week or °/week (negative = improving)
    direction: 'improving' | 'declining' | 'stable';
    significance: { p: number; significant: boolean };
    startValue: number;
    currentValue: number;
  };

  // Fusion achievement stats across the period
  fusionAchievedRate: number;    // % of sessions where fusionAchieved = true
  fusionAchievedCount: number;
  totalSessions: number;

  // Aggregate histogram: time distribution summed across all sessions in period
  aggregateHistogram: HistogramBin[];

  // Only present when baseline configured:
  baselineFusionAchievedRate?: number;
  baselineMedianStreak?: number;
  improvementRate?: number;      // % of period sessions with longestFusionStreak > baseline median
}

interface ExerciseInsight {
  exerciseTag: string;
  metric: 'deviation' | 'rotation';
  sessionCount: number;

  medianLongestStreak: number;   // seconds
  medianFusionEventCount: number;
  medianMinValue: number;        // useful when fusionAchievedRate is low
  fusionAchievedRate: number;    // % of sessions for this exercise where fusion occurred

  trendDirection: 'improving' | 'declining' | 'stable';
  trendSlope: number;            // median streak change per week

  // Only present when baseline configured:
  improvementRate?: number;
}

interface SessionQualityInsight {
  metric: 'deviation' | 'rotation';

  outliers: Array<{
    sessionId: string;
    date: string;
    exerciseTag: string;
    longestFusionStreak: number;
    fusionEventCount: number;
    minValue: number;
    zScore: number;
    direction: 'unusually_good' | 'unusually_poor';
  }>;
  variabilityInterpretation: string;

  // Only present when baseline configured:
  consistencyScore?: number;     // % of sessions with longestFusionStreak within 10% of baseline median
}

interface CombinedQualityInsight {
  // Cross-metric analysis when both metrics selected
  correlationNote: string;
  overallConsistencyScore?: number;
}

interface MilestoneInsight {
  metric: 'deviation' | 'rotation';

  // Fusion achievement milestones
  sustainedFusionEvents: Array<{
    startDate: string;
    endDate: string;
    durationDays: number;
  }>;

  // minValue progress toward threshold (relevant even without fusion)
  minValueProgress: {
    startValue: number;          // minValue in first session of period
    currentValue: number;        // minValue in most recent session
    targetThreshold: number;
    progressPercent: number;     // clamped 0–100
  };

  readinessIndicators: string[]; // e.g., "Fusion sustained 7+ days on 2 occasions"
}

interface RecommendationInsight {
  prioritize: Array<{ exerciseTag: string; reason: string }>;
  reduce: Array<{ exerciseTag: string; reason: string }>;
  generalNotes: string[];
}
```

### Page Structure: Combined History + Analysis

**Route:** `/history`

**Layout:** Two-column split, mirroring the current History page.

**Left panel (300px):**
- Session list with filters (date range, exercise type) — unchanged from current
- Multi-select: Shift+click range, Ctrl+click toggle
- Report history section below session list — collapsible, shows saved ReportSnapshots sorted by `savedAt`; click to restore that snapshot's config and re-run analysis on its saved `sessionIds`

**Right panel (flex) — three modes based on selection:**

**Mode 0 — Nothing selected:**
- Prompt: "Select one or more sessions to view analysis"

**Mode 1 — Single session selected:**
→ See "Single Session View" section below

**Mode 2 — Multiple sessions selected:**
→ See "Multi-Session Analysis View" section below

### Single Session View

Replaces current UnifiedSessionPanel single-session layout.

**Header:** Session date, exercise tag, duration

**Sub-scores panel** (replaces StatCards):

| Sub-score | Display | Notes |
|-----------|---------|-------|
| Fusion achieved | Yes / No | With count of events if yes |
| Longest fusion streak | Xs | Prominent if fusion achieved |
| Time to first fusion | Xs | Only shown if fusion achieved |
| Min deviation reached | X.Xcm | Key metric if no fusion |
| Large deviation | X% | As % of session |
| Session trajectory | Improving / Stable / Declining | Based on trajectoryRatio |

**State segmentation timeline:**
- Horizontal timeline bar showing coloured state segments (DRIFTING, APPROACHING, NEAR_FUSION, FUSION, LOSING_FUSION)
- Colour legend below
- Duration labels for segments > 2s
- Clinically interpretable summary below: e.g., "3 fusion episodes totalling 12s. Patient reached near-fusion 5 times."

**Histogram:**
- Existing HistogramChart (unchanged, shown below segmentation)

**Time series:**
- Existing TimeSeriesGraph (unchanged, shown below histogram)

### Multi-Session Analysis View

Shown when ≥2 sessions are selected. Replaces current aggregate UnifiedSessionPanel.

**Analysis config panel** (inline, not a modal):
- Always visible at top of right panel; collapsible
- Fields:
  - **Metrics** — checkboxes for Deviation, Rotation (at least one required)
  - **Fusion threshold** — numeric input, pre-filled from `AnalysisSettings`; shown per selected metric
  - **Rotation target** — numeric input, pre-filled from settings; shown if Rotation selected
  - **Sustained threshold days** — numeric input, pre-filled from settings
  - **Baseline period** — optional date range picker + exercise type multi-select; expandable subsection
  - **"Save to settings" button** — pushes current threshold/sustainedThresholdDays values to `AnalysisSettings` localStorage

- **"Save report" button** (separate from config panel, below report sections):
  - Name input field (auto-named: "Report — Jan 15 – Feb 15, 2026" based on session date range)
  - Saves `ReportSnapshot` to IndexedDB with current config + selected session IDs
  - Saved report appears in left panel report history list

**Analysis is live** — changing any config field immediately recalculates and re-renders all sections below. No "Generate" button needed.

**Report sections** (all expanded by default, stacked vertically):

---

**Section A: Progress & Trend**

*One block per selected metric.*

Each block:
- **Fusion streak trend chart**: `longestFusionStreak` per session over time with regression line
- **Min value trend chart**: `minValue` per session over time (separate small chart below; shows progress toward threshold even when no fusion)
- **Fusion achievement rate**: X of Y sessions achieved fusion (X%)
- Statistical significance of streak trend (p-value)
- If baseline: improvement rate, baseline vs period median streak comparison
- Interpretation text: e.g., "Fusion streak improving significantly (+8s/week, p=0.02). Patient has not yet achieved fusion in 4 of 12 sessions — minimum deviation trending toward threshold."

---

**Section B: Exercise Effectiveness**

*One block per selected metric.*

Each block:
- Ranked table sorted by `medianLongestStreak` (descending):
  - Columns: Exercise, Sessions, Fusion Rate, Median Streak, Median Min Value, Trend (▲/▼/→)
  - If baseline: Improvement Rate column
- Interpretation: best/worst exercise callout
- "View sessions" link → navigates to `/history?exercise=<tag>&from=<ms>&to=<ms>`

---

**Section C: Session Quality & Consistency**

*One subsection per metric + combined analysis if both selected.*

Per-metric subsection:
- Outlier table: unusually good/poor sessions with date, exercise, fusion streak, min value, z-score
- Variability interpretation text
- If baseline: consistency score

Combined (both metrics):
- Cross-metric correlation note
- Overall consistency if baseline configured

---

**Section D: Milestones & Readiness**

*One block per metric.*

Each block:
- Min value progress bar: current min value vs threshold, progress % toward goal
- Sustained fusion events list (calendar days ≥ `sustainedThresholdDays`)
- Readiness indicators

---

**Section E: Recommendations**

*Single section.*

- Only shown when ≥2 exercise types in selected sessions
- Prioritise / Reduce / Reassess exercise list with reasons
- Caveats for insufficient data

---

### Post-Recording Summary

`ResultsPanel` (shown immediately after a session ends) is enhanced to display `SessionMetrics`:

- **Session duration**
- **Sub-scores** (same table as single session view): fusion achieved, longest streak, time to first fusion, min deviation, large deviation %, trajectory
- **State breakdown**: short text summary (e.g., "3 fusion episodes. Spent 12s in fusion, 18s approaching.")
- **Histogram**: small compact version

Mean deviation is removed from `ResultsPanel`.

## UI/UX Details

### Unified Date Range Picker Component

Shared between History filter, Analysis baseline picker, and report date displays:
- Preset buttons: "Last week", "Last 4 weeks", "All available data"
- Custom date inputs (from/to)
- Shows earliest and latest available session dates as hint
- Replaces existing `DateFilterBar`

### Report History (Left Panel)

- Collapsible section below session list in left panel
- Sorted by `savedAt` (newest first)
- Each item: name, session count, date range of sessions, `savedAt` date
- Click to load: restores snapshot's config to the analysis config panel, selects the snapshot's `sessionIds` in the session list, runs analysis
- Delete button per item (with confirmation)
- If some saved session IDs no longer exist in IndexedDB (deleted), show a warning but still run analysis on remaining sessions

### Drill-down Navigation

"View sessions" links in Section B navigate to `/history` with URL params pre-applying exercise and date filters. History page reads params on mount via React Router's `useSearchParams`.

### `progressPercent` Calculation (minValue toward threshold)

Formula: `((startValue - currentValue) / (startValue - threshold)) * 100`

Clamped to 0–100:
- If `currentValue > startValue` (got worse): 0%
- If `currentValue ≤ threshold` (goal reached or exceeded): 100%
- If `startValue === threshold`: show 100%

### Outlier Detection

Z-score on `longestFusionStreak` across the period. Sessions with |z| > 2 flagged; labelled `unusually_good` (z > +2) or `unusually_poor` (z < −2). When no fusion was achieved in most sessions (fusionAchievedRate < 30%), fall back to z-score on `minValue` instead.

### Consistency Score

`(count of sessions where longestFusionStreak is within 10% of baseline median streak / total sessions) × 100`

When most sessions have no fusion, fall back to consistency on `minValue`.

### Improvement Rate

`(count of period sessions where longestFusionStreak > baseline median streak / total period sessions) × 100`

Per-exercise: uses same-exercise baseline sessions; falls back to full baseline.

### Trend Slope Units

- Fusion streak trends: seconds/week
- Min value trends: cm/week (deviation), °/week (rotation)
- Trend "stable" if p ≥ 0.05 or slope magnitude is negligible (< 0.5s/week for streak, < 0.05 cm/week for min value)

## Calculation Logic Notes

- **Session filtering:** Sessions shorter than 10 seconds are excluded from all analysis calculations
- **Session metric caching:** `SessionMetrics` computed once per session per metric per render; recomputed if threshold changes (which affects fusion classification)
- **FSM tuning:** `slopeThreshold` (0.1 cm/s) and minimum segment duration (0.5s) are constants in Phase 1; expose as tunable settings in Phase 2
- **Sustained fusion events:** Group consecutive calendar days where ≥1 session had `fusionAchieved = true`; span ≥ `sustainedThresholdDays` days counts as an event. Days with no sessions do not break a streak.
- **Exercise ranking:** When baseline configured, sort by improvement rate; otherwise by `medianLongestStreak` descending. When most sessions have no fusion, sort by `medianMinValue` ascending.
- **Minimum session counts:** <3 sessions → show "Insufficient data" for trend calculations; <2 exercise types → hide Section E with explanation

## Libraries

- **`simple-statistics`** — regression, p-values, z-scores, skewness/kurtosis, IQR. Primary stats library.
- **`ml-savitzky-golay`** — signal smoothing for FSM state classification. From the `mljs` ecosystem.
- No HMM or changepoint library in Phase 1; rule-based FSM is sufficient and transparent.

## Implementation Dependencies

- **React Router** — replace `activePage` state in `App.tsx`; `useSearchParams` in History page for pre-applied filters
- **Unified date range picker** — extract and enhance `DateFilterBar` into shared component used in History filter, analysis config panel, and baseline picker
- **`sessionMetrics.ts`** — new utility: computes `SessionMetrics` from `Session` + threshold config; uses `calculateSessionHistogram()` and `ml-savitzky-golay`; contains FSM state classifier
- **`analysisInsights.ts`** — new utility: aggregates `SessionMetrics[]` into the five insight structures
- **`stats.ts` extensions** — linear regression + p-value, z-score, improvement rate, consistency score (using `simple-statistics`)
- **`AnalysisSettings`** — localStorage read/write utility with defaults
- **IndexedDB migration** — add `reports` object store to `StrabismusDB`
- **New/updated components:**
  - `HistoryPage.tsx` — add three-mode right panel, report history section in left panel
  - `SingleSessionView.tsx` — sub-scores panel + state segmentation timeline + existing charts
  - `MultiSessionAnalysisView.tsx` — inline config panel + five report sections
  - `StateSegmentationTimeline.tsx` — horizontal state timeline bar
  - `SubScoresPanel.tsx` — replaces StatCards in single session + post-recording contexts
  - `ResultsPanel.tsx` — updated to use SubScoresPanel + compact histogram
  - Report section components: `ProgressSection`, `ExerciseEffectivenessSection`, `SessionQualitySection`, `MilestonesSection`, `RecommendationsSection`

## Future Extensions (Out of Scope for Phase 1)

1. **HMM state classifier** — replace rule-based FSM; better handles ambiguous transitions and noisy signals
2. **LLM-generated summaries** — add optional `llmOutput` to `ReportSnapshot`
3. **Report caching** — store computed insights in `ReportSnapshot` if recalculation exceeds 1s
4. **Comparison mode** — overlay two saved reports
5. **Patient-facing simplified view** — plain-language interpretation mode
6. **Measurement page scheduling** — daily exercise schedule recommendations
7. **Export** — PDF or clinical note format
8. **Bimodality and entropy** — histogram shape analysis using Sarle's BC and Shannon entropy (both implementable with `simple-statistics`)
9. **Changepoint detection** — CUSUM or ED-PELT for detecting regime changes within sessions

## Testing Strategy

1. **Unit — `sessionMetrics.ts`:** `fusionTime`, `nearFusionTime`, `largeDeviationTime`, `fusionEventCount`, `longestFusionStreak`, `timeToFirstFusion`, `minValue`, `trajectoryRatio`, FSM state segments for known fixture time series
2. **Unit — `analysisInsights.ts`:** all five insight types; trend + p-value; z-score outliers; consistency score; improvement rate; progressPercent clamping; sustained event grouping
3. **Unit — edge cases:** session < 10s excluded; no fusion achieved anywhere; all sessions same exercise type; threshold equals first session's minValue
4. **Integration:** save/load ReportSnapshot from IndexedDB; URL param pre-filtering; "Save to settings" writes AnalysisSettings; report history restores session selection
5. **Regression:** existing History page filter, multi-select, TimeSeriesGraph, HistogramChart unaffected
