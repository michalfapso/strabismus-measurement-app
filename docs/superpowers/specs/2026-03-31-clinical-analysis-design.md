# Clinical Analysis System Design

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Phase 1 — Improved overview & trend analysis for strabismus measurement data

## Overview

Add a dedicated **Analysis page** to provide clinicians and patients with curated, higher-level insights into measurement data without requiring manual exploration of raw trends. The system generates lightweight report snapshots (configuration only, not cached calculations) that are regenerated on-demand from live session data.

**Key principle:** Report snapshots store only configuration metadata (date range, metrics, thresholds, optional baseline); insights are calculated fresh each time a report is viewed, ensuring data freshness.

## Goals & Success Criteria

1. **Reduce cognitive load** — Users get curated insights instead of raw charts; clinical context is built-in (thresholds, progress indicators)
2. **Support clinical decision-making** — Insights address: progress/trends, exercise effectiveness, session consistency, clinical readiness, exercise recommendations
3. **Audit trail** — Named, timestamped report history lets clinicians track analysis over time
4. **Extensibility** — Structure designed to accommodate future LLM-generated insights and cached full reports if performance requires

Success criteria:
- Clinicians can generate a useful overview in <30 seconds
- Report sections are actionable (exercise recommendations, readiness flags, outlier callouts are clinically clear)
- Report history allows tracking analysis over time
- No regression in existing History page functionality

## Architecture

### Routing

Replace the current `activePage` state in `App.tsx` with **React Router** to support:
- Three top-level routes: `/` (Measurement), `/history`, `/analysis`
- Deep-linkable drill-down from Analysis → History with pre-applied filters via URL params (e.g., `/history?exercise=BrockString&from=1706745600000&to=1709337600000`)
- Browser back/forward navigation
- Future: shareable/bookmarkable report links

### Data Model

**ReportSnapshot (IndexedDB, new `reports` store)**
```typescript
interface ReportSnapshot {
  reportId: string;            // UUID
  name?: string;               // User-provided name (optional)
  dateRange: [number, number]; // [fromTime, toTime] in ms
  metrics: ('deviation' | 'rotation')[]; // At least one required
  thresholds: {
    deviation?: number;        // Required if 'deviation' in metrics (default: 0.5 cm)
    rotation?: number;         // Required if 'rotation' in metrics (default: 1°)
  };
  sustainedThresholdDays: number; // Min days below threshold to count as event (default: 7)
  baseline?: {                 // Optional reference period for comparative metrics
    dateRange: [number, number];
    exerciseTypes?: string[];  // null/absent means all exercise types
  };
  generatedAt: number;         // Timestamp when config was created
}
```

**Notes:**
- `thresholds` keys must match `metrics` — if only `deviation` is selected, only `thresholds.deviation` is required
- `baseline` is optional; when absent, comparative metrics (improvement rate, consistency score) are omitted from the report rather than approximated
- Structure designed to extend with optional `llmOutput` field in future without breaking existing reports

**Insight Structures (calculated at view time, never stored)**

```typescript
interface ProgressInsight {
  metric: 'deviation' | 'rotation';
  trendSlope: number;          // Change per week (e.g., -0.3 cm/week)
  trendDirection: 'improving' | 'declining' | 'stable';
  statisticalSignificance: { p: number; significant: boolean };
  // Below only present when baseline is configured:
  baselineMedian?: number;
  periodMedian?: number;
  change?: number;
  percentChange?: number;
  improvementRate?: number;    // % of period sessions better than baseline median
}

interface ExerciseInsight {
  exerciseTag: string;
  metric: 'deviation' | 'rotation';
  sessionCount: number;
  median: number;
  stddev: number;
  trendDirection: 'improving' | 'declining' | 'stable';
  trendSlope: number;          // Per week
  // Below only present when baseline is configured:
  improvementRate?: number;    // % of sessions better than baseline median for this exercise
}

interface SessionQualityInsight {
  metric: 'deviation' | 'rotation';
  // Below only present when baseline is configured:
  consistencyScore?: number;   // 0-100: % of sessions within 10% of baseline median
  outliers: Array<{
    sessionId: string;
    value: number;             // Median deviation/rotation for this session
    zScore: number;            // How many stddevs from period mean
    date: string;
    exerciseTag: string;
  }>;
  variabilityInterpretation: string; // e.g., "High variability — consider shorter sessions"
}

interface CombinedQualityInsight {
  // Cross-metric analysis when both deviation and rotation are selected
  correlationNote: string;     // e.g., "Rotation outliers align with high deviation days"
  overallConsistencyScore?: number; // Only present when baseline is configured
}

interface MilestoneInsight {
  metric: 'deviation' | 'rotation';
  startValue: number;          // First session value in period
  currentValue: number;        // Last session value in period
  targetThreshold: number;     // From report config
  progressPercent: number;     // Clamped 0–100: progress toward threshold from startValue
  sustainedThresholdEvents: Array<{
    startDate: string;
    endDate: string;
    durationDays: number;
  }>;
  readinessIndicators: string[]; // e.g., ["Sustained below threshold for 7+ days (×2)"]
}

interface RecommendationInsight {
  // Only present when Exercise Effectiveness can be ranked (≥2 exercise types in period)
  prioritize: Array<{
    exerciseTag: string;
    reason: string;  // e.g., "Best median deviation and improving trend"
  }>;
  reduce: Array<{
    exerciseTag: string;
    reason: string;  // e.g., "No measurable improvement, high variability"
  }>;
  generalNotes: string[];      // e.g., "Insufficient data to rank exercises for Rotation"
}
```

### Page Structure

**Navigation:** React Router replaces `activePage` state. Three top-level routes: `/`, `/history`, `/analysis`.

**Analysis page layout — Two-column split:**

**Left panel (300px, fixed width):**
- "Generate New Report" button at top
- Report history list (sorted by `generatedAt`, newest first)
  - Each item shows: name (or auto-generated from date range), date range, generation date
  - Click to load report in right panel
  - Delete action per item

**Right panel (flex):**
- When no report selected: "Select a report from the list or generate a new one"
- When report loaded: Full report display with report metadata at top (name, date range, generation date, metrics, thresholds, baseline if set), then four insight sections + recommendations (all expanded by default)

### Report Generation Flow

1. User clicks "Generate New Report"
2. Modal opens with:
   - **Date range picker** (unified component, shared with History page — see below)
   - **Metrics selection** — Checkboxes for Deviation, Rotation; at least one required; defaults to Deviation
   - **Thresholds** — Required for each selected metric
     - "Fusion threshold (cm)" — shown if Deviation selected, default 0.5
     - "Rotation target (°)" — shown if Rotation selected, default 1
   - **Sustained threshold duration** — "Min days below threshold to count as sustained event", default 7, numeric input
   - **Baseline period (optional)** — Collapsed by default, expandable
     - Label: "Reference baseline for comparative analysis (optional)"
     - Date range picker (same unified component)
     - Exercise type multi-select filter
     - Note: "Without a baseline, improvement rate and consistency metrics will not be shown"
3. User clicks "Generate"
4. System validates inputs, fetches sessions in date range (and baseline sessions if configured), calculates all insights, displays report in right panel
5. Save option appears below report:
   - Toggle: "Save this report"
   - Name input (auto-named if blank: "Report — Jan 15 – Feb 15, 2026")
   - "Save" → ReportSnapshot stored in IndexedDB, added to history list
6. Navigating away without saving discards the unsaved report

### Report Display: Sections

All sections expanded by default. Per-metric data is vertically stacked (one block per metric). Simplified, non-interactive visualizations in each section; drill-down links navigate to History with pre-applied filters.

---

**Section A: Progress & Trend**

*One block per selected metric, stacked vertically.*

Each block:
- Simplified line chart: metric over time with regression trend line
- Stats: period start value, end value, trend direction, trend slope (e.g., "-0.3 cm/week")
- Statistical significance: p-value, highlighted if significant
- If baseline configured: baseline median, period median, absolute change, % change, improvement rate
- If no baseline: note "Configure a baseline period to see comparative metrics"
- Interpretation: brief clinical summary (e.g., "Significant improving trend (p=0.03). Deviation reduced 0.4 cm/week on average.")

---

**Section B: Exercise Effectiveness**

*One block per selected metric, stacked vertically.*

Each block:
- Ranked table: exercises sorted by median value (best first)
  - Columns: Exercise, Sessions, Median, Std Dev, Trend (▲/▼/→)
  - If baseline configured: add Improvement Rate column
- Interpretation: highlights best and worst-performing exercises
- Drill-down: "View in History" link → navigates to `/history` with exercise filter + date range pre-applied via URL params

---

**Section C: Session Quality & Consistency**

*One subsection per selected metric (with consistency score and outliers), followed by a combined analysis if both metrics are selected.*

Per-metric subsection:
- If baseline configured: Consistency score (0–100), interpreted (e.g., "Good consistency — 82% of sessions within 10% of baseline")
- Outlier table: date, value, z-score, exercise tag, for sessions beyond 1.5×IQR from period mean
- Variability interpretation: actionable text (e.g., "High variability — consider shorter, more frequent sessions")

Combined analysis (only if both metrics selected):
- Cross-metric correlation note (e.g., "Rotation outliers frequently coincide with high deviation sessions")
- Overall consistency score if baseline configured

---

**Section D: Milestones & Readiness**

*One block per selected metric, stacked vertically.*

Each block:
- Progress bar: current value vs target threshold, progress % (clamped 0–100%, cannot go below 0 or exceed 100)
- Numeric display: current value, start value, target, % toward goal
- Sustained threshold events: list of periods when patient stayed below threshold for ≥ `sustainedThresholdDays` consecutive days, with start/end dates and duration
- Readiness indicators: clinical decision text based on achieved events (e.g., "Sustained below fusion threshold on 2 occasions — may be ready for next therapy phase")

---

**Section E: Recommendations**

*Single section, not per-metric.*

- Appears only when ≥2 exercise types are present in the analysis period
- **Prioritise:** Exercises showing best effectiveness with reasons
- **Reduce / Reassess:** Exercises showing no measurable improvement or high variability, with reasons
- **Notes:** Any caveats (insufficient data for a metric, exercises with too few sessions to rank, etc.)
- If only one exercise type: section shows "Only one exercise type found in this period — add more exercise variety to enable recommendations"

---

## UI/UX Details

### Unified Date Range Picker Component

Shared between History page filter and Analysis report generation modal:
- Preset buttons: "Last week", "Last 4 weeks", "All available data"
- Custom date inputs (from/to)
- Shows earliest and latest available session dates as hint text
- Replaces the existing `DateFilterBar` in History with this unified component

### Report History List

- Sorted by `generatedAt` (newest first)
- Each item: name or auto-generated label, date range, generation date
- Click to load into right panel
- Delete button per item (with confirmation)

### Drill-down Navigation

"View in History" links in Section B navigate to `/history` with URL params:
- `?exercise=<exerciseTag>&from=<timestamp>&to=<timestamp>`
- History page reads these params on mount and pre-applies filters
- Enables direct exploration of the underlying session data behind an insight

### `progressPercent` Calculation

Formula: `((startValue - currentValue) / (startValue - targetThreshold)) * 100`

Clamped to 0–100:
- If `currentValue > startValue` (got worse): 0%
- If `currentValue <= targetThreshold` (goal reached): 100%
- If `startValue === targetThreshold`: show 100% (already at goal)

### Outlier Detection

Uses 1.5×IQR method on per-session median values within the analysis period. Each session is summarised as its median metric value before outlier detection is applied.

### Consistency Score

`(count of sessions where median is within 10% of baseline median / total sessions) × 100`

Only calculated when a baseline is configured. "Baseline median" = median of all sessions in the baseline period matching the baseline exercise type filter.

### Improvement Rate

`(count of period sessions where median < baseline median / total period sessions) × 100`

Only calculated when baseline is configured. Per-exercise improvement rate uses baseline sessions filtered to the same exercise type (falls back to full baseline if no baseline sessions exist for that exercise).

### Trend Slope Units

All trend slopes expressed in **units per week** (cm/week for deviation, °/week for rotation).

## Calculation Logic Notes

*(Detailed edge case handling to be resolved in implementation plan.)*

- **Trend significance:** Linear regression p-value; "stable" if p ≥ 0.05 or slope magnitude < 0.05 units/week
- **Sustained events:** Group consecutive sessions below threshold; count event only if the span of calendar days ≥ `sustainedThresholdDays`
- **Exercise ranking:** When baseline configured, sort by improvement rate; otherwise by median value (ascending)
- **Minimum session counts:** Sections with insufficient data (e.g., <3 sessions for trend, <2 exercise types for recommendations) should display a clear "insufficient data" message rather than empty or misleading output

## Implementation Dependencies

- **React Router** — replace `activePage` state in `App.tsx`; update History page to read URL params for pre-applied filters
- **Unified date range picker** — extract and enhance `DateFilterBar` into shared component
- **Statistical utilities** — extend `stats.ts` with: linear regression + p-value, IQR/outlier detection, improvement rate, consistency score
- **IndexedDB migration** — add `reports` object store to `StrabismusDB`
- **New components** — `AnalysisPage`, `ReportGenerationModal`, `ReportDisplay`, report section components

## Future Extensions (Out of Scope for Phase 1)

1. **LLM-generated summaries:** Add optional `llmOutput` field to `ReportSnapshot` for AI-generated text summaries or recommendations
2. **Report caching:** If insight recalculation takes >1s, cache computed insights in `ReportSnapshot`
3. **Comparison mode:** Generate two reports with overlapping charts
4. **Simplified patient report:** Parallel "quick summary" version with plain-language interpretation
5. **Measurement page scheduling:** Recommendations for daily exercise schedule, order, and duration during active therapy sessions
6. **Export:** Generate PDF or clinical note format

## Testing Strategy

1. **Unit tests:** All insight calculation functions (trend + p-value, outlier detection, consistency score, improvement rate, progress percent, sustained events)
2. **Integration tests:** Report generation flow end-to-end, save/load from IndexedDB, drill-down navigation
3. **Edge cases:** No sessions in range, single session, no baseline configured, all sessions in single exercise type, current value already below threshold
