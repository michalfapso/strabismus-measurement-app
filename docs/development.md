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

**Adding new metrics:** update metric color palette, add to TimeSeriesGraph selector, handle in histogram binning, update StatCard calculations.

**Modifying filtering:** `updateSelectionAfterFilter` in useMultiSelect keeps compatible selections; check if sessionStorage persistence is needed.

**New visualizations:** use recharts `ComposedChart` for multi-axis; maintain metric colors; follow dark theme pattern from existing components.

**Before large changes:** create plan doc in `docs/superpowers/plans/`, use subagent-driven-development for multi-task work.

## Known Issues & Technical Debt
- **RotationGraph.tsx:34** — `value` possibly undefined, `toFixed` not on ValueType. Non-blocking, pre-existing.
- SessionDetailPanel & AggregateResultsPanel are deprecated — can be removed
- Resampling/histogram calculations could be memoized for performance

## Build Status
✅ Passes with 1 pre-existing TypeScript warning (RotationGraph)
