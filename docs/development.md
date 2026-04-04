# Development Guide

## Commands
```bash
npm run dev       # Dev server
npm run build     # TypeScript + Vite build
npm run preview   # Preview production build
```

## Testing
- Unit tests: Vitest
- UI testing: manual (no automated UI tests)
- Manual test checklists in TASK_6_TESTING_RESULTS.md

## Git Workflow
- Feature branches for major work
- Plan documents in `docs/superpowers/plans/` before large changes
- Mark components deprecated before removal

## Code Style
- TypeScript strict mode
- emotion for CSS (not inline styles for complex layouts)
- Functional components with hooks

## Tips for Future Development

**Global Settings System:** Metrics and thresholds are managed globally at `src/utils/globalSettings.ts` (localStorage key: `'strabismus_global_settings'`). Call `getGlobalSettings()` to read, `setGlobalSettings()` to write. App enforces at least one metric is always selected. All analysis views read from here; no local metric config.

**Adding new metrics:** Update metric color palette in `docs/styling.md`, add to `GlobalSettings` interface, add to AnalysisMetricsBanner labels, handle in TimeSeriesSegmentationGraph's metric color mapping, update histogram binning calculations.

**Modifying state persistence (View State):** Use useViewState setters (toggleHistogramMetric, updateFilters, etc.) which automatically persist to localStorage with 500ms debounce. No manual persistence code needed. ⚠️ Pre-existing issue: `useViewState` serializes `Infinity` as `null` via JSON.stringify; dateRange[1] can become epoch (1970) after reload if not handled.

**New display modes:** Add to `histogramDisplayModes` or `timeSeriesDisplayModes` in ViewState interface, implement toggle setter, add UI controls in chart components. Display mode state is preserved across page reloads.

**Modifying filtering:** Call `updateFilters()` from useViewState to persist filter changes. Selection auto-prunes to visible sessions via useEffect in HistoryPage.

**Time Series + Segmentation Graph:** TimeSeriesSegmentationGraph renders raw data (solid line) + smoothed data (dashed, 70% opacity) + state blocks. Supports multiple stacked metrics with cross-metric hover (vertical indicator + overlay popup). State segmentation uses FSM classification with `MIN_SEGMENT_DURATION = 0.25s` — short segments are filtered, neighbors stretch to fill gaps, consecutive same-state segments merge.

**Segmentation Parameters:** FSM constants are defined in `src/utils/sessionMetrics.ts` (lines 106–116):
- `SHORT_SLOPE_WINDOW_S = 0.5` — rapid change detection (0.5 second window)
- `LONG_SLOPE_WINDOW_S = 5.0` — slow trend detection (5.0 second window)
- `SHORT_SLOPE_THRESHOLD = 1.0` — rapid motion threshold (cm/s), triggers APPROACHING/DRIFTING via short window
- `LONG_SLOPE_THRESHOLD = 0.02` — slow motion threshold (cm/s), triggers APPROACHING/DRIFTING via long window
- `MIN_SEGMENT_DURATION = 0.25` — segments shorter than 0.25s are filtered and merged

**Dual-timescale detection:** APPROACHING and DRIFTING states are triggered by OR logic: either fast changes (shortSlope threshold) OR slow sustained trends (longSlope threshold). Window sizes are automatically converted to data points based on actual sampling rate via `computeSamplingRate()`. Slopes are computed in cm/point and converted to cm/s for threshold comparison.

**Boundary refinement:** After classification, state transitions are refined post-hoc using short-window slope crossing scans within a ±2.5s bracket to achieve ±0.25s precision. This compensates for the ~2.5s lag introduced by the centered 5-second window.

**Segment quality metrics:** Each segment carries a `SegmentMetrics` object (optional field `metrics` on StateSegment) with:
- `medianDeviation` — median deviation within the segment
- `minDeviation`, `maxDeviation` — range bounds
- `meanDeviation`, `varianceWithinSegment`, `stdDevWithinSegment` — statistical properties
- `intraSegmentSlope` — rate of change within the segment (cm/s), computed via long-window slope

To inspect metrics for debugging: in browser DevTools, check `window.lastSegments` (logged by classifyStates) or export session data and parse the metrics array.

**Segmentation debugging:** `classifyStates()` in `src/utils/sessionMetrics.ts` logs detailed classification data: candidate segments, stretching operations, merging results, and 100% coverage verification. Open browser DevTools console when viewing sessions to inspect. With segment metrics now enabled, logs include computed quality values for each segment (median, min, max, variance, intra-slope). Check metrics for segments near state transitions to understand why a particular state was assigned.

**New visualizations:** Use recharts `ComposedChart` for multi-axis; maintain metric colors; follow dark theme pattern from existing components. Integrate with global settings and useViewState for state persistence if user-configurable.

**Before large changes:** Create plan doc in `docs/superpowers/plans/`, update relevant docs (architecture.md, styling.md, data-types.md) as you implement changes.

## Known Issues & Technical Debt

### Pre-existing
- **RotationGraph.tsx:34** — `value` possibly undefined, `toFixed` not on ValueType. Non-blocking, pre-existing.
- SessionDetailPanel & AggregateResultsPanel are deprecated — can be removed
- Resampling/histogram calculations could be memoized for performance
- **useViewState.ts** — `dateRange` upper bound (`Infinity`) serializes to `null` via JSON.stringify. After page reload, becomes epoch (1970), potentially hiding sessions. Not critical since date filter is optional.

### Text & Contrast
- **Color accessibility:** `#888` has insufficient contrast on `rgba(10,10,10,0.98)` background. Use `#aaa` or lighter for secondary text. Updated THEME.textSecondary to `#aaa`; review components using hardcoded `#888`.

### Session Segmentation
- **MIN_SEGMENT_DURATION = 0.25s** — segments shorter than this are filtered out. After filtering, neighbors stretch to fill gaps, and consecutive same-state segments merge. This is by design to eliminate noise. If visual gaps appear despite stretching+merging, check console logs from `classifyStates()` to verify 100% coverage.

## Build Status
✅ Passes with 1 pre-existing TypeScript warning (RotationGraph)
