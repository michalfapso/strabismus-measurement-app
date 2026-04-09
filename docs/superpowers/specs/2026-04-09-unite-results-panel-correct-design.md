# Design: ResultsPanel wraps SingleSessionView

**Date:** 2026-04-09

## Problem

The Stop & Save panel (ResultsPanel) currently displays a simple view (StatCards + PositionGraph + RotationGraph), while the History page single session view (SingleSessionView) displays a rich analysis view with TimeSeriesSegmentationGraph (showing smoothing lines and FSM state segmentation visualization) + HistogramChart. Users should see the same detailed analysis in both contexts.

## Goal

Make the Stop & Save panel (ResultsPanel) display the same rich analysis view as the History page single session view, including the TimeSeriesSegmentationGraph with segmentation visualization.

## Solution

**ResultsPanel becomes a thin container wrapper around SingleSessionView.**

SingleSessionView is refactored to compute SessionMetrics internally, simplifying both ResultsPanel and HistoryPage.

### Changes

#### ResultsPanel
- Simplify to: fixed-width container (800px) + close button header + SingleSessionView
- Remove all unused imports: `useSessionStats`, `prepareSessionGraphData`, `StatCards`, `PositionGraph`, `RotationGraph`, `SubScoresPanel`, `computeSessionMetrics`, `getAnalysisSettings`, `useState`, `useMemo`
- Add import: `SingleSessionView`
- Structure:
  - Outer div: fixed position, 800px width (`min(800px, 100vw)`), flex column layout
  - Header: close button (✕) only, flexShrink: 0 (fixed at top while content scrolls)
  - Content: SingleSessionView wrapped in scrollable div (flex: 1, overflow: auto)

#### SingleSessionView
- Add internal metric computation using `useMemo`
- Change props from `{session, metrics}` to `{session}` only
- Internally calls:
  - `getGlobalSettings()` to get thresholds and selectedMetrics (already done on line 33)
  - `computeSessionMetrics(session, thresholds, primaryMetric)` in a useMemo
- Add error handling: if `computeSessionMetrics` throws (session too short), render a fallback message: "Unable to compute metrics (session may be too short)" — matching existing HistoryPage behaviour
- No other rendering logic changes

#### HistoryPage
- Simplify single-session view rendering to just pass `session` to SingleSessionView
- Remove metric computation logic from HistoryPage (now handled by SingleSessionView)
- Remove unused imports: `getGlobalSettings`, `computeSessionMetrics`
- Keep structure: still renders SingleSessionView for single-session and MultiSessionAnalysisView for multi-session

### Data Flow

```
Stop & Save Click
  ↓
App saves completed session
  ↓
ResultsPanel receives session, sets visible=true
  ↓
ResultsPanel renders:
  ├─ Header: close button (fixed at top)
  └─ Content (scrollable):
      └─ SingleSessionView
          ├─ Computes metrics from session
          ├─ AnalysisMetricsBanner
          ├─ SubScoresPanel
          ├─ TimeSeriesSegmentationGraph (with smoothing lines + segmentation stripe)
          └─ HistogramChart
```

### Layout Structure

```
ResultsPanel (800px fixed position, flex column)
├─ Header (flexShrink: 0, fixed at top)
│  └─ Close button (✕)
└─ Content (flex: 1, overflow: auto, scrolls independently)
   └─ SingleSessionView
      ├─ Header (date, exerciseTag, duration)
      ├─ AnalysisMetricsBanner
      ├─ SubScoresPanel
      ├─ TimeSeriesSegmentationGraph (per metric)
      └─ HistogramChart (per metric)
```

### Code Changes Detail

#### HistoryPage single-session rendering (lines 284-314)

**Before:**
```typescript
const globalSettings = getGlobalSettings();
const primaryMetric = (globalSettings.selectedMetrics.find(
  m => m === 'deviation' || m === 'rotation'
) ?? 'deviation') as 'deviation' | 'rotation';
const thresholds = {
  deviation: globalSettings.thresholds.deviation ?? 1.0,
  rotation: globalSettings.thresholds.rotation ?? 1.0,
};
const metrics = computeSessionMetrics(
  selectedSessions[0],
  thresholds,
  primaryMetric
);
return <SingleSessionView metrics={metrics} session={selectedSessions[0]} />;
```

**After:**
```typescript
return <SingleSessionView session={selectedSessions[0]} />;
```

**Removed imports:**
- `getGlobalSettings` (no longer needed in HistoryPage)
- `computeSessionMetrics` (no longer needed in HistoryPage)

#### Documentation Updates

**CLAUDE.md**
- Line 28 currently says: `UnifiedSessionPanel shows StatCards + TimeSeriesGraph + HistogramChart` — this is wrong on two counts: (1) the component is `SingleSessionView`, not `UnifiedSessionPanel`, and (2) the chart is `TimeSeriesSegmentationGraph`, not `TimeSeriesGraph`
- Update line 28 to: `SingleSessionView shows AnalysisMetricsBanner + SubScoresPanel + TimeSeriesSegmentationGraph + HistogramChart`

**docs/architecture.md**
- Update SingleSessionView description: note that it now computes metrics internally from session prop
- Remove any references to parent components computing metrics before passing to SingleSessionView
- Clarify that ResultsPanel is a simple wrapper container

### Key Design Decisions

**1. Computation location (Option B: SingleSessionView computes internally)**
- SingleSessionView already calls `getGlobalSettings()` internally (line 33)
- Adding metric computation inside is natural encapsulation
- Simplifies both ResultsPanel and HistoryPage (no duplication)
- Tradeoff: Computation is less explicit to callers, but component is self-contained

**2. Close button in ResultsPanel container only**
- Avoids modifying SingleSessionView
- Cleanly separates concerns: SingleSessionView handles analysis, ResultsPanel handles layout
- Close button stays fixed at top via flexbox layout while content scrolls

**3. Width: 800px responsive**
- `min(800px, 100vw)` allows panel to be full-width on mobile if needed
- All components already stack vertically, reflow naturally

## Testing Scope

- Verify ResultsPanel displays close button at top-right
- Verify TimeSeriesSegmentationGraph renders with smoothing lines and segmentation stripe
- Verify HistogramChart renders correctly
- Verify close button dismisses panel
- Verify History page single session view still works correctly after simplification
- Verify no regressions in metric computation or display

## Success Criteria

- ✓ ResultsPanel wraps SingleSessionView with minimal code
- ✓ Stop & Save panel shows TimeSeriesSegmentationGraph (with segmentation visualization)
- ✓ Stop & Save panel shows HistogramChart
- ✓ Close button works and is positioned correctly
- ✓ Content scrolls independently while header stays fixed
- ✓ Panel is 800px wide (responsive to 100vw)
- ✓ SingleSessionView computes metrics internally
- ✓ HistoryPage simplified: only passes `session` to SingleSessionView
- ✓ HistoryPage imports cleaned up (getGlobalSettings, computeSessionMetrics removed)
- ✓ docs/architecture.md updated to reflect new SingleSessionView behavior
- ✓ CLAUDE.md verified/updated if needed
- ✓ All builds succeed, no regressions
