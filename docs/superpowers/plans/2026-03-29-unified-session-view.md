# Unified Session & Aggregate View Refactoring

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Merge single-session and aggregate-session views into a unified interface with shared base layout, enhanced metrics visualization, and new histogram analysis.

**Architecture:**
- Single component (`UnifiedSessionPanel`) handles both 1 and multiple sessions
- Shared top section (stat cards) for both views
- Enhanced time-series graph with multi-metric support and dual y-axes
- Aggregate-only sections: trend graph (bottom) and time mode selector
- New histogram graph showing duration distribution by variable ranges

**Tech Stack:** React, recharts, TypeScript

---

## Key Features

### 1. Unified View Component
- Replace `SessionDetailPanel` and `AggregateResultsPanel` with single `UnifiedSessionPanel`
- Determine view mode based on session count: `selectedCount === 1` vs `selectedCount > 1`
- Share stat cards and base layout for both modes

### 2. Enhanced Time-Series Graph
Shows multiple selectable metrics with proper y-axis management:

**Metric Selector (always visible):**
- Checkboxes: `Deviation`, `X`, `Y`, `Rotation` (any subset can be selected)
- Each metric gets distinct color:
  - Deviation: light cyan `#4ECDC4`
  - X: green `#00ff00`
  - Y: red `#FF6B6B`
  - Rotation: yellow `#ffff00`

**Y-Axes:**
- Primary (left): Centimeters - for Deviation, X, Y
- Secondary (right): Degrees - for Rotation

**Aggregate-View-Only Controls:**
- Additional selector switches: `Mean` / `Std Dev` / `Individual` (any subset)
- Time mode selector: `Absolute` / `Relative` (hidden in single-session view)

**Single-Session-View:**
- Shows only the selected metric(s) for that session
- No time mode selector
- No mean/stddev/individual switches

### 3. Time Formatting
- All time displays: change from milliseconds to **seconds with 2 decimal places**
- Examples: `0.05s`, `1.23s`, `45.67s` instead of `50ms`, `1230ms`, `45670ms`
- Update time grid labels and tooltips

### 4. Trend Graph
- Currently in middle of AggregateResultsPanel
- Move to bottom, make aggregate-only
- Keep existing functionality (metric selector, trend line, regression)

### 5. New Histogram Chart
**Purpose:** Show duration in each variable range (how long eyes stayed in each bin)

**Structure:**
- Metric selector: `Deviation` / `X` / `Y` / `Rotation`
- X-axis: The selected variable split into fixed-size bins
- Y-axis: Duration in seconds
- Bars show total time spent in each bin range

**Implementation:**
- Auto-determine bin size based on variable range (e.g., 1cm or 5cm for position, 5° for rotation)
- Calculate duration for each data point (time until next point)
- Sum durations per bin
- Display as bar or histogram

**Single vs Aggregate:**
- Single session: shows one histogram for that session
- Aggregate: can switch between Mean / Std Dev / Individual (like the overlay)

---

## File Structure & Changes

```
src/components/
├── UnifiedSessionPanel.tsx          [NEW] - replaces SessionDetailPanel + AggregateResultsPanel
├── TimeSeriesGraph.tsx              [NEW] - enhanced overlay chart with metric selector
├── HistogramChart.tsx               [NEW] - duration distribution by bins
├── TrendChart.tsx                   [MOVE to TimeSeriesGraph section, aggregate-only]
├── StatCards.tsx                    [KEEP, import into UnifiedSessionPanel]
├── HistoryPage.tsx                  [MODIFY] - render UnifiedSessionPanel instead of conditionals
├── SessionDetailPanel.tsx           [DEPRECATE] - functionality moved to UnifiedSessionPanel
├── AggregateResultsPanel.tsx        [DEPRECATE] - functionality moved to UnifiedSessionPanel
└── ...other existing files...

src/utils/
├── histogram.ts                     [NEW] - bin calculation and duration aggregation
└── timeFormatting.ts                [NEW or UPDATE] - format time in seconds
```

---

## Component Props & Data Flow

### UnifiedSessionPanel
```typescript
interface UnifiedSessionPanelProps {
  sessions: Session[];  // 1 for single, 2+ for aggregate
  isSingleSession: boolean;  // derived from sessions.length
}
```

Returns:
- Stat cards (top, shared)
- Time-series graph with enhanced controls
- Histogram chart (below time-series)
- Trend graph (bottom, aggregate-only)

### TimeSeriesGraph
```typescript
interface TimeSeriesGraphProps {
  sessions: Session[];
  selectedMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>;
  onMetricsChange: (metrics: Set<...>) => void;
  // Aggregate-only:
  displayMode?: 'mean' | 'stddev' | 'individual'; // or any subset
  onDisplayModeChange?: (mode: string[]) => void;
  timeMode?: 'absolute' | 'relative';
  onTimeModeChange?: (mode: 'absolute' | 'relative') => void;
}
```

### HistogramChart
```typescript
interface HistogramChartProps {
  sessions: Session[];
  selectedMetric: 'deviation' | 'x' | 'y' | 'rotation';
  onMetricChange: (metric: ...) => void;
  // Aggregate-only:
  displayMode?: 'mean' | 'individual';
  onDisplayModeChange?: (mode: ...) => void;
}
```

---

## Implementation Breakdown

### Task 1: Create UnifiedSessionPanel Structure
- New component that wraps stat cards, graphs, etc.
- Determine single vs aggregate based on `sessions.length`
- Integrate StatCards at top
- Placeholder sections for graphs
- Update HistoryPage.tsx to use UnifiedSessionPanel

### Task 2: Create TimeSeriesGraph Component
- Extract and enhance current OverlayChart logic
- Implement multi-metric selector with checkboxes
- Add dual y-axis (cm and degrees)
- Color-code metrics
- Add aggregate-view controls (mean/stddev/individual switches, time mode)
- Implement resampling for all metrics (not just one)

### Task 3: Implement Time Formatting
- Create time formatting utility (seconds with 2 decimals)
- Update TimeSeriesGraph x-axis labels
- Update tooltips
- Update TrendChart if applicable
- Update HistogramChart

### Task 4: Create HistogramChart Component
- Design histogram calculation logic
- Auto-determine bin sizes per metric
- Calculate duration per bin
- Implement recharts-based visualization
- Add metric selector
- Support single and aggregate views (with mean/individual)

### Task 5: Move TrendChart & Reorganize Layout
- Keep TrendChart as-is (bottom, aggregate-only)
- Arrange UnifiedSessionPanel sections:
  1. Stat cards
  2. Time-series graph (TimeSeriesGraph)
  3. Histogram chart (HistogramChart)
  4. Trend graph (TrendChart, aggregate-only)
- Hide/show components based on view mode

### Task 6: Cleanup & Testing
- Remove old SessionDetailPanel and AggregateResultsPanel (or deprecate)
- Update HistoryPage to only use UnifiedSessionPanel
- Test single session view
- Test aggregate view with 2+ sessions
- Verify all toggles work correctly

---

## Design Details

### Metric Colors
```
Deviation: #00FFFF (bright cyan)
X:         #FF00FF (magenta)
Y:         #FF9500 (orange)
Rotation:  #FFC107 (gold)
```

### Time Formatting Examples
- Raw: `50ms` → Formatted: `0.05s`
- Raw: `1250ms` → Formatted: `1.25s`
- Raw: `45670ms` → Formatted: `45.67s`

### Y-Axis Units
- Centimeters (left axis): Deviation, X, Y measured in cm
- Degrees (right axis): Rotation measured in degrees
- Both shown simultaneously when relevant metrics are selected

### Histogram Bin Sizing
- **Deviation**: 1cm bins (0-1cm, 1-2cm, 2-3cm, etc.)
- **X, Y**: 1cm bins
- **Rotation**: 1° bins (0-1°, 1-2°, 2-3°, etc.)
- Auto-adjust if range is very large (e.g., use 5cm bins)

---

## Critical Implementation Notes

1. **Resampling for Multi-Metrics**: When displaying multiple metrics, each needs resampling to the same time grid with linear interpolation
2. **Y-Axis Management**: recharts `ComposedChart` supports multiple YAxis with `yAxisId`. Configure one with unit "cm" and one with "°"
3. **Color Consistency**: Use same colors across all graphs for each metric
4. **Aggregate Statistics**: When showing mean/stddev for multiple metrics, calculate independently per metric
5. **Single Session**: No need for mean/stddev logic, just show raw data
6. **Histogram Duration**: Each data point's "duration" = time until next point; last point = 0 or session duration

---

## Testing Checklist

- [ ] Single session view shows stat cards + time-series + histogram (no trend, no time mode)
- [ ] Aggregate view shows stat cards + time-series + histogram + trend (with time mode selector)
- [ ] Metric selector works (checkboxes for deviation/x/y/rotation)
- [ ] Colors consistent across graphs
- [ ] Dual y-axis renders correctly (cm on left, degrees on right)
- [ ] Time formatting shows seconds with 2 decimals
- [ ] Aggregate mode switches (mean/stddev/individual) work
- [ ] Time mode (absolute/relative) hides in single session
- [ ] Histogram shows correct bin distribution
- [ ] All graphs smooth (resampling working)
- [ ] Tooltips display correct formatted time and values

