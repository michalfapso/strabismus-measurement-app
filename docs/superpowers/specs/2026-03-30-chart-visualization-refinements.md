# Chart Visualization Refinements

**Date:** 2026-03-30
**Scope:** Fix UI/UX issues and visualization limitations in TimeSeriesGraph, HistogramChart, and TrendChart to improve clarity, reduce visual noise, and provide honest statistical representation of sparse measurement data.

---

## Problem Statement

Recent implementation of unified chart controls revealed several usability and visualization issues:

1. **Visual noise:** Neon green borders on checkboxes/buttons are distracting across all charts
2. **Incomplete Relative time mode:** Only labels change; data isn't actually normalized to 0-100% for alignment
3. **Poor individual series visibility:** Grey + very low opacity makes individual sessions nearly invisible in TimeSeriesGraph
4. **Multi-metric overlap:** TimeSeriesGraph overlays multiple metrics in one graph, causing clutter
5. **Misleading sparse data:** Aggregate histograms show statistics for bins with minimal representation (e.g., showing mean=3s with near-zero variance in a bin where only 1 out of 100 measurements has data)
6. **Hover details unclear:** Tooltips lack coverage info and show too many decimal places
7. **Layout roughness:** Histogram hover background too bright; TrendChart has same visual noise as TimeSeriesGraph

---

## Design Overview

### TimeSeriesGraph

#### Styling Refinements

**Remove neon green borders:**
- Metric checkboxes: Remove outline border; keep bottom border (serves as color legend)
- Time mode buttons ("Absolute" / "Relative"): Remove outline border; indicate active state with lighter background (e.g., 10-15% opacity over base color or neutral grey)

**Rationale:** Bottom border on metrics provides visual legend; lighter background on buttons is subtle state indication without harshness.

#### Relative Time Mode Fix

**Current behavior:** Only x-axis labels change; data remains in wall-clock time.

**New behavior:**
- **Absolute mode:** Each session spans its natural duration on x-axis. Sessions with longer duration take more horizontal space. No normalization.
- **Relative mode:** All sessions stretched to identical x-axis range (0-100% of session duration). This requires **data transformation**:
  - For each session's time series, map data points from `[0, sessionDuration]` to `[0, 100]`
  - Interpolate data density if needed (e.g., if one session has 100 points and another has 5, keep both but let recharts handle spacing)
  - Label x-axis as percentages (0%, 25%, 50%, 75%, 100%)

**Benefit:** Sessions align on time progression, making it easier to see behavioral patterns despite different durations.

#### Individual Series Visibility

**Current:** All individual series grey, opacity ~0.1-0.2 (barely visible)

**New:**
- Color each individual session's line by its metric: cyan (X), magenta (Y), orange (Rotation), gold (Deviation)
- Increase opacity to ~0.6-0.8 (clearly visible but still not overwhelming when many sessions present)
- Keep consistency with TimeSeriesGraph's metric color scheme (from `docs/styling.md`)

#### Multi-Metric Display

**Current:** Multiple selected metrics overlay in a single graph (e.g., X, Y, Rotation all on same chart with same y-axis)

**New:** Display each metric in its own separate graph, stacked vertically
- Each graph: own y-axis scaled to its metric's value range
- Removes visual clutter and makes metric comparison clearer
- User can still select multiple metrics; each gets its own view

#### Hover Tooltip Improvements

**Current:** Shows many decimal places; includes individual session data

**New:**
- Round all numeric values to 2 decimals
- Remove individual session names/data from tooltip
- Show aggregate stats only (if applicable—e.g., mean of selected sessions)

---

### HistogramChart

#### Visualization Replacement: Bar Chart → Box Plots

**Current visualization:** Standard histogram bars (height = mean, error bars = std dev when visible)

**Problem:** With sparse data (e.g., some measurements have no data in certain bins), showing mean + std dev is misleading. A bin with 1 measurement appearing as mean ± near-zero variance suggests confidence that doesn't exist.

**New visualization: Box plots per bin**
- Each bin displays a box plot instead of a bar:
  - **Median:** Horizontal line inside box (or bold section of box)
  - **Quartile box:** 25th-75th percentile boundaries
  - **Whiskers:** Extend to 1.5 × IQR, capped at min/max observed values
  - **Outliers:** Plotted individually as dots
  - **Color:** Match metric color (cyan, magenta, orange, gold)
  - **Opacity:** Full opacity for clarity

**Sample coverage label:**
- Display compact label **directly below each box plot:** "87%" (percentage of measurements with data in that bin)
- **Hover behavior:** Hovering over the "87%" label shows a tooltip/data overlay popup with expanded text: "87% of measurements (n=87 of 100)"
- This makes representativeness explicit and interactive without cluttering the chart

**Metrics:** Keep metric selection as-is (deviation, x, y, rotation toggles)

#### Hover Background Opacity

**Current:** Bright grey background on hover (distracting)
**New:** Reduce opacity to 30% for subtlety

#### Layout

Recent commits (`4b8d3ad`, `54744cf`) have addressed empty space below x-axis. Confirm fixes are present; no further action needed.

---

### TrendChart

#### Styling Alignment

**Current:** Same neon green borders as TimeSeriesGraph

**New:** Apply same styling fix as TimeSeriesGraph:
- Remove outline borders from metric buttons
- Indicate active state with lighter background (10-15% opacity)

---

## Data Flow & Implementation Details

### TimeSeriesGraph Data Transformation (Relative Mode)

```
When Relative mode active:
  For each session's data series:
    sessionDuration = session.endTime - session.startTime
    For each data point (timestamp, value):
      normalizedTime = (timestamp - session.startTime) / sessionDuration * 100
      Keep value unchanged
    Plot with x-axis [0, 100]%
```

### HistogramChart Box Plot Rendering

- Use existing recharts components or `recharts-box-plot` library (TBD from earlier spike)
- If custom: use `Line`, `Area`, and dot components to assemble quartile box + whiskers + outliers
- Sample coverage: calculate `(measurements with data in bin) / (total measurements) * 100`

### Color Consistency

- Both charts use metric colors from `docs/styling.md`:
  - X: cyan (`#00BCD4`)
  - Y: magenta (`#E91E63`)
  - Rotation: orange (`#FF9800`)
  - Deviation: gold (`#FFC107`)
- Apply consistently to individual series (TimeSeriesGraph) and box plots (HistogramChart)

---

## Testing Strategy

### TimeSeriesGraph

**Unit / Component tests:**
- Relative mode: data points correctly normalized to 0-100%; x-axis labels show percentages
- Absolute mode: sessions displayed at natural duration; x-axis shows 0:00 → session end
- Individual series: colored per metric, opacity ~0.6-0.8
- Multi-metric: separate graphs per metric when >1 selected
- Hover tooltip: values rounded to 2 decimals; no individual session data shown

**Manual testing:**
- Switch between Absolute/Relative; verify alignment and x-axis changes
- Select 1, 2, 3+ metrics; verify stacking and y-axis scaling
- Hover over data; verify tooltip format
- Compare sessions of different durations in Relative mode (should align)

### HistogramChart

**Unit / Component tests:**
- Box plot rendering: median, quartiles, whiskers, outliers visible
- Sample coverage label: "87%" displayed; hover shows "87% of measurements (n=87/100)"
- Sparse data: bins with <50% coverage still show accurate box plots (not misleading means)
- Hover opacity: 30% background (not bright)

**Manual testing:**
- Aggregate view with sparse bins (e.g., fusion 3s in 1 measurement, 6cm minimum in another)
- Verify box plots honestly represent distribution without false confidence
- Verify coverage labels are accurate
- Hover and inspect tooltip expansion

### TrendChart

**Component test:**
- Metric buttons: lighter background when active, no outline border

**Manual testing:**
- Toggle metrics; verify visual state indication

---

## Acceptance Criteria

- [ ] TimeSeriesGraph: neon green borders removed; lighter background on Time buttons
- [ ] TimeSeriesGraph: Relative mode data normalized to 0-100%; Absolute shows natural duration
- [ ] TimeSeriesGraph: Individual series colored by metric, opacity ~0.6-0.8
- [ ] TimeSeriesGraph: Multiple metrics show in separate stacked graphs
- [ ] TimeSeriesGraph: Hover tooltip rounded to 2 decimals, no individual session data
- [ ] HistogramChart: Bar chart replaced with box plots per bin
- [ ] HistogramChart: Sample coverage label "87%" displayed; hover shows expanded "87% of measurements (n=87/100)"
- [ ] HistogramChart: Hover background opacity 30%
- [ ] TrendChart: neon green borders removed; lighter background on active metric buttons
- [ ] All color schemes (metric colors) consistent across both charts
- [ ] Unit tests updated/added for all behavioral changes
- [ ] Manual testing completed per strategy above
- [ ] `docs/styling.md` reviewed/updated if color definitions changed

---

## Known Unknowns

- **Box plot library:** `recharts-box-plot` availability, API, bundle size (resolved via earlier spike)
- **Relative mode interpolation:** Strategy for aligning data density across sessions of different durations (likely leave to recharts interpolation)
- **Performance:** Rendering many sessions × multiple metrics may need optimization; defer to post-implementation if observed

---
