# Data Types & Storage

## Core Types (src/types.ts)

```typescript
interface Session {
  sessionId: string;        // UUID
  timestamp: string;        // ISO date string
  exerciseTag: string;      // Exercise name or custom tag
  ppi: number;              // Pixels per inch (from calibration)
  timeSeries: TimeSeries[];
}

interface TimeSeries {
  t: number;  // Time in milliseconds (0-based)
  x: number;  // X position in cm
  y: number;  // Y position in cm
  r: number;  // Rotation in degrees
}

interface CalibrationData {
  ppi: number;
  lastMode?: string;  // 'credit-card' | 'a4-short' | 'a4-long'
}
```

## View State (src/hooks/useViewState.ts)

Centralized persistent state for HistoryPage analysis view, saved to localStorage.

```typescript
interface ViewState {
  filters: {
    dateRange: [number, number];  // [fromTime, toTime] in milliseconds
    exerciseType: string | null;   // Single exercise filter, or null to show all
  };
  selectedSessions: Set<string>;           // Session IDs selected by user
  histogramMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>;  // Multi-select
  histogramDisplayModes: Set<'individual' | 'meanStddev'>;      // Independent toggles
  timeSeriesMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>; // Multi-select
  timeSeriesDisplayModes: Set<'individual' | 'meanStddev'>;     // Independent toggles
  timeSeriesTimeMode: 'absolute' | 'relative';
}
```

**Storage:**
- Key: `"strabismus_view_state"`
- Debounced saves: 500ms after state mutations
- Deserialization validates metrics/modes and filters invalid values

**Constraints:**
- At least one metric in `histogramMetrics` and `timeSeriesMetrics` (enforcement in setters)
- Display modes can be empty (optional overlays)
- `exerciseType` single-select limitation (TODO: extend to Set<string> for multi-select filters)

## Storage

### IndexedDB (src/services/storage.ts)
- Database: `StrabismusDB`, Store: `sessions`, Key: `sessionId`
- Operations: `saveSession`, `getAllSessions`, `deleteSession`, `getSession`
- Stores raw session data (TimeSeries arrays)

### SessionContext (src/context/SessionContext.tsx)
- `currentSession` — in-progress recording
- `sessions` — loaded history
- `startSession(exerciseTag, ppi)` / `addTimeSeriesPoint(point)` / `endSession()`
- `loadHistoricalSessions()` / `deleteSelectedSessions(ids)`

### localStorage (useViewState)
- **PRIMARY** view state for HistoryPage
- Key: `"strabismus_view_state"`
- Persists: filters, selected sessions, metric selections, display mode toggles, time mode
- Survives browser reload and page navigation

### sessionStorage (legacy)
- Previously used by useHistoryFilters (now integrated into useViewState)
- Can be removed when useHistoryFilters is fully deprecated

## Time Handling

**Rule: store in milliseconds, display in seconds.**

- Formatter: `formatTimeSeconds(ms: number): string` → `"1.23s"` (src/utils/timeFormatting.ts)
- Applied to: x-axis labels and tooltips in TimeSeriesGraph
- Resampling: linear interpolation to fixed grid in TimeSeriesGraph.tsx and histogram.ts
