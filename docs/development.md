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

**Adding new metrics:** Update metric color palette in `docs/styling.md`, add to `ViewState` in useViewState.ts, add to TimeSeriesGraph/HistogramChart selectors, handle in histogram binning calculations, update StatCard calculations.

**Modifying state persistence:** Use useViewState setters (toggleHistogramMetric, updateFilters, etc.) which automatically persist to localStorage with 500ms debounce. No manual persistence code needed.

**New display modes:** Add to `histogramDisplayModes` or `timeSeriesDisplayModes` in ViewState interface, implement toggle setter, add UI controls in chart components. Display mode state is preserved across page reloads.

**Modifying filtering:** Call `updateFilters()` from useViewState to persist filter changes. Selection auto-prunes to visible sessions via useEffect in HistoryPage.

**New visualizations:** Use recharts `ComposedChart` for multi-axis; maintain metric colors; follow dark theme pattern from existing components. Integrate with useViewState for state persistence if user-configurable.

**Before large changes:** Create plan doc in `docs/superpowers/plans/`, update relevant docs (architecture.md, styling.md, data-types.md) as you implement changes.

## Known Issues & Technical Debt
- **RotationGraph.tsx:34** — `value` possibly undefined, `toFixed` not on ValueType. Non-blocking, pre-existing.
- SessionDetailPanel & AggregateResultsPanel are deprecated — can be removed
- Resampling/histogram calculations could be memoized for performance

## Build Status
✅ Passes with 1 pre-existing TypeScript warning (RotationGraph)
