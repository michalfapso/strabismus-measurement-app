# Clinical Analysis System Design

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Phase 1 — Improved overview & trend analysis for strabismus measurement data

## Overview

Add a dedicated **Analysis page** to provide clinicians and patients with curated, higher-level insights into measurement data without requiring manual exploration of raw trends. The system generates lightweight report snapshots (configuration only, not cached calculations) that are regenerated on-demand from live session data.

**Key principle:** Report snapshots store only metadata (date range, metrics, thresholds); insights are calculated fresh each time a report is viewed, ensuring data freshness.

## Goals & Success Criteria

1. **Reduce cognitive load** — Users get curated insights instead of raw charts; clinical context is built-in (thresholds, progress indicators)
2. **Support clinical decision-making** — Insights address: progress/trends, exercise effectiveness, session consistency, clinical readiness
3. **Audit trail** — Named, timestamped report history lets clinicians track analysis over time
4. **Extensibility** — Structure designed to accommodate future LLM-generated insights and cached full reports if performance requires

## Architecture

### Data Model

**ReportSnapshot (IndexedDB)**
```typescript
interface ReportSnapshot {
  reportId: string;           // UUID
  name?: string;              // User-provided name (optional)
  dateRange: [number, number];// [fromTime, toTime] in ms
  metrics: ('deviation' | 'rotation')[]; // Selected for analysis
  thresholds: {
    deviation: number;        // Fusion threshold in cm (e.g., 0.5)
    rotation: number;         // Rotation target in degrees (e.g., 1)
  };
  generatedAt: number;        // Timestamp when config was created
}
```

**Insight Structures (calculated at view time)**

```typescript
interface ProgressInsight {
  metric: 'deviation' | 'rotation';
  startValue: number;
  endValue: number;
  change: number;
  percentChange: number;
  trendDirection: 'improving' | 'declining' | 'stable';
  trendSlope: number;        // Per week or per day
  statisticalSignificance: { p: number; significant: boolean };
  improvementRate: number;   // % of sessions showing improvement vs baseline
}

interface ExerciseInsight {
  exerciseTag: string;
  metric: 'deviation' | 'rotation';
  sessionCount: number;
  median: number;
  stddev: number;
  improvementRate: number;   // % sessions showing improvement
  trend?: {
    direction: 'improving' | 'declining' | 'stable';
    slope: number;
  };
}

interface SessionQualityInsight {
  metric: 'deviation' | 'rotation';
  consistencyScore: number;   // 0-100, % within 10% of baseline
  outlierCount: number;
  outliers: Array<{
    sessionId: string;
    value: number;
    deviation: number;       // How far from baseline
    date: string;
    exerciseTag: string;
  }>;
  variabilityInterpretation: string; // Actionable insight
}

interface MilestoneInsight {
  metric: 'deviation' | 'rotation';
  currentValue: number;
  targetThreshold: number;
  progressPercent: number;   // (startValue - currentValue) / (startValue - target) * 100
  sustainedThresholdEvents: Array<{
    startDate: string;
    endDate: string;
    durationDays: number;
  }>;
  readinessIndicators: string[]; // e.g., ["Sustained fusion achieved", "Ready for phase 2"]
}
```

### Page Structure

**New "Analysis" tab** in main navigation (alongside Measurement and History)

**Layout: Two-column split**

**Left panel (300px, fixed width):**
- "Generate New Report" button at top
- Report history list (sorted by date, newest first)
  - Each item shows: name (or auto-generated), date range, metrics
  - Click to load report in right panel
  - Optional: delete/edit actions per report

**Right panel (flex):**
- When no report selected: "Select a report or generate a new one" message
- When report loaded: Full report display with all sections expanded by default
- Report metadata at top: name, date range, generation date, metrics, thresholds
- Four report sections (see below)

### Report Generation Flow

1. User clicks "Generate New Report"
2. Modal opens with:
   - **Date range picker** (unified with History page implementation)
     - Preset buttons: "Last week", "Last 4 weeks", "All available data"
     - Custom date inputs (from/to) for manual selection
     - Shows available data range as hint
   - **Metrics selection** — Checkboxes for Deviation, Rotation
     - At least one required; defaults to Deviation checked
   - **Thresholds** — Required input fields (form won't submit without both)
     - "Fusion threshold (cm)" — default 0.5, with clinical explanation
     - "Rotation target (°)" — default 1, with clinical explanation
3. User clicks "Generate"
4. System:
   - Validates inputs
   - Fetches sessions in date range
   - Calculates all insights from live data
   - Displays report in right panel
5. User can optionally save:
   - Toggle: "Save this report"
   - Text input: "Report name" (auto-named if blank: "Report — [date range]")
   - Click "Save" → ReportSnapshot stored in IndexedDB, added to history list
6. If user navigates away without saving, report is discarded

### Report Display: Sections

All sections expanded by default. Each includes simplified visualizations (not interactive), with drill-down links to full interactive charts in History view.

**Section A: Progress & Trend**
- **Simplified line chart:** Selected metric(s) over time with trend line
- **Summary stats box:**
  - Start value, end value, absolute change, % change
  - Trend direction (improving/declining/stable)
  - Statistical significance (p-value, highlight if significant)
  - Improvement rate (% of sessions showing improvement vs baseline)
- **Interpretation:** Brief clinical summary (e.g., "Significant improvement, p=0.03, exceeding target rate")

**Section B: Exercise Effectiveness**
- **Ranked table:** Exercises sorted by effectiveness (median deviation)
  - Columns: Exercise name, session count, median, stddev, improvement rate, trend
  - Visual indicator: ▲/▼/→ for trend direction
- **Interpretation:** Which exercises are most effective; flag underperforming ones
- **Drill-down link:** "View detailed comparison in History"

**Section C: Session Quality & Consistency**
- **Consistency score** (0-100): % of sessions within 10% of baseline
- **Outlier analysis:**
  - Count of outliers
  - Table: outlier sessions with date, value, deviation from baseline, exercise tag
- **Variability interpretation:** Actionable insight (e.g., "High variability suggests fatigue or environmental factors — consider shorter, more frequent sessions")

**Section D: Milestones & Readiness**
- **Progress toward goal:**
  - Current value, target threshold, progress % (0-100%)
  - Visual: progress bar showing distance to clinical goal
- **Sustained threshold events:**
  - Timeline showing periods when patient maintained values below threshold
  - Duration of each event (e.g., "Below 0.5cm for 5 days")
- **Readiness indicators:**
  - Clinical decision gates (e.g., "Sustained fusion (>72h below threshold) achieved on 3 occasions")
  - Interpretation: What this means for next therapy phase

## UI/UX Details

### Date Range Picker Enhancement

The existing date filter in History page should be unified with the Analysis modal:

- Add preset buttons: "Last week", "Last 4 weeks", "All available data"
- Keep existing custom date inputs
- Show available data range (earliest to latest session) as hint
- Apply same styling and interaction patterns across both pages

### Report History List

- Sorted by generation date (newest first)
- Each item compact: name (or "Report — Jan 15–Feb 15"), generation date
- Hover state: show full details tooltip
- Click to load; optional right-click menu for edit/delete/export (future)

### Threshold Requirements

Thresholds are required (not optional) to:
- Simplify report structures (no conditional logic for missing thresholds)
- Ensure all metrics are clinically contextualized
- Make clinical goals explicit in every report

Default values:
- Deviation: 0.5 cm (standard fusion threshold in orthoptics)
- Rotation: 1° (torsional alignment target)

## Calculation Logic (Not Detailed Here)

Each insight type requires specific statistical calculations:
- Trend slope: linear regression over time
- Statistical significance: p-value from trend test
- Improvement rate: % sessions where metric is lower than baseline
- Consistency score: % sessions within 10% of first value
- Outliers: values beyond 1.5×IQR or similar statistical method
- Sustained events: continuous periods below threshold with minimum duration

*(Detailed formulas and edge cases to be defined in implementation plan.)*

## Future Extensions (Out of Scope for Phase 1)

1. **LLM-generated summaries:** Optional field in ReportSnapshot for LLM output (text summaries, recommendations)
2. **Report caching:** If report generation takes >1s, cache full insights in ReportSnapshot
3. **Comparison mode:** Generate two reports, display side-by-side or overlay
4. **Simplified patient report:** Parallel "quick summary" version for non-clinical audience
5. **Exercise recommendations:** Suggest next exercises based on effectiveness analysis
6. **Export:** Generate PDF or clinical note format

## Implementation Dependencies

- Date range picker component (exists in History, needs unification)
- Statistical calculation utilities (existing stats.ts may need enhancement)
- IndexedDB schema migration (add Reports store)
- React Router: new /analysis route

## Testing Strategy

1. **Unit tests:** Insight calculation functions (trend, outliers, consistency)
2. **Integration tests:** Report generation workflow, save/load from IndexedDB
3. **Visual regression:** Report section layouts with sample data
4. **Edge cases:** Empty data ranges, single session, extreme threshold values

## Success Metrics

- Clinicians can generate a useful overview in <30 seconds
- Insights are actionable (exercise recommendations, readiness flags clear)
- Report history allows tracking analysis over time
- No regression in existing History page functionality
