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

## Storage

### IndexedDB (src/services/storage.ts)
- Database: `StrabismusDB`, Store: `sessions`, Key: `sessionId`
- Operations: `saveSession`, `getAllSessions`, `deleteSession`, `getSession`

### SessionContext (src/context/SessionContext.tsx)
- `currentSession` — in-progress recording
- `sessions` — loaded history
- `startSession(exerciseTag, ppi)` / `addTimeSeriesPoint(point)` / `endSession()`
- `loadHistoricalSessions()` / `deleteSelectedSessions(ids)`

### sessionStorage (useHistoryFilters)
- Persists: date range filter, exercise type filter selections across page reloads

## Time Handling

**Rule: store in milliseconds, display in seconds.**

- Formatter: `formatTimeSeconds(ms: number): string` → `"1.23s"` (src/utils/timeFormatting.ts)
- Applied to: x-axis labels and tooltips in TimeSeriesGraph
- Resampling: linear interpolation to fixed grid in TimeSeriesGraph.tsx and histogram.ts
