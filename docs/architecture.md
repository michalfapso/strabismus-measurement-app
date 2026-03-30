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

### UnifiedSessionPanel
Single entry point for all analysis. Mode determined by `sessions.length === 1`.
Sections (in order): Header + StatCards → TimeSeriesGraph → HistogramChart → TrendChart (aggregate only)

### TimeSeriesGraph
- Metrics: Deviation (√x²+y²), X, Y, Rotation
- Dual y-axes: cm (left), degrees (right)
- Single session: raw data resampled to fixed time grid
- Aggregate: thin grey lines per session + thick colored mean + dashed stddev bounds
- Aggregate-only controls: display mode (Mean/Std Dev/Individual), time mode (Absolute/Relative)

### HistogramChart
- Bin size: 1cm for position/deviation, 1° for rotation
- Y-axis: duration in seconds (summed from ms timestamps)
- Aggregate display modes: Mean distribution vs Individual summed durations

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
| `useMultiSelect` | hooks/useMultiSelect.ts | Anchor-based range selection with Set<string> |
| `useHistoryFilters` | hooks/useHistoryFilters.ts | Date + exercise type filtering, persisted to sessionStorage |
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
│   ├── timeFormatting.ts
│   └── histogram.ts
└── types.ts
```
