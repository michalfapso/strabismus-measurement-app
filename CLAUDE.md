# Strabismus Measurement Application - Architecture & Development Guide

## Project Overview

A React-based application for measuring and analyzing eye position/rotation (strabismus) during eye fusion exercises. Captures real-time position and rotation data, stores sessions, and provides comprehensive analysis with single-session and multi-session aggregate views.

**Tech Stack:** React, TypeScript, Vite, emotion (CSS-in-JS), recharts, IndexedDB

---

## Architecture Overview

### High-Level Flow
```
User Session Recording
    ↓
Live Canvas (AssessmentCanvas) captures position/rotation data
    ↓
SessionContext stores current session + session history
    ↓
Data persisted to IndexedDB
    ↓
History View displays list of sessions with filtering/selection
    ↓
UnifiedSessionPanel analyzes (single or aggregate view)
    ↓
Results shown via TimeSeriesGraph + HistogramChart + TrendChart
```

### Core Components

#### **App.tsx** (Root)
- **Responsibility:** Page routing (Measurement vs History), toolbar, calibration flow
- **Key State:**
  - `activePage: 'measurement' | 'history'` - exclusive page mode (not overlays)
  - `showCalibration` - recalibration modal
  - `canvasData` - live x/y/rotation readings
- **Layout:** Canvas always mounted (state preserved), HistoryPage overlays at z-index 200
- **Navigation:** Top toolbar with mode buttons, visible on all pages

#### **AssessmentCanvas** (Measurement Page)
- **Responsibility:** Real-time eye position/rotation capture and visualization
- **State:** Canvas position, pending data points, accumulated session data
- **Emits:** `onPositionChange` callback with x/y/rotation values
- **Note:** Stays mounted during history view to preserve state; history page overlays it

#### **HistoryPage** (History View)
- **Responsibility:** Session browsing, filtering, selection, data export/delete
- **Structure:** 3-column layout
  - Left (300px): Session list with filter bars + selection bar
  - Right (flex): UnifiedSessionPanel for selected session(s)
- **Features:**
  - Multi-select with Shift+Click range selection (useMultiSelect hook)
  - Date range filtering (DateFilterBar)
  - Exercise type filtering (ExerciseTypeFilterBar)
  - CSV export and session deletion
- **Selection Behavior:**
  - No checkboxes (visual left border indicator for selected rows)
  - Selection persists across filter changes

#### **UnifiedSessionPanel** (NEW - Main Analysis Component)
- **Responsibility:** Unified view for single session OR aggregate (2+ sessions)
- **Determines View Mode:**
  - `isSingleSession = sessions.length === 1`
  - Shows different controls/sections based on mode
- **Sections (in order):**
  1. Header + StatCards (shared both views)
  2. TimeSeriesGraph (multi-metric visualization)
  3. HistogramChart (duration distribution by bins)
  4. TrendChart (aggregate-only, bottom)

#### **TimeSeriesGraph** (NEW)
- **Responsibility:** Multi-metric time-series visualization
- **Metrics Supported:** Deviation (√x²+y²), X, Y, Rotation
- **Features:**
  - Metric selector (checkboxes, any subset)
  - Dual y-axes: cm (position) on left, degrees (rotation) on right
  - Single session: raw data resampled to fixed time grid
  - Aggregate: individual session lines (thin grey) + mean (thick colored) + stddev bounds (dashed)
  - Aggregate-only: display mode selector (Mean/Std Dev/Individual), time mode selector (Absolute/Relative)
- **Color Scheme:**
  - Deviation: #00FFFF (cyan)
  - X: #FF00FF (magenta)
  - Y: #FF9500 (orange)
  - Rotation: #FFC107 (gold)

#### **HistogramChart** (NEW)
- **Responsibility:** Duration distribution visualization
- **Metric Selector:** Deviation, X, Y, Rotation
- **Bin Sizing:** 1cm for position/deviation, 1° for rotation
- **Calculation:** For each data point, calculates duration until next point, sums per bin
- **Display Modes (aggregate):** Mean (mean metric distribution) vs Individual (summed durations)
- **Y-Axis:** Duration in seconds (calculated from milliseconds)

#### **TrendChart** (NEW)
- **Responsibility:** Trend analysis over multiple sessions
- **Aggregate-Only:** Hidden in single session view
- **Features:** Metric selector, regression slope, trend direction (improving/declining)
- **Located:** Bottom of UnifiedSessionPanel

#### **StatCards**
- **Single Session:** Shows key metrics from useSessionStats hook
- **Aggregate:** Custom implementation showing mean ± stddev across selected sessions
- **Metrics Shown:** Mean Deviation, Rotation Range, X Range, Y Range

### Data Flow & Hooks

#### **SessionContext** (src/context/SessionContext.tsx)
- **Global State:**
  - `currentSession` - in-progress recording
  - `sessions` - loaded session history
  - `showResults` - show results panel after recording
- **Methods:**
  - `startSession(exerciseTag, ppi)` - begin recording
  - `addTimeSeriesPoint(point)` - add data point
  - `endSession()` - save and finalize
  - `loadHistoricalSessions()` - retrieve from IndexedDB
  - `deleteSelectedSessions(ids)` - remove from storage

#### **CalibrationContext** (src/context/CalibrationContext.tsx)
- **State:** Current calibration data (PPI, methods tried)
- **Methods:** PPI calibration, method-specific adjustments

#### **Custom Hooks**

**useMultiSelect** (src/hooks/useMultiSelect.ts)
- Multi-select with anchor-based range selection (Shift+Click)
- Manages `selectedIds: Set<string>` and `anchorId: string | null`
- **Key Behavior:**
  - Plain click: select only that item, set anchor
  - Ctrl+click: toggle item, move anchor
  - Shift+click: select range from anchor to clicked (anchor doesn't move)
  - `updateSelectionAfterFilter`: keep selected items that match new filter criteria

**useHistoryFilters** (src/hooks/useHistoryFilters.ts)
- Manages date range + exercise type filtering
- Persists filters to sessionStorage
- **Returns:** `filteredSessions`, distinct exercise types, setters

**useSessionStats** (src/hooks/useSessionStats.ts)
- Calculates mean/stddev for single session metrics

**useCalibration** (src/hooks/useCalibration.ts)
- Wraps CalibrationContext

**useSession** (src/hooks/useSession.ts)
- Wraps SessionContext

### Storage & Persistence

#### **IndexedDB** (src/services/storage.ts)
- Database: `StrabismusDB`
- Store: `sessions`
- Key: `sessionId` (UUID)
- Value: Full Session object (type, exercise tag, timestamp, timeSeries array, PPI)
- Operations: `saveSession`, `getAllSessions`, `deleteSession`, `getSession`

#### **sessionStorage** (useHistoryFilters)
- Persists: date range filter, exercise type filter selections
- Automatically restores on page reload

### Time Handling

#### **Time Formatting** (src/utils/timeFormatting.ts)
- **Format:** Milliseconds → seconds with 2 decimal places
- **Function:** `formatTimeSeconds(ms: number): string` → "0.05s", "1.23s", etc.
- **Applied To:** X-axis labels, tooltips in TimeSeriesGraph
- **Important:** All time-series data is stored in milliseconds internally, formatted to seconds for display

#### **Time Grid Resampling** (src/components/TimeSeriesGraph.tsx & src/utils/histogram.ts)
- **Purpose:** Align multiple sessions to common time points with linear interpolation
- **Grid:** Fixed sampling interval (~50ms), target ~200 samples max per chart
- **Method:** Linear interpolation between consecutive data points for each metric independently
- **Result:** Smooth curves without oscillation from different sampling rates

### Color & Styling

#### **Theme Colors**
- **Primary UI:** Green (#00ff00) for active states, borders, buttons
- **Dark Background:** rgba(10, 10, 10, 0.98) - very dark grey
- **Text:** #fff for headers, #888 for secondary text
- **Borders:** rgba(255,255,255,0.1) for subtle dividers

#### **Metric Colors** (TimeSeriesGraph, HistogramChart, TrendChart)
- **Deviation:** #00FFFF (bright cyan)
- **X:** #FF00FF (magenta)
- **Y:** #FF9500 (orange)
- **Rotation:** #FFC107 (gold)

#### **Data Visualization Colors**
- **Individual Session Lines:** rgba(180,180,180,0.3) - thin grey
- **Mean Line:** metric color at 3px width
- **Stddev Bounds:** metric color at 1.5px dashed
- **Histogram Bars:** metric color with full opacity

#### **CSS-in-JS (emotion)**
- All styles use emotion's `css` function
- Prefixed with `&&` for specificity where needed
- Dark theme applied globally via component inline styles

---

## Key Implementation Patterns

### Single vs Aggregate View Logic
```typescript
// In UnifiedSessionPanel & subcomponents:
const isSingleSession = sessions.length === 1;

// Conditional rendering:
{isSingleSession ? <SingleView /> : <AggregateView />}
{!isSingleSession && <AggregateOnlyFeature />}
```

### Multi-Metric Handling in TimeSeriesGraph
- Each metric is **independently resampled** to fixed time grid
- When rendering: dynamically create Line components for each selected metric
- Y-axis assignment: position metrics (deviation/x/y) → yAxisId="cm", rotation → yAxisId="degrees"

### Histogram Bin Calculation
- Extract metric values from session.timeSeries
- Calculate duration for each point (time until next point)
- Assign to appropriate bin based on value
- Sum durations per bin across all sessions/data points

### Stat Card Calculation
- **Single:** Uses `useSessionStats` hook (calculates for one session)
- **Aggregate:** Custom calculation loops through all selected sessions, calculates individual stats, then mean/stddev of those stats

### Time Mode (Absolute vs Relative)
- **Absolute:** Time in milliseconds (formatted to seconds), x-axis: 0 to maxTime
- **Relative:** Time as % of session duration, x-axis: 0 to 100

---

## Recent Major Changes (Unified Session View Refactoring - 2026-03-29/30)

### Components Created
1. **UnifiedSessionPanel.tsx** - Merged SessionDetailPanel + AggregateResultsPanel
2. **TimeSeriesGraph.tsx** - Enhanced overlay with multi-metric, dual y-axes
3. **HistogramChart.tsx** - New duration distribution visualization
4. **TrendChart.tsx** - Extracted from AggregateResultsPanel as standalone

### Components Deprecated
- **SessionDetailPanel.tsx** - Functionality moved to UnifiedSessionPanel (kept for reference)
- **AggregateResultsPanel.tsx** - Functionality moved to UnifiedSessionPanel (kept for reference)

### Utilities Created/Updated
1. **src/utils/timeFormatting.ts** - Centralized time formatting (ms → seconds with 2 decimals)
2. **src/utils/histogram.ts** - Histogram bin calculation and duration aggregation

### Key Improvements
- Single and aggregate views now share unified base layout
- Multi-metric visualization with proper y-axis separation
- Consistent time formatting across all visualizations
- Improved data resampling for smooth multi-session charts
- New histogram analysis for understanding fusion duration

---

## Known Issues & Technical Debt

### Pre-Existing Issues
- **RotationGraph.tsx:** TypeScript error (line 34) - `value` possibly undefined, `toFixed` not on ValueType
  - Not critical for main features, doesn't block build
  - Suggests RotationGraph may need refactoring for type safety

### Potential Improvements
- SessionDetailPanel & AggregateResultsPanel can be fully removed (currently marked deprecated)
- RotationGraph should be fixed or refactored for type safety
- Consider extracting stat calculation logic to utility functions
- Consider memoization of expensive resampling/histogram calculations

### Performance Notes
- Resampling logic is efficient but could be memoized for non-changing sessions
- Histogram binning is O(n) per session - acceptable for typical session counts (< 100s)
- recharts renders smoothly even with many data series

---

## Development Workflow

### Building
```bash
npm run build          # TypeScript + Vite
npm run dev           # Development server
npm run preview       # Build preview
```

### Testing
- Unit tests use Vitest
- Components tested via browser (no automated UI tests currently)
- Manual testing checklists in TASK_6_TESTING_RESULTS.md

### Git Workflow
- Feature branches for major work
- Subagent-driven development used for complex tasks
- Regular commits with detailed messages
- Plan documents created for architectural changes

### Code Style
- TypeScript strict mode
- emotion for CSS (not inline styles for complex layouts)
- Functional components with hooks
- Props interfaces named `ComponentNameProps`

---

## File Structure Overview

```
src/
├── components/          # React components
│   ├── App.tsx         # Root, page routing
│   ├── AssessmentCanvas.tsx
│   ├── HistoryPage.tsx  # Session browser
│   ├── UnifiedSessionPanel.tsx  # NEW - single/aggregate analysis
│   ├── TimeSeriesGraph.tsx      # NEW - multi-metric visualization
│   ├── HistogramChart.tsx       # NEW - duration distribution
│   ├── TrendChart.tsx           # NEW - extracted trend analysis
│   ├── StatCards.tsx
│   ├── SelectionBar.tsx
│   ├── HistoryListView.tsx
│   ├── DateFilterBar.tsx
│   ├── ExerciseTypeFilterBar.tsx
│   ├── SessionDetailPanel.tsx   # DEPRECATED
│   ├── AggregateResultsPanel.tsx # DEPRECATED
│   └── ...other components
├── context/             # React Context
│   ├── SessionContext.tsx
│   ├── CalibrationContext.tsx
│   └── ...
├── hooks/              # Custom React hooks
│   ├── useMultiSelect.ts
│   ├── useHistoryFilters.ts
│   ├── useSessionStats.ts
│   ├── useCalibration.ts
│   └── useSession.ts
├── services/           # Business logic
│   ├── storage.ts      # IndexedDB operations
│   ├── stats.ts        # Statistical calculations
│   ├── export.ts       # CSV export
│   └── ...
├── utils/              # Utility functions
│   ├── timeFormatting.ts    # NEW - time formatting
│   ├── histogram.ts         # NEW - histogram calculations
│   └── ...
├── types.ts            # TypeScript type definitions
└── index.css           # Global styles (minimal)
```

---

## Important Data Types

### **Session** (src/types.ts)
```typescript
interface Session {
  sessionId: string;           // UUID
  timestamp: string;           // ISO date string
  exerciseTag: string;         // Exercise name
  ppi: number;                 // Pixels per inch (calibration)
  timeSeries: TimeSeries[];    // Array of data points
}

interface TimeSeries {
  t: number;      // Time in milliseconds (0-based)
  x: number;      // X position in cm
  y: number;      // Y position in cm
  r: number;      // Rotation in degrees
}
```

### **CalibrationData**
```typescript
interface CalibrationData {
  ppi: number;         // Pixels per inch (derived from calibration)
  lastMode?: string;   // Last calibration method used
}
```

---

## Tips for Future Development

1. **When Adding New Metrics:**
   - Update color palette if new metric
   - Add metric option to metric selector in TimeSeriesGraph
   - Handle in histogram binning logic
   - Update stat card calculations

2. **When Modifying Filtering:**
   - Remember `updateSelectionAfterFilter` in useMultiSelect - it keeps compatible selections
   - Check if sessionStorage persistence is needed

3. **When Working with Time:**
   - Always use `formatTimeSeconds()` for display
   - Store internally as milliseconds
   - For resampling, use interpolation from utils or TimeSeriesGraph

4. **For New Visualizations:**
   - Use recharts ComposedChart for multi-axis needs
   - Maintain metric colors for consistency
   - Add dark theme styling (check existing components for pattern)

5. **Before Large Changes:**
   - Create architecture plan document (docs/superpowers/plans/)
   - Use subagent-driven-development for multi-task work
   - Mark old components as deprecated before removal

---

## Questions to Ask When Taking Over

- What is the current measurement accuracy/calibration status?
- Are there any hardware-specific issues with position detection?
- What's the typical session duration and data volume?
- Should historical data be migrated to a backend database?
- Are there performance concerns with large session collections?
- Should aggregate analysis support weighted/normalized comparisons?

---

**Last Updated:** 2026-03-30
**Current Status:** Production-ready (Unified Session View complete)
**Test Coverage:** Manual testing comprehensive, no automated test suite
**Build Status:** ✅ Passes with 1 pre-existing TypeScript warning (RotationGraph)
