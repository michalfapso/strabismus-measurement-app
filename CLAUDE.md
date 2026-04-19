# Strabismus Measurement Application

Clinical oculomotor assessment tool for eye care professionals (orthoptists, ophthalmologists) to objectively measure binocular fusion during vision therapy.

## What It Measures
- **X, Y** (cm): positional deviation from center
- **Rotation** (°): cyclotorsion
- **Deviation** (√x²+y²): primary clinical measure

## Tech Stack
React · TypeScript · Vite · emotion · recharts · IndexedDB · react-konva

**Deployment:** Offline-first SPA. No backend. Runs entirely in browser.

## Build Commands
```bash
npm run dev       # Dev server
npm run build     # Production build
npm run preview   # Preview build
```

## Exercises Supported
Pencil Push-ups, Brock String, Extreme Rotation, Convergence Jumps, Left/Right-Tendon-Stretch, No Exercise/Control — plus free-text custom tags.

## Typical User Flow
1. **Calibration** (first use): set PPI via credit card or A4 paper → stored to localStorage
2. **Record session**: select exercise → Start → manipulate cross → Stop → auto-saved to IndexedDB
3. **Review**: History page → click session → SingleSessionView shows AnalysisMetricsBanner + SubScoresPanel + TimeSeriesSegmentationGraph + HistogramChart
4. **Compare**: Shift+click multiple sessions → aggregate view adds TrendChart + mean/stddev overlays

## Reference Docs
- `docs/architecture.md` — read when creating/refactoring components, tracing data flow, or needing an architecture overview
- `docs/data-types.md` — read when working with sessions, storage, or time-series data
- `docs/styling.md` — read when adding UI elements or new metrics
- `docs/development.md` — read when setting up workflows, debugging known issues, or adding new features

When making architectural changes, update the relevant file in `docs/`.

## Component Conventions

Add `data-component="ComponentName"` to root element of each component for Playwright debugging. See `docs/styling.md`.
