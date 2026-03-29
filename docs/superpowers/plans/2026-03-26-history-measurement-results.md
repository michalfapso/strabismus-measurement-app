# History Page & Post-Measurement Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement two integrated features—History Page (full-screen session browser) and Post-Measurement Results Panel (automatic feedback after measurement)—with real-time filtering, multi-select capabilities, and responsive design.

**Architecture:** The implementation uses a component-based decomposition with clear separation of concerns: utility functions for stats/transforms (pure functions), a set of focused UI components for different layouts (results panel, list, detail, aggregate), enhanced SessionContext for cross-component state, and integration into App.tsx routing. Data flows offline-first from IndexedDB through component trees; no new data model needed.

**Tech Stack:** React 18, recharts (for graphs), IndexedDB (existing), Emotion for styling, native HTML inputs for date filtering (no new dependencies in MVP).

---

## File Structure & Boundaries

Before tasks begin, here's the complete file layout:

```
src/
├── components/
│   ├── ResultsPanel.tsx (NEW) — Post-measurement feedback side panel/modal
│   ├── HistoryPage.tsx (NEW) — Full-screen history view, controls routing
│   ├── HistoryListView.tsx (NEW) — Virtualized session list with multi-select
│   ├── DateFilterBar.tsx (NEW) — Real-time date range filter controls
│   ├── SessionDetailPanel.tsx (NEW) — Single or aggregate session details + graphs
│   ├── StatCards.tsx (NEW) — Reusable stat card layout for position, rotation, duration, deviation
│   ├── PositionGraph.tsx (NEW) — Line chart for x/y position over time
│   ├── RotationGraph.tsx (NEW) — Line chart for rotation over time
│   ├── SelectionBar.tsx (NEW) — Shows count, export, clear selection
│   └── ... (existing components unchanged)
│
├── services/
│   ├── stats.ts (NEW) — Pure functions: position range, rotation range, duration, mean deviation, aggregate stats
│   ├── graphData.ts (NEW) — Data preparation: single session, multi-session overlay, moving average
│   ├── storage.ts (UNCHANGED) — Already has getAllSessions, getSession, deleteSession, saveSession
│   ├── export.ts (ENHANCED) — Extend downloadCSV to accept multiple sessions, improve header format
│   └── ... (existing)
│
├── hooks/
│   ├── useHistoryFilters.ts (NEW) — Manage date range state, filtering logic, sessionStorage persistence
│   ├── useMultiSelect.ts (NEW) — Manage selected row IDs, shift+click/ctrl+click logic, last-clicked index
│   ├── useSessionStats.ts (NEW) — Memoized stat calculations for single or multi-select sessions
│   └── ... (existing)
│
├── types/
│   └── index.ts (ENHANCED) — Add SessionStats interface
│
├── context/
│   └── SessionContext.tsx (ENHANCED) — Add showResults, selectedSessionIds, loadHistoricalSessions, setShowResults
│
└── App.tsx (MODIFIED) — Add HistoryPage routing, ResultsPanel mounting
```

**Key design decisions:**
- **Stat calculations:** Pure functions in `services/stats.ts` for testability and reuse
- **Graph data prep:** Separate from stat calculations; handles both single and overlay cases
- **Component granularity:** One component = one clear responsibility (e.g., StatCards is reused by both ResultsPanel and SessionDetailPanel)
- **Hooks:** Encapsulate state patterns (filtering, multi-select, memoized stats) for reuse
- **SessionContext:** Only enhanced with results visibility and cross-component selection—no large refactor
- **App.tsx:** Minimal changes—just conditional rendering for HistoryPage and ResultsPanel

---

## Phase 1: Foundation Services & Utilities

### Task 1: Create Stats Calculation Service

**Files:**
- Create: `src/services/stats.ts`
- Test: `src/__tests__/services/stats.test.ts`

**Purpose:** Pure utility functions to calculate session statistics. These are tested in isolation and reused throughout the UI.

- [ ] **Step 1: Write test file with all stat calculation tests**

```typescript
// src/__tests__/services/stats.test.ts
import { describe, it, expect } from 'vitest';
import {
  getPositionRange,
  getRotationRange,
  getSessionDuration,
  getMeanDeviation,
  aggregateStats,
} from '../../services/stats';
import { Session, TimeSeries } from '../../types';

// Helper to create a test session
function createTestSession(points: TimeSeries[]): Session {
  return {
    sessionId: 'test-1',
    timestamp: '2026-03-26T10:00:00Z',
    exerciseTag: 'Pencil Push-ups',
    ppi: 96,
    timeSeries: points,
  };
}

describe('stats', () => {
  describe('getPositionRange', () => {
    it('should calculate x and y ranges correctly', () => {
      const session = createTestSession([
        { t: 0, x: 0.5, y: 0.3, r: 0 },
        { t: 100, x: 2.1, y: 1.8, r: 0 },
        { t: 200, x: 1.2, y: 0.9, r: 0 },
      ]);
      const range = getPositionRange(session);
      expect(range.xMin).toBe(0.5);
      expect(range.xMax).toBe(2.1);
      expect(range.xRange).toBe(1.6);
      expect(range.yMin).toBe(0.3);
      expect(range.yMax).toBe(1.8);
      expect(range.yRange).toBe(1.5);
    });

    it('should handle single point', () => {
      const session = createTestSession([{ t: 0, x: 1.0, y: 1.0, r: 0 }]);
      const range = getPositionRange(session);
      expect(range.xRange).toBe(0);
      expect(range.yRange).toBe(0);
    });

    it('should handle empty timeseries', () => {
      const session = createTestSession([]);
      expect(() => getPositionRange(session)).toThrow();
    });
  });

  describe('getRotationRange', () => {
    it('should calculate rotation range correctly', () => {
      const session = createTestSession([
        { t: 0, x: 0, y: 0, r: -5.2 },
        { t: 100, x: 0, y: 0, r: 8.4 },
        { t: 200, x: 0, y: 0, r: 0 },
      ]);
      const range = getRotationRange(session);
      expect(range.rMin).toBe(-5.2);
      expect(range.rMax).toBe(8.4);
      expect(range.range).toBe(13.6);
    });

    it('should handle empty timeseries', () => {
      const session = createTestSession([]);
      expect(() => getRotationRange(session)).toThrow();
    });
  });

  describe('getSessionDuration', () => {
    it('should calculate duration in milliseconds', () => {
      const session = createTestSession([
        { t: 0, x: 0, y: 0, r: 0 },
        { t: 1000, x: 0, y: 0, r: 0 },
        { t: 15000, x: 0, y: 0, r: 0 },
      ]);
      const duration = getSessionDuration(session);
      expect(duration).toBe(15000);
    });

    it('should return 0 for empty timeseries', () => {
      const session = createTestSession([]);
      expect(getSessionDuration(session)).toBe(0);
    });
  });

  describe('getMeanDeviation', () => {
    it('should calculate mean distance from center', () => {
      const session = createTestSession([
        { t: 0, x: 3, y: 4, r: 0 }, // distance = 5
        { t: 100, x: 0, y: 0, r: 0 }, // distance = 0
      ]);
      const deviation = getMeanDeviation(session);
      expect(deviation).toBe(2.5);
    });

    it('should handle single point at origin', () => {
      const session = createTestSession([{ t: 0, x: 0, y: 0, r: 0 }]);
      const deviation = getMeanDeviation(session);
      expect(deviation).toBe(0);
    });
  });

  describe('aggregateStats', () => {
    it('should aggregate stats across multiple sessions', () => {
      const sessions = [
        createTestSession([
          { t: 0, x: 1, y: 1, r: 2 },
          { t: 100, x: 2, y: 2, r: 4 },
        ]),
        createTestSession([
          { t: 0, x: 3, y: 3, r: 0 },
          { t: 100, x: 4, y: 4, r: 2 },
        ]),
      ];
      const agg = aggregateStats(sessions);
      expect(agg.meanX).toBe(2.5); // (1+2+3+4)/4
      expect(agg.meanY).toBe(2.5);
      expect(agg.meanR).toBe(2); // (2+4+0+2)/4
      expect(agg.pointCount).toBe(4);
    });

    it('should calculate rotation variance', () => {
      const sessions = [
        createTestSession([{ t: 0, x: 0, y: 0, r: 0 }]),
        createTestSession([{ t: 0, x: 0, y: 0, r: 4 }]),
      ];
      const agg = aggregateStats(sessions);
      const expectedMeanR = 2;
      const expectedVariance = ((0 - 2) ** 2 + (4 - 2) ** 2) / 2; // = 4
      expect(agg.rotVariance).toBe(expectedVariance);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /workspace
npm test -- src/__tests__/services/stats.test.ts
```

Expected: FAIL with "Cannot find module '../services/stats'"

- [ ] **Step 3: Write the stats.ts implementation**

```typescript
// src/services/stats.ts
import { Session } from '../types';

/**
 * Position range for a session
 */
export interface PositionRangeStats {
  xMin: number;
  xMax: number;
  xRange: number;
  yMin: number;
  yMax: number;
  yRange: number;
}

export function getPositionRange(session: Session): PositionRangeStats {
  if (session.timeSeries.length === 0) {
    throw new Error('Cannot calculate position range for empty session');
  }

  const xs = session.timeSeries.map((p) => p.x);
  const ys = session.timeSeries.map((p) => p.y);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  return {
    xMin,
    xMax,
    xRange: xMax - xMin,
    yMin,
    yMax,
    yRange: yMax - yMin,
  };
}

/**
 * Rotation range for a session
 */
export interface RotationRangeStats {
  rMin: number;
  rMax: number;
  range: number;
}

export function getRotationRange(session: Session): RotationRangeStats {
  if (session.timeSeries.length === 0) {
    throw new Error('Cannot calculate rotation range for empty session');
  }

  const rs = session.timeSeries.map((p) => p.r);
  const rMin = Math.min(...rs);
  const rMax = Math.max(...rs);

  return {
    rMin,
    rMax,
    range: rMax - rMin,
  };
}

/**
 * Duration in milliseconds from first to last point
 */
export function getSessionDuration(session: Session): number {
  if (session.timeSeries.length === 0) {
    return 0;
  }
  const first = session.timeSeries[0].t;
  const last = session.timeSeries[session.timeSeries.length - 1].t;
  return last - first;
}

/**
 * Mean distance from center (0, 0)
 */
export function getMeanDeviation(session: Session): number {
  if (session.timeSeries.length === 0) {
    return 0;
  }

  const distances = session.timeSeries.map((p) =>
    Math.sqrt(p.x * p.x + p.y * p.y)
  );
  const sum = distances.reduce((a, b) => a + b, 0);
  return sum / distances.length;
}

/**
 * Aggregate statistics across multiple sessions
 */
export interface AggregateStats {
  meanX: number;
  meanY: number;
  meanR: number;
  rotVariance: number;
  pointCount: number;
}

export function aggregateStats(sessions: Session[]): AggregateStats {
  const allPoints = sessions.flatMap((s) => s.timeSeries);

  if (allPoints.length === 0) {
    return {
      meanX: 0,
      meanY: 0,
      meanR: 0,
      rotVariance: 0,
      pointCount: 0,
    };
  }

  const meanX = allPoints.reduce((a, p) => a + p.x, 0) / allPoints.length;
  const meanY = allPoints.reduce((a, p) => a + p.y, 0) / allPoints.length;
  const meanR = allPoints.reduce((a, p) => a + p.r, 0) / allPoints.length;

  const rotVariance =
    allPoints.reduce((a, p) => a + Math.pow(p.r - meanR, 2), 0) /
    allPoints.length;

  return {
    meanX,
    meanY,
    meanR,
    rotVariance,
    pointCount: allPoints.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/services/stats.test.ts
```

Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add src/services/stats.ts src/__tests__/services/stats.test.ts
git commit -m "feat: add session statistics calculation service

- Add pure functions for position range, rotation range, duration, mean deviation
- Add aggregate statistics for multi-session analysis
- Comprehensive unit test coverage for all stat functions
- No dependencies on UI; ready for reuse across components"
```

---

### Task 2: Create Graph Data Preparation Service

**Files:**
- Create: `src/services/graphData.ts`
- Test: `src/__tests__/services/graphData.test.ts`

**Purpose:** Transform session data into recharts-compatible formats. Handles both single-session and multi-session overlay cases.

- [ ] **Step 1: Write test file for graph data preparation**

```typescript
// src/__tests__/services/graphData.test.ts
import { describe, it, expect } from 'vitest';
import {
  prepareSessionGraphData,
  prepareAggregateGraphData,
  calculateMovingAverage,
} from '../../services/graphData';
import { Session, TimeSeries } from '../../types';

function createTestSession(
  id: string,
  points: TimeSeries[]
): Session {
  return {
    sessionId: id,
    timestamp: '2026-03-26T10:00:00Z',
    exerciseTag: 'Test',
    ppi: 96,
    timeSeries: points,
  };
}

describe('graphData', () => {
  describe('prepareSessionGraphData', () => {
    it('should format single session for line chart', () => {
      const session = createTestSession('test-1', [
        { t: 0, x: 0.5, y: 0.3, r: 0 },
        { t: 100, x: 1.0, y: 0.8, r: 2 },
        { t: 200, x: 0.8, y: 0.5, r: 1 },
      ]);

      const data = prepareSessionGraphData(session);
      expect(data).toHaveLength(3);
      expect(data[0]).toEqual({
        time: 0,
        x: 0.5,
        y: 0.3,
        r: 0,
        timeFormatted: '0.00s',
      });
      expect(data[1].time).toBe(100);
      expect(data[2].r).toBe(1);
    });

    it('should handle empty session', () => {
      const session = createTestSession('test-1', []);
      const data = prepareSessionGraphData(session);
      expect(data).toEqual([]);
    });
  });

  describe('calculateMovingAverage', () => {
    it('should smooth data with 3-point moving average', () => {
      const points = [
        { t: 0, x: 1, y: 1, r: 0 },
        { t: 1, x: 2, y: 2, r: 2 },
        { t: 2, x: 3, y: 3, r: 4 },
        { t: 3, x: 4, y: 4, r: 6 },
        { t: 4, x: 5, y: 5, r: 8 },
      ];

      const smoothed = calculateMovingAverage(points, 3);
      // First two points unchanged
      expect(smoothed[0].x).toBe(1);
      expect(smoothed[1].x).toBe(2);
      // Third point: (1+2+3)/3 = 2
      expect(smoothed[2].x).toBe(2);
      // Fourth point: (2+3+4)/3 = 3
      expect(smoothed[3].x).toBe(3);
    });

    it('should handle window size larger than data', () => {
      const points = [
        { t: 0, x: 1, y: 1, r: 0 },
        { t: 1, x: 2, y: 2, r: 2 },
      ];

      const smoothed = calculateMovingAverage(points, 5);
      expect(smoothed).toHaveLength(2);
    });
  });

  describe('prepareAggregateGraphData', () => {
    it('should overlay multiple sessions with aggregate line', () => {
      const sessions = [
        createTestSession('test-1', [
          { t: 0, x: 1, y: 1, r: 0 },
          { t: 100, x: 2, y: 2, r: 2 },
        ]),
        createTestSession('test-2', [
          { t: 0, x: 3, y: 3, r: 4 },
          { t: 100, x: 4, y: 4, r: 6 },
        ]),
      ];

      const data = prepareAggregateGraphData(sessions);
      expect(data.points).toHaveLength(4);
      expect(data.aggregateLine).toBeDefined();

      // Check that sessionId and sessionIndex are attached
      expect(data.points[0].sessionId).toBe('test-1');
      expect(data.points[0].sessionIndex).toBe(0);
      expect(data.points[2].sessionId).toBe('test-2');
      expect(data.points[2].sessionIndex).toBe(1);
    });

    it('should calculate aggregate line correctly', () => {
      const sessions = [
        createTestSession('test-1', [
          { t: 0, x: 2, y: 2, r: 0 },
          { t: 100, x: 4, y: 4, r: 2 },
          { t: 200, x: 6, y: 6, r: 4 },
        ]),
      ];

      const data = prepareAggregateGraphData(sessions);
      expect(data.aggregateLine).toBeDefined();
      expect(data.aggregateLine.length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/services/graphData.test.ts
```

Expected: FAIL with "Cannot find module '../services/graphData'"

- [ ] **Step 3: Implement graphData.ts**

```typescript
// src/services/graphData.ts
import { Session, TimeSeries } from '../types';

/**
 * Format a single session's time-series for recharts line chart
 */
export interface SessionGraphPoint {
  time: number;
  x: number;
  y: number;
  r: number;
  timeFormatted: string;
}

export function prepareSessionGraphData(
  session: Session
): SessionGraphPoint[] {
  return session.timeSeries.map((point) => ({
    time: point.t,
    x: point.x,
    y: point.y,
    r: point.r,
    timeFormatted: formatTime(point.t),
  }));
}

/**
 * Format multiple sessions for overlay visualization
 */
export interface AggregateGraphPoint extends TimeSeries {
  sessionId: string;
  sessionIndex: number;
  timeFormatted: string;
}

export interface AggregateGraphData {
  points: AggregateGraphPoint[];
  aggregateLine: SessionGraphPoint[];
}

export function prepareAggregateGraphData(
  sessions: Session[]
): AggregateGraphData {
  const points: AggregateGraphPoint[] = sessions.flatMap((session, idx) =>
    session.timeSeries.map((point) => ({
      ...point,
      sessionId: session.sessionId,
      sessionIndex: idx,
      timeFormatted: formatTime(point.t),
    }))
  );

  // Calculate aggregate (moving average for smoothing)
  const allPoints = points.map((p) => ({
    t: p.t,
    x: p.x,
    y: p.y,
    r: p.r,
  }));

  const aggregateLine = calculateMovingAverage(allPoints, 5);

  return { points, aggregateLine };
}

/**
 * Calculate moving average for smoothing data
 */
export function calculateMovingAverage(
  points: TimeSeries[],
  windowSize: number
): SessionGraphPoint[] {
  if (points.length === 0) return [];

  return points.map((point, idx) => {
    const start = Math.max(0, idx - Math.floor(windowSize / 2));
    const end = Math.min(points.length, idx + Math.ceil(windowSize / 2));
    const window = points.slice(start, end);

    const avgX = window.reduce((a, p) => a + p.x, 0) / window.length;
    const avgY = window.reduce((a, p) => a + p.y, 0) / window.length;
    const avgR = window.reduce((a, p) => a + p.r, 0) / window.length;

    return {
      time: point.t,
      x: avgX,
      y: avgY,
      r: avgR,
      timeFormatted: formatTime(point.t),
    };
  });
}

/**
 * Format milliseconds as human-readable time string
 */
function formatTime(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  const minutes = seconds / 60;
  return `${minutes.toFixed(2)}m`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/services/graphData.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/graphData.ts src/__tests__/services/graphData.test.ts
git commit -m "feat: add graph data preparation service

- Prepare single-session data for recharts line charts
- Prepare multi-session overlay data with aggregate smoothing
- Calculate moving averages for aggregate visualization
- Format time values for display
- Pure functions for testability and reusability"
```

---

## Phase 2: Custom Hooks

### Task 3: Create useHistoryFilters Hook

**Files:**
- Create: `src/hooks/useHistoryFilters.ts`
- Test: `src/__tests__/hooks/useHistoryFilters.test.ts`

**Purpose:** Encapsulate date filtering logic with real-time updates and sessionStorage persistence.

- [ ] **Step 1: Write test file**

```typescript
// src/__tests__/hooks/useHistoryFilters.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistoryFilters } from '../../hooks/useHistoryFilters';
import { Session } from '../../types';

function createTestSession(date: string, tag: string): Session {
  return {
    sessionId: `session-${Math.random()}`,
    timestamp: date,
    exerciseTag: tag,
    ppi: 96,
    timeSeries: [],
  };
}

describe('useHistoryFilters', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should initialize with last 30 days by default', () => {
    const { result } = renderHook(() => useHistoryFilters([]));
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    expect(result.current.dateRange.to.toDateString()).toBe(
      now.toDateString()
    );
    // Allow 1-day tolerance for date arithmetic
    expect(
      Math.abs(
        result.current.dateRange.from.getTime() -
          thirtyDaysAgo.getTime()
      )
    ).toBeLessThan(86400000);
  });

  it('should filter sessions by date range', () => {
    const sessions = [
      createTestSession('2026-03-20T10:00:00Z', 'Test'),
      createTestSession('2026-03-25T10:00:00Z', 'Test'),
      createTestSession('2026-03-26T10:00:00Z', 'Test'),
    ];

    const { result } = renderHook(() => useHistoryFilters(sessions));

    const from = new Date('2026-03-24T00:00:00Z');
    const to = new Date('2026-03-26T23:59:59Z');

    act(() => {
      result.current.setDateRange(from, to);
    });

    const filtered = result.current.filteredSessions;
    expect(filtered).toHaveLength(2);
    expect(filtered.some((s) => s.timestamp.includes('03-25'))).toBe(true);
    expect(filtered.some((s) => s.timestamp.includes('03-26'))).toBe(true);
  });

  it('should persist date range to sessionStorage', () => {
    const { result } = renderHook(() => useHistoryFilters([]));

    const from = new Date('2026-03-20T00:00:00Z');
    const to = new Date('2026-03-26T23:59:59Z');

    act(() => {
      result.current.setDateRange(from, to);
    });

    const stored = sessionStorage.getItem('historyDateRange');
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(new Date(parsed.from).toDateString()).toBe(from.toDateString());
    expect(new Date(parsed.to).toDateString()).toBe(to.toDateString());
  });

  it('should restore date range from sessionStorage', () => {
    const from = new Date('2026-03-20T00:00:00Z');
    const to = new Date('2026-03-26T23:59:59Z');
    sessionStorage.setItem(
      'historyDateRange',
      JSON.stringify({
        from: from.toISOString(),
        to: to.toISOString(),
      })
    );

    const { result } = renderHook(() => useHistoryFilters([]));

    expect(result.current.dateRange.from.toDateString()).toBe(
      from.toDateString()
    );
    expect(result.current.dateRange.to.toDateString()).toBe(to.toDateString());
  });

  it('should update filtered sessions when sessions array changes', () => {
    const sessions1 = [createTestSession('2026-03-26T10:00:00Z', 'Test')];
    const { result, rerender } = renderHook(
      ({ sessions }: { sessions: Session[] }) => useHistoryFilters(sessions),
      { initialProps: { sessions: sessions1 } }
    );

    expect(result.current.filteredSessions).toHaveLength(1);

    const sessions2 = [
      createTestSession('2026-03-26T10:00:00Z', 'Test'),
      createTestSession('2026-03-25T10:00:00Z', 'Test'),
    ];

    rerender({ sessions: sessions2 });
    expect(result.current.filteredSessions.length).toBeGreaterThanOrEqual(1);
  });

  it('should provide preset date range setters', () => {
    const { result } = renderHook(() => useHistoryFilters([]));

    act(() => {
      result.current.setPresetLast7Days();
    });

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    expect(result.current.dateRange.to.toDateString()).toBe(
      now.toDateString()
    );
    expect(
      Math.abs(
        result.current.dateRange.from.getTime() -
          sevenDaysAgo.getTime()
      )
    ).toBeLessThan(86400000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/hooks/useHistoryFilters.test.ts
```

Expected: FAIL with "Cannot find module '../../hooks/useHistoryFilters'"

- [ ] **Step 3: Implement useHistoryFilters hook**

```typescript
// src/hooks/useHistoryFilters.ts
import { useState, useEffect, useMemo } from 'react';
import { Session } from '../types';

export interface DateRange {
  from: Date;
  to: Date;
}

const STORAGE_KEY = 'historyDateRange';

/**
 * Hook to manage date filtering for history page
 * Persists filter state to sessionStorage
 */
export function useHistoryFilters(sessions: Session[]) {
  const [dateRange, setDateRangeState] = useState<DateRange>(() => {
    // Try to restore from sessionStorage
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          from: new Date(parsed.from),
          to: new Date(parsed.to),
        };
      } catch {
        // Ignore parse errors, fall through to default
      }
    }

    // Default: last 30 days
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    return { from, to };
  });

  const setDateRange = (from: Date, to: Date) => {
    const range = { from, to };
    setDateRangeState(range);
    // Persist to sessionStorage
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        from: from.toISOString(),
        to: to.toISOString(),
      })
    );
  };

  // Filter sessions based on date range
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const sessionDate = new Date(session.timestamp);
      return sessionDate >= dateRange.from && sessionDate <= dateRange.to;
    });
  }, [sessions, dateRange]);

  // Preset helpers
  const setPresetLast7Days = () => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    setDateRange(from, to);
  };

  const setPresetLast30Days = () => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    setDateRange(from, to);
  };

  const setPresetThisMonth = () => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    setDateRange(from, to);
  };

  const setPresetAllTime = () => {
    const from = new Date('2000-01-01');
    const to = new Date();
    setDateRange(from, to);
  };

  return {
    dateRange,
    setDateRange,
    filteredSessions,
    setPresetLast7Days,
    setPresetLast30Days,
    setPresetThisMonth,
    setPresetAllTime,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/hooks/useHistoryFilters.test.ts
```

Expected: PASS (note: may need to install @testing-library/react if not present; test framework handles mocks)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useHistoryFilters.ts src/__tests__/hooks/useHistoryFilters.test.ts
git commit -m "feat: add useHistoryFilters hook

- Manage date range filtering with real-time updates
- Persist filter state to sessionStorage for UX continuity
- Provide preset date range helpers (7 days, 30 days, month, all-time)
- Memoized filtered sessions list for performance"
```

---

### Task 4: Create useMultiSelect Hook

**Files:**
- Create: `src/hooks/useMultiSelect.ts`
- Test: `src/__tests__/hooks/useMultiSelect.test.ts`

**Purpose:** Handle Shift+Click and Ctrl+Click multi-select logic with visual feedback.

- [ ] **Step 1: Write test file**

```typescript
// src/__tests__/hooks/useMultiSelect.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiSelect } from '../../hooks/useMultiSelect';

describe('useMultiSelect', () => {
  it('should initialize with empty selection', () => {
    const { result } = renderHook(() => useMultiSelect());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('should add single item on click', () => {
    const { result } = renderHook(() => useMultiSelect());

    act(() => {
      result.current.handleRowClick('item-1', false, false);
    });

    expect(result.current.selectedIds.has('item-1')).toBe(true);
    expect(result.current.selectedIds.size).toBe(1);
  });

  it('should toggle item on ctrl+click', () => {
    const { result } = renderHook(() => useMultiSelect());

    act(() => {
      result.current.handleRowClick('item-1', true, false); // ctrlKey=true
    });

    expect(result.current.selectedIds.has('item-1')).toBe(true);

    act(() => {
      result.current.handleRowClick('item-1', true, false); // ctrl+click again
    });

    expect(result.current.selectedIds.has('item-1')).toBe(false);
  });

  it('should select range on shift+click', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const { result } = renderHook(() => useMultiSelect());

    // Click on 'a'
    act(() => {
      result.current.handleRowClick('a', false, false);
    });
    expect(result.current.selectedIds.has('a')).toBe(true);

    // Shift+click on 'd' (should select a, b, c, d)
    act(() => {
      result.current.handleRowClick('d', false, true, items);
    });

    expect(result.current.selectedIds.has('a')).toBe(true);
    expect(result.current.selectedIds.has('b')).toBe(true);
    expect(result.current.selectedIds.has('c')).toBe(true);
    expect(result.current.selectedIds.has('d')).toBe(true);
    expect(result.current.selectedIds.has('e')).toBe(false);
  });

  it('should ctrl+shift+click toggle a range', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const { result } = renderHook(() => useMultiSelect());

    // Select b and c
    act(() => {
      result.current.handleRowClick('b', false, false);
    });
    act(() => {
      result.current.handleRowClick('c', true, false); // ctrl+click
    });

    expect(result.current.selectedIds.size).toBe(2);

    // Shift+click on d (should extend to b, c, d)
    act(() => {
      result.current.handleRowClick('d', false, true, items);
    });

    expect(result.current.selectedIds.has('b')).toBe(true);
    expect(result.current.selectedIds.has('c')).toBe(true);
    expect(result.current.selectedIds.has('d')).toBe(true);
    expect(result.current.selectedIds.has('a')).toBe(false);
  });

  it('should clear all selections', () => {
    const { result } = renderHook(() => useMultiSelect());

    act(() => {
      result.current.handleRowClick('a', false, false);
      result.current.handleRowClick('b', true, false);
    });

    expect(result.current.selectedIds.size).toBe(2);

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedIds.size).toBe(0);
  });

  it('should check if item is selected', () => {
    const { result } = renderHook(() => useMultiSelect());

    act(() => {
      result.current.handleRowClick('a', false, false);
    });

    expect(result.current.isSelected('a')).toBe(true);
    expect(result.current.isSelected('b')).toBe(false);
  });

  it('should get selection as array', () => {
    const { result } = renderHook(() => useMultiSelect());

    act(() => {
      result.current.handleRowClick('a', false, false);
      result.current.handleRowClick('b', true, false);
    });

    const selected = result.current.getSelectedArray();
    expect(selected).toContain('a');
    expect(selected).toContain('b');
    expect(selected.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/hooks/useMultiSelect.test.ts
```

Expected: FAIL with "Cannot find module '../../hooks/useMultiSelect'"

- [ ] **Step 3: Implement useMultiSelect hook**

```typescript
// src/hooks/useMultiSelect.ts
import { useState, useCallback } from 'react';

/**
 * Hook to manage multi-select with Shift+Click and Ctrl+Click support
 */
export function useMultiSelect() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const handleRowClick = useCallback(
    (
      id: string,
      ctrlKey: boolean,
      shiftKey: boolean,
      allItems?: string[]
    ) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && allItems && lastClickedIndex !== null) {
          // Shift+Click: select range from last clicked to current
          const currentIndex = allItems.indexOf(id);
          const start = Math.min(lastClickedIndex, currentIndex);
          const end = Math.max(lastClickedIndex, currentIndex);

          for (let i = start; i <= end; i++) {
            next.add(allItems[i]);
          }
        } else if (ctrlKey) {
          // Ctrl+Click: toggle individual item
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        } else {
          // Regular click: select only this item
          next.clear();
          next.add(id);
        }

        return next;
      });

      // Track last clicked index
      if (allItems) {
        setLastClickedIndex(allItems.indexOf(id));
      }
    },
    [lastClickedIndex]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastClickedIndex(null);
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const getSelectedArray = useCallback(
    () => Array.from(selectedIds),
    [selectedIds]
  );

  return {
    selectedIds,
    handleRowClick,
    clearSelection,
    isSelected,
    getSelectedArray,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/hooks/useMultiSelect.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMultiSelect.ts src/__tests__/hooks/useMultiSelect.test.ts
git commit -m "feat: add useMultiSelect hook

- Handle single click (select one), Ctrl+Click (toggle), Shift+Click (range)
- Track last clicked index for range selection
- Provide clear selection and query methods
- Pure callback pattern for performance"
```

---

### Task 5: Create useSessionStats Hook

**Files:**
- Create: `src/hooks/useSessionStats.ts`

**Purpose:** Memoized wrapper around stat calculation functions for performance.

- [ ] **Step 1: Implement useSessionStats hook**

```typescript
// src/hooks/useSessionStats.ts
import { useMemo } from 'react';
import { Session } from '../types';
import {
  getPositionRange,
  getRotationRange,
  getSessionDuration,
  getMeanDeviation,
  aggregateStats,
  PositionRangeStats,
  RotationRangeStats,
  AggregateStats,
} from '../services/stats';

/**
 * All calculated stats for a session
 */
export interface SessionStats {
  positionRange?: PositionRangeStats;
  rotationRange?: RotationRangeStats;
  duration: number;
  meanDeviation: number;
}

/**
 * Hook to memoize session stat calculations
 */
export function useSessionStats(session: Session | null): SessionStats {
  return useMemo(() => {
    if (!session || session.timeSeries.length === 0) {
      return {
        duration: 0,
        meanDeviation: 0,
      };
    }

    try {
      return {
        positionRange: getPositionRange(session),
        rotationRange: getRotationRange(session),
        duration: getSessionDuration(session),
        meanDeviation: getMeanDeviation(session),
      };
    } catch (error) {
      console.warn('Error calculating session stats:', error);
      return {
        duration: 0,
        meanDeviation: 0,
      };
    }
  }, [session]);
}

/**
 * Hook to memoize aggregate stat calculations
 */
export function useAggregateStats(sessions: Session[]): AggregateStats {
  return useMemo(() => {
    if (sessions.length === 0) {
      return {
        meanX: 0,
        meanY: 0,
        meanR: 0,
        rotVariance: 0,
        pointCount: 0,
      };
    }

    return aggregateStats(sessions);
  }, [sessions]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSessionStats.ts
git commit -m "feat: add useSessionStats hook

- Memoized single and multi-session stat calculations
- Error handling for malformed data
- Returns standardized SessionStats and AggregateStats interfaces"
```

---

## Phase 3: Enhanced Context

### Task 6: Enhance SessionContext

**Files:**
- Modify: `src/context/SessionContext.tsx`
- Modify: `src/types/index.ts` (add SessionStats interface)

**Purpose:** Add support for showing results panel and tracking selected sessions for multi-select operations.

- [ ] **Step 1: Update types to include SessionStats interface**

```typescript
// src/types/index.ts - ADD after existing interfaces
/**
 * Session statistics (computed from timeSeries)
 */
export interface SessionStats {
  positionRange?: {
    xMin: number;
    xMax: number;
    xRange: number;
    yMin: number;
    yMax: number;
    yRange: number;
  };
  rotationRange?: {
    rMin: number;
    rMax: number;
    range: number;
  };
  duration: number;
  meanDeviation: number;
}
```

Read the current file first to find the right insertion point:
<function_calls>
<invoke name="Read">
<parameter name="file_path">/workspace/src/types/index.ts