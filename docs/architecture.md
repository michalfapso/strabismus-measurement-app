# Architecture

## High-Level Flow
```
AssessmentCanvas (live position/rotation capture)
    ↓
SessionContext (current session + history state)
    ↓
IndexedDB (persistence via storage.ts)
    ↓
HistoryPage (browsing, filtering, multi-select)
    ↓
UnifiedSessionPanel (single or aggregate analysis)
    ↓
TimeSeriesGraph + HistogramChart + TrendChart
```

## Core Components

### App.tsx
- Page routing (`activePage: 'measurement' | 'history'`), toolbar, calibration flow
- Canvas always mounted (state preserved); HistoryPage overlays at z-index 200

### AssessmentCanvas
- Real-time capture: emits `onPositionChange(x, y, rotation)`
- Stays mounted during history view

### HistoryPage
- 3-column layout: left (300px) session list + filters, right (flex) UnifiedSessionPanel
- Multi-select: Shift+Click range, Ctrl+Click toggle (no checkboxes — green left border indicator)
- Selection persists across filter changes via `updateSelectionAfterFilter`
- **Centralized state via `useViewState` hook** — persists to localStorage key `"strabismus_view_state"`

### UnifiedSessionPanel
Single entry point for all analysis. Mode determined by `sessions.length === 1`.
Sections (in order): Header + StatCards → TimeSeriesGraph → HistogramChart → TrendChart (aggregate only)

### Global Settings System (utils/globalSettings.ts)
**Single source of truth for user preferences across the entire app.** Separate from view state — persists to localStorage key `"strabismus_global_settings"`.

**State shape:**
```typescript
interface GlobalSettings {
  selectedMetrics: ('deviation' | 'x' | 'y' | 'rotation')[];  // at least 1 required
  thresholds: {
    deviation?: number;    // default 1.0 cm
    x?: number;           // default 1.0 cm
    y?: number;           // default 1.0 cm
    rotation?: number;    // default 1.0 °
  };
}
```

**Behavior:**
- Initialized with defaults; merged with stored values (allows backward compatibility)
- Used by: SettingsPage (read/write), SingleSessionView (read), MultiSessionAnalysisView (read), AnalysisMetricsBanner (read), TimeSeriesSegmentationGraph (read)
- At least one metric always selected (enforced in SettingsPage validation)
- Changes apply immediately across all views (no confirmation)

**Usage pattern:**
```typescript
const settings = getGlobalSettings();  // read
setGlobalSettings(newSettings);        // write (triggers all consumers to re-render)
```

### useViewState Hook (hooks/useViewState.ts)
Centralized persistent state for HistoryPage analysis view. Replaces scattered state hooks (previously useHistoryFilters, useMultiSelect as primary state).

**State shape:**
```typescript
interface ViewState {
  filters: {
    dateRange: [number, number];      // [fromTime, toTime] in ms
    exerciseType: string | null;       // Single exercise type or null for all
  };
  selectedSessions: Set<string>;       // Session IDs
  histogramMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>;
  histogramDisplayModes: Set<'individual' | 'meanStddev'>;
  timeSeriesMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>;
  timeSeriesDisplayModes: Set<'individual' | 'meanStddev'>;
  timeSeriesTimeMode: 'absolute' | 'relative';
}
```

**Behavior:**
- Initializes from localStorage; falls back to defaults if missing or corrupted
- Debounced saves (500ms) to localStorage after state mutations
- Defaults: histogram shows `deviation` (individual mode), time series shows `deviation` (individual + meanStddev modes)
- At least one metric must be selected (enforcement in toggleHistogramMetric/toggleTimeSeriesMetric)
- Display modes can be empty (optional visualizations)

**Data flow:**
```
UnifiedSessionPanel
  ├─ reads state.filters, state.selectedSessions
  ├─ passes state to TimeSeriesGraph
  │  └─ reads timeSeriesMetrics, timeSeriesDisplayModes, timeSeriesTimeMode
  │  └─ writes via toggleTimeSeriesMetric, toggleTimeSeriesDisplayMode, setTimeSeriesTimeMode
  ├─ passes state to HistogramChart
  │  └─ reads histogramMetrics, histogramDisplayModes
  │  └─ writes via toggleHistogramMetric, toggleHistogramDisplayMode
  └─ passes state to SessionExplorer (left panel)
     └─ reads filters, selectedSessions
     └─ writes via updateFilters, updateSelectedSessions
```

State persists across:
- Page navigation (AssessmentCanvas ↔ HistoryPage)
- Browser reload
- Filter changes (selection auto-prunes to visible sessions)

### TimeSeriesGraph
- Metrics: Deviation (√x²+y²), X, Y, Rotation (configurable via useViewState)
- Dual y-axes: cm (left), degrees (right)
- Single session: raw data resampled to fixed time grid
- Aggregate: thin grey lines per session + thick colored mean + dashed stddev bounds
- **Display modes (independent toggles, can be combined):**
  - **Individual:** thin grey lines per session (opacity 0.3)
  - **Mean & Std Dev:** thick colored mean line (2.5px) + dashed stddev bounds (opacity 0.5)
- Time mode: Absolute (elapsed seconds) or Relative (% of session duration)
- All controls integrated with useViewState for persistence

### HistogramChart
- Bin size: 1cm for position/deviation, 1° for rotation
- Y-axis: duration in seconds (summed from ms timestamps)
- Metrics: configurable multi-select via checkboxes (previously radio buttons)
- **Display modes (independent toggles, can be combined):**
  - **Individual:** thin grey horizontal lines per session per bin (opacity 1)
  - **Mean & Std Dev:** box plot visualization with median, quartiles, whiskers, and outliers (opacity 1)
- Data calculations:
  - Individual mode: sum duration per bin across all sessions
  - Mean & Std Dev mode: calculate statistics (median, Q1, Q3, IQR, whiskers, outliers) per bin
- All controls integrated with useViewState for persistence

### TrendChart
- Aggregate-only (hidden in single session view)
- Regression slope + trend direction (improving/declining)

### StatCards
- Single: from `useSessionStats` hook
- Aggregate: mean ± stddev across all selected sessions
- Metrics: Mean Deviation, Rotation Range, X Range, Y Range

## Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useViewState` | hooks/useViewState.ts | **PRIMARY** — Centralized persistent state for HistoryPage: filters, selections, metrics, display modes. Persists to localStorage. |
| `useMultiSelect` | hooks/useMultiSelect.ts | Anchor-based range selection with Set<string> (legacy; now integrated into useViewState) |
| `useHistoryFilters` | hooks/useHistoryFilters.ts | Date + exercise type filtering, persisted to sessionStorage (legacy; now integrated into useViewState) |
| `useSessionStats` | hooks/useSessionStats.ts | Mean/stddev for single session |
| `useCalibration` | hooks/useCalibration.ts | Wraps CalibrationContext |
| `useSession` | hooks/useSession.ts | Wraps SessionContext |

## Key Patterns

### Single vs Aggregate
```typescript
const isSingleSession = sessions.length === 1;
{isSingleSession ? <SingleView /> : <AggregateView />}
{!isSingleSession && <AggregateOnlyFeature />}
```

### Multi-Metric Resampling
Each metric independently resampled to fixed time grid (~50ms interval, max ~200 samples).
Linear interpolation between consecutive points → smooth curves across sessions.

### Histogram Binning
Per data point: calculate duration until next point → assign to bin → sum per bin across sessions.

### Time Mode (Absolute vs Relative)
- Absolute: ms formatted to seconds, x-axis 0→maxTime
- Relative: % of session duration, x-axis 0→100

## File Structure
```
src/
├── components/
│   ├── App.tsx
│   ├── AssessmentCanvas.tsx
│   ├── HistoryPage.tsx
│   ├── UnifiedSessionPanel.tsx
│   ├── TimeSeriesGraph.tsx
│   ├── HistogramChart.tsx
│   ├── TrendChart.tsx
│   ├── StatCards.tsx
│   ├── SelectionBar.tsx
│   ├── HistoryListView.tsx
│   ├── DateFilterBar.tsx
│   ├── ExerciseTypeFilterBar.tsx
│   ├── SessionDetailPanel.tsx    # DEPRECATED
│   └── AggregateResultsPanel.tsx # DEPRECATED
├── context/
│   ├── SessionContext.tsx
│   └── CalibrationContext.tsx
├── hooks/
├── services/
│   ├── storage.ts   # IndexedDB
│   ├── stats.ts
│   └── export.ts    # CSV
├── utils/
│   ├── globalSettings.ts      # Global metric/threshold configuration (localStorage)
│   ├── sessionMetrics.ts      # FSM state classification, segmentation, metrics computation
│   ├── smoothing.ts           # Moving average & slope calculation
│   ├── timeFormatting.ts
│   └── histogram.ts
├── pages/
│   └── SettingsPage.tsx       # Global metric & threshold UI
├── theme.ts                   # Centralized color palette
├── config.ts                  # Vite base URL export
└── types.ts
```
