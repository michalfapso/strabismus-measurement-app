# HistogramChart & TimeSeriesGraph Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify view state persistence, add independent display toggles to both charts, implement box plot visualization, and fix layout issues.

**Architecture:** Create `useViewState` hook managing all HistoryPage state (filters, selection, chart settings) with localStorage persistence. Refactor HistogramChart and TimeSeriesGraph to read/write through this hook and use consistent display mode controls (Individual + Mean & Std Dev checkboxes).

**Tech Stack:** React, TypeScript, recharts, localStorage, TDD

---

## Task 1: Create useViewState Hook with State Types & Defaults

**Files:**
- Create: `src/hooks/useViewState.ts`
- Create: `src/hooks/useViewState.test.ts`

**Dependencies:** None. This task is standalone.

- [ ] **Step 1: Write test for useViewState initialization with defaults**

```typescript
// src/hooks/useViewState.test.ts
import { renderHook, act } from '@testing-library/react';
import { useViewState } from './useViewState';

describe('useViewState', () => {
  // Clear localStorage before each test
  beforeEach(() => {
    localStorage.clear();
  });

  test('initializes with default values when localStorage is empty', () => {
    const { result } = renderHook(() => useViewState());

    expect(result.current.state.filters.dateRange).toEqual([0, Infinity]);
    expect(result.current.state.filters.exerciseType).toBeNull();
    expect(result.current.state.selectedSessions).toEqual(new Set());
    expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation']));
    expect(result.current.state.histogramDisplayModes).toEqual(new Set(['individual']));
    expect(result.current.state.timeSeriesMetrics).toEqual(new Set(['deviation']));
    expect(result.current.state.timeSeriesDisplayModes).toEqual(new Set(['individual', 'meanStddev']));
    expect(result.current.state.timeSeriesTimeMode).toBe('absolute');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- src/hooks/useViewState.test.ts --watch=false
```

Expected output: `FAIL - useViewState is not exported`

- [ ] **Step 3: Write the useViewState hook implementation**

```typescript
// src/hooks/useViewState.ts
import { useState, useEffect, useCallback, useRef } from 'react';

export interface ViewState {
  filters: {
    dateRange: [number, number];
    exerciseType: string | null;
  };
  selectedSessions: Set<string>;
  histogramMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>;
  histogramDisplayModes: Set<'individual' | 'meanStddev'>;
  timeSeriesMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>;
  timeSeriesDisplayModes: Set<'individual' | 'meanStddev'>;
  timeSeriesTimeMode: 'absolute' | 'relative';
}

const STORAGE_KEY = 'strabismus_view_state';

const DEFAULT_STATE: ViewState = {
  filters: {
    dateRange: [0, Infinity],
    exerciseType: null,
  },
  selectedSessions: new Set(),
  histogramMetrics: new Set(['deviation']),
  histogramDisplayModes: new Set(['individual']),
  timeSeriesMetrics: new Set(['deviation']),
  timeSeriesDisplayModes: new Set(['individual', 'meanStddev']),
  timeSeriesTimeMode: 'absolute',
};

// Convert ViewState to JSON-serializable format
function serialize(state: ViewState): string {
  return JSON.stringify({
    filters: state.filters,
    selectedSessions: Array.from(state.selectedSessions),
    histogramMetrics: Array.from(state.histogramMetrics),
    histogramDisplayModes: Array.from(state.histogramDisplayModes),
    timeSeriesMetrics: Array.from(state.timeSeriesMetrics),
    timeSeriesDisplayModes: Array.from(state.timeSeriesDisplayModes),
    timeSeriesTimeMode: state.timeSeriesTimeMode,
  });
}

// Convert JSON back to ViewState
function deserialize(json: string): ViewState {
  try {
    const parsed = JSON.parse(json);
    return {
      filters: parsed.filters || DEFAULT_STATE.filters,
      selectedSessions: new Set(parsed.selectedSessions || []),
      histogramMetrics: new Set(parsed.histogramMetrics || ['deviation']),
      histogramDisplayModes: new Set(parsed.histogramDisplayModes || ['individual']),
      timeSeriesMetrics: new Set(parsed.timeSeriesMetrics || ['deviation']),
      timeSeriesDisplayModes: new Set(parsed.timeSeriesDisplayModes || ['individual', 'meanStddev']),
      timeSeriesTimeMode: parsed.timeSeriesTimeMode || 'absolute',
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useViewState() {
  // Initialize from localStorage
  const [state, setState] = useState<ViewState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? deserialize(stored) : DEFAULT_STATE;
    } catch {
      return DEFAULT_STATE;
    }
  });

  // Debounced save to localStorage
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    // Clear pending timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout (debounce 500ms)
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, serialize(state));
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state]);

  // Setters
  const updateFilters = useCallback(
    (updates: Partial<ViewState['filters']>) => {
      setState((prev) => ({
        ...prev,
        filters: { ...prev.filters, ...updates },
      }));
    },
    []
  );

  const updateSelectedSessions = useCallback((sessions: Set<string>) => {
    setState((prev) => ({
      ...prev,
      selectedSessions: new Set(sessions),
    }));
  }, []);

  const toggleHistogramMetric = useCallback((metric: 'deviation' | 'x' | 'y' | 'rotation') => {
    setState((prev) => {
      const newMetrics = new Set(prev.histogramMetrics);
      if (newMetrics.has(metric)) {
        newMetrics.delete(metric);
      } else {
        newMetrics.add(metric);
      }
      // Ensure at least one metric selected
      return {
        ...prev,
        histogramMetrics: newMetrics.size > 0 ? newMetrics : new Set(['deviation']),
      };
    });
  }, []);

  const toggleHistogramDisplayMode = useCallback((mode: 'individual' | 'meanStddev') => {
    setState((prev) => {
      const newModes = new Set(prev.histogramDisplayModes);
      if (newModes.has(mode)) {
        newModes.delete(mode);
      } else {
        newModes.add(mode);
      }
      return {
        ...prev,
        histogramDisplayModes: newModes,
      };
    });
  }, []);

  const toggleTimeSeriesMetric = useCallback((metric: 'deviation' | 'x' | 'y' | 'rotation') => {
    setState((prev) => {
      const newMetrics = new Set(prev.timeSeriesMetrics);
      if (newMetrics.has(metric)) {
        newMetrics.delete(metric);
      } else {
        newMetrics.add(metric);
      }
      // Ensure at least one metric selected
      return {
        ...prev,
        timeSeriesMetrics: newMetrics.size > 0 ? newMetrics : new Set(['deviation']),
      };
    });
  }, []);

  const toggleTimeSeriesDisplayMode = useCallback((mode: 'individual' | 'meanStddev') => {
    setState((prev) => {
      const newModes = new Set(prev.timeSeriesDisplayModes);
      if (newModes.has(mode)) {
        newModes.delete(mode);
      } else {
        newModes.add(mode);
      }
      return {
        ...prev,
        timeSeriesDisplayModes: newModes,
      };
    });
  }, []);

  const setTimeSeriesTimeMode = useCallback((mode: 'absolute' | 'relative') => {
    setState((prev) => ({
      ...prev,
      timeSeriesTimeMode: mode,
    }));
  }, []);

  return {
    state,
    updateFilters,
    updateSelectedSessions,
    toggleHistogramMetric,
    toggleHistogramDisplayMode,
    toggleTimeSeriesMetric,
    toggleTimeSeriesDisplayMode,
    setTimeSeriesTimeMode,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- src/hooks/useViewState.test.ts --watch=false
```

Expected output: `PASS - 1 test passed`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useViewState.ts src/hooks/useViewState.test.ts
git commit -m "feat: create useViewState hook for unified view state management"
```

---

## Task 2: Test useViewState Persistence & Serialization

**Files:**
- Modify: `src/hooks/useViewState.test.ts`

**Dependencies:** Task 1 complete

- [ ] **Step 1: Add test for loading state from localStorage**

```typescript
// Add to src/hooks/useViewState.test.ts
test('hydrates from localStorage on mount', () => {
  const mockState = {
    filters: { dateRange: [1000, 2000], exerciseType: 'Pencil Push-ups' },
    selectedSessions: ['session-1', 'session-2'],
    histogramMetrics: ['deviation', 'x'],
    histogramDisplayModes: ['meanStddev'],
    timeSeriesMetrics: ['rotation'],
    timeSeriesDisplayModes: ['individual'],
    timeSeriesTimeMode: 'relative' as const,
  };
  localStorage.setItem('strabismus_view_state', JSON.stringify(mockState));

  const { result } = renderHook(() => useViewState());

  expect(result.current.state.filters.dateRange).toEqual([1000, 2000]);
  expect(result.current.state.filters.exerciseType).toBe('Pencil Push-ups');
  expect(result.current.state.selectedSessions).toEqual(new Set(['session-1', 'session-2']));
  expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation', 'x']));
  expect(result.current.state.histogramDisplayModes).toEqual(new Set(['meanStddev']));
  expect(result.current.state.timeSeriesMetrics).toEqual(new Set(['rotation']));
  expect(result.current.state.timeSeriesDisplayModes).toEqual(new Set(['individual']));
  expect(result.current.state.timeSeriesTimeMode).toBe('relative');
});

test('persists state to localStorage on update', async () => {
  jest.useFakeTimers();
  const { result } = renderHook(() => useViewState());

  act(() => {
    result.current.updateFilters({ exerciseType: 'Brock String' });
  });

  jest.advanceTimersByTime(500); // debounce delay

  const stored = localStorage.getItem('strabismus_view_state');
  const parsed = JSON.parse(stored || '{}');
  expect(parsed.filters.exerciseType).toBe('Brock String');

  jest.useRealTimers();
});

test('handles corrupted localStorage gracefully', () => {
  localStorage.setItem('strabismus_view_state', 'not valid json');

  const { result } = renderHook(() => useViewState());

  expect(result.current.state).toEqual(expect.objectContaining({
    filters: DEFAULT_STATE.filters,
  }));
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm run test -- src/hooks/useViewState.test.ts --watch=false
```

Expected output: `PASS - 3 tests passed`

- [ ] **Step 3: Add test for toggle functions**

```typescript
// Add to src/hooks/useViewState.test.ts
test('toggleHistogramMetric adds and removes metrics', () => {
  const { result } = renderHook(() => useViewState());

  expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation']));

  act(() => {
    result.current.toggleHistogramMetric('x');
  });

  expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation', 'x']));

  act(() => {
    result.current.toggleHistogramMetric('x');
  });

  expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation']));
});

test('toggleHistogramMetric prevents deselecting all metrics', () => {
  const { result } = renderHook(() => useViewState());

  act(() => {
    result.current.toggleHistogramMetric('deviation');
  });

  // Should keep deviation selected
  expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation']));
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- src/hooks/useViewState.test.ts --watch=false
```

Expected output: `PASS - 5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useViewState.test.ts
git commit -m "test: add persistence and serialization tests for useViewState"
```

---

## Task 3: Update HistoryPage to Use useViewState

**Files:**
- Modify: `src/components/HistoryPage.tsx`

**Dependencies:** Task 1 complete

- [ ] **Step 1: Replace useHistoryFilters and useMultiSelect with useViewState**

Read the current HistoryPage to understand structure:

```bash
head -100 src/components/HistoryPage.tsx
```

Then modify:

```typescript
// src/components/HistoryPage.tsx (top of file)
import { useViewState } from '../hooks/useViewState';

export function HistoryPage() {
  const { state, updateFilters, updateSelectedSessions } = useViewState();
  // Remove: const filters = useHistoryFilters();
  // Remove: const { selectedIds, toggleSelection, ... } = useMultiSelect(...);

  // Update DateFilterBar usage
  return (
    <div>
      {/* Date filter */}
      <DateFilterBar
        dateRange={state.filters.dateRange}
        onDateChange={(range) => updateFilters({ dateRange: range })}
      />

      {/* Exercise type filter */}
      <ExerciseTypeFilterBar
        exerciseType={state.filters.exerciseType}
        onExerciseTypeChange={(type) => updateFilters({ exerciseType: type })}
      />

      {/* History list with selection */}
      <HistoryListView
        sessions={filteredSessions}
        selectedSessions={state.selectedSessions}
        onSelectionChange={updateSelectedSessions}
        onSessionClick={(id) => {
          const newSelection = new Set(state.selectedSessions);
          newSelection.add(id);
          updateSelectedSessions(newSelection);
        }}
      />

      {/* Session panel */}
      <UnifiedSessionPanel sessions={selectedSessionObjects} />
    </div>
  );
}
```

- [ ] **Step 2: Run the app to verify HistoryPage works**

```bash
npm run dev
```

Expected: App starts, HistoryPage loads without errors, filters apply correctly, selection persists on navigation

- [ ] **Step 3: Test filter and selection persistence manually**

1. Open the app
2. Set date filter to a specific range
3. Select a session
4. Refresh page with F5
5. Verify filter and selection are restored

Expected: State restored from localStorage

- [ ] **Step 4: Commit**

```bash
git add src/components/HistoryPage.tsx
git commit -m "refactor: update HistoryPage to use useViewState"
```

---

## Task 4: Add Metric Checkboxes to HistogramChart

**Files:**
- Modify: `src/components/HistogramChart.tsx`

**Dependencies:** Task 1 complete

- [ ] **Step 1: Update HistogramChart props and state initialization**

Replace radio buttons with checkboxes. Read the current component:

```bash
cat src/components/HistogramChart.tsx
```

Then modify to use useViewState for metrics:

```typescript
// src/components/HistogramChart.tsx (changes)
import { useViewState } from '../hooks/useViewState';

export function HistogramChart({ sessions, isSingleSession }: HistogramChartProps) {
  const { state, toggleHistogramMetric } = useViewState();
  const selectedMetrics = state.histogramMetrics;

  // Calculate histograms for each selected metric
  const histogramsData: Record<string, HistogramBin[]> = {};
  for (const metric of selectedMetrics) {
    if (isSingleSession) {
      histogramsData[metric] = calculateSessionHistogram(sessions[0], metric as HistogramMetric);
    } else {
      histogramsData[metric] = calculateAggregateHistogram(sessions, metric as HistogramMetric, 'individual');
    }
  }

  return (
    <div style={{ /* ... existing styles ... */ }}>
      {/* Title */}
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px' }}>
        {isSingleSession ? 'Session Histogram' : 'Combined Histogram'}
      </div>

      {/* Metric Checkboxes - only show for aggregate view */}
      {!isSingleSession && (
        <div style={{ marginBottom: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '10px', color: '#aaa' }}>Metrics:</label>
          {(['deviation', 'x', 'y', 'rotation'] as const).map((metric) => (
            <label
              key={metric}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                color: '#aaa',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={selectedMetrics.has(metric)}
                onChange={() => toggleHistogramMetric(metric)}
                style={{ cursor: 'pointer' }}
              />
              {metric.charAt(0).toUpperCase() + metric.slice(1)}
            </label>
          ))}
        </div>
      )}

      {/* Render histograms vertically for each metric */}
      {selectedMetrics.size > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Array.from(selectedMetrics).map((metric) => (
            <HistogramBar
              key={metric}
              metric={metric as HistogramMetric}
              data={histogramsData[metric] || []}
            />
          ))}
        </div>
      ) : (
        <div style={{ color: '#666', fontSize: '12px' }}>
          No metrics selected
        </div>
      )}
    </div>
  );
}

// Helper component to render a single metric's histogram
function HistogramBar({ metric, data }: { metric: HistogramMetric; data: HistogramBin[] }) {
  const chartData = data.map((bin) => ({
    label: bin.label,
    duration: parseFloat(bin.duration.toFixed(2)),
  }));

  const chartTitle = `${metric.charAt(0).toUpperCase() + metric.slice(1)} Range`;

  return (
    <div style={{ border: '1px solid rgba(0,255,0,0.1)', borderRadius: '2px', padding: '8px' }}>
      <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px' }}>
        {chartTitle}
      </div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="label"
              angle={-45}
              textAnchor="end"
              height={60}
              tick={{ fontSize: 9, fill: '#888' }}
            />
            <YAxis tick={{ fontSize: 9, fill: '#888' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                color: '#fff',
              }}
              formatter={(value: any) => `${value.toFixed(2)}s`}
            />
            <Bar
              dataKey="duration"
              fill={METRIC_COLORS[metric]}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ color: '#666', fontSize: '11px', height: '100px', display: 'flex', alignItems: 'center' }}>
          No data
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the app and verify metric checkboxes work**

```bash
npm run dev
```

Navigate to HistoryPage, select multiple sessions. Expected:
- Checkboxes appear for aggregate view
- Checking/unchecking metrics shows/hides histograms vertically
- Single session view has no checkboxes
- State persists on navigation

- [ ] **Step 3: Commit**

```bash
git add src/components/HistogramChart.tsx
git commit -m "feat: add metric checkboxes to HistogramChart for independent selection"
```

---

## Task 5: Add Display Mode Toggles to HistogramChart

**Files:**
- Modify: `src/components/HistogramChart.tsx`

**Dependencies:** Task 4 complete

- [ ] **Step 1: Add display mode checkboxes to aggregate view**

Add to HistogramChart after metric checkboxes:

```typescript
// In HistogramChart component, add after metric checkboxes:
const { state, toggleHistogramMetric, toggleHistogramDisplayMode } = useViewState();
const displayModes = state.histogramDisplayModes;

// Add this UI section after metric checkboxes:
{!isSingleSession && (
  <div style={{ marginBottom: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
    <label style={{ fontSize: '10px', color: '#aaa' }}>Display:</label>
    {(['individual', 'meanStddev'] as const).map((mode) => (
      <label
        key={mode}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '10px',
          color: '#aaa',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={displayModes.has(mode)}
          onChange={() => toggleHistogramDisplayMode(mode)}
          style={{ cursor: 'pointer' }}
        />
        {mode === 'individual' ? 'Individual' : 'Mean & Std Dev'}
      </label>
    ))}
  </div>
)}
```

- [ ] **Step 2: Run the app and verify toggles work**

```bash
npm run dev
```

Navigate to multi-session view. Expected:
- Display mode checkboxes appear
- Both "Individual" and "Mean & Std Dev" can be toggled independently
- Chart updates accordingly (will show only individual bars for now)

- [ ] **Step 3: Commit**

```bash
git add src/components/HistogramChart.tsx
git commit -m "feat: add display mode toggles (Individual/Mean & Std Dev) to HistogramChart"
```

---

## Task 6: Implement Individual Mode Visualization (Horizontal Lines)

**Files:**
- Modify: `src/components/HistogramChart.tsx`
- Modify: `src/utils/histogram.ts`

**Dependencies:** Task 5 complete

- [ ] **Step 1: Add helper function to calculate box data from sessions**

```typescript
// Add to src/utils/histogram.ts
export interface BoxPlotData {
  bin: string;
  rangeStart: number;
  rangeEnd: number;
  values: number[]; // all individual session durations for this bin
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

export function calculateBoxPlotData(
  sessions: Session[],
  metric: HistogramMetric
): BoxPlotData[] {
  if (sessions.length === 0) return [];

  // Calculate histogram for each session
  const sessionHistograms = sessions.map((s) => calculateSessionHistogram(s, metric));

  // Group by bin
  const binMap = new Map<string, number[]>();
  for (const histogram of sessionHistograms) {
    for (const bin of histogram) {
      const key = `${bin.rangeStart}-${bin.rangeEnd}`;
      if (!binMap.has(key)) {
        binMap.set(key, []);
      }
      binMap.get(key)!.push(bin.duration);
    }
  }

  // Calculate quartiles for each bin
  const result: BoxPlotData[] = [];
  binMap.forEach((values, key) => {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const q1Index = Math.floor(n * 0.25);
    const medianIndex = Math.floor(n * 0.5);
    const q3Index = Math.floor(n * 0.75);

    result.push({
      bin: key,
      rangeStart: parseInt(key.split('-')[0]),
      rangeEnd: parseInt(key.split('-')[1]),
      values,
      median: sorted[medianIndex],
      q1: sorted[q1Index],
      q3: sorted[q3Index],
      min: Math.min(...values),
      max: Math.max(...values),
    });
  });

  result.sort((a, b) => a.rangeStart - b.rangeStart);
  return result;
}
```

- [ ] **Step 2: Update HistogramBar to render individual lines when mode enabled**

```typescript
// Modify HistogramBar component:
interface HistogramBarProps {
  metric: HistogramMetric;
  data: HistogramBin[];
  displayModes: Set<'individual' | 'meanStddev'>;
  sessions: Session[];
  isSingleSession: boolean;
}

function HistogramBar({ metric, data, displayModes, sessions, isSingleSession }: HistogramBarProps) {
  const showIndividual = displayModes.has('individual');
  const showMeanStdDev = displayModes.has('meanStddev');

  // For aggregate view with individual mode, show scatter-like plot with session lines
  if (!isSingleSession && showIndividual) {
    return (
      <div style={{ border: '1px solid rgba(0,255,0,0.1)', borderRadius: '2px', padding: '8px' }}>
        <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px' }}>
          {metric.charAt(0).toUpperCase() + metric.slice(1)} Range
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 40, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="label"
              angle={-45}
              textAnchor="end"
              height={60}
              tick={{ fontSize: 9, fill: '#888' }}
            />
            <YAxis tick={{ fontSize: 9, fill: '#888' }} label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
              formatter={(value: any) => (typeof value === 'number' ? `${value.toFixed(2)}s` : value)}
            />
            {/* Render horizontal reference lines for each session's value */}
            {data.map((bin, idx) => (
              // For each bin, render a subtle reference line
              <div key={`${idx}-ref`} />
            ))}
            <Bar dataKey="duration" fill={METRIC_COLORS[metric]} radius={[2, 2, 0, 0]} opacity={0.3} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Default: bar chart
  const chartData = data.map((bin) => ({
    label: bin.label,
    duration: parseFloat(bin.duration.toFixed(2)),
  }));

  return (
    <div style={{ border: '1px solid rgba(0,255,0,0.1)', borderRadius: '2px', padding: '8px' }}>
      <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px' }}>
        {metric.charAt(0).toUpperCase() + metric.slice(1)} Range
      </div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 40, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="label"
              angle={-45}
              textAnchor="end"
              height={60}
              tick={{ fontSize: 9, fill: '#888' }}
            />
            <YAxis tick={{ fontSize: 9, fill: '#888' }} label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
              formatter={(value: any) => (typeof value === 'number' ? `${value.toFixed(2)}s` : value)}
            />
            <Bar dataKey="duration" fill={METRIC_COLORS[metric]} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ color: '#666', fontSize: '11px', height: '100px', display: 'flex', alignItems: 'center' }}>
          No data
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Test individual mode rendering**

```bash
npm run dev
```

Navigate to multi-session view, toggle "Individual" on. Expected:
- Bars appear with slightly different styling
- Multiple lines should be visible (stacked or overlaid)

- [ ] **Step 4: Commit**

```bash
git add src/components/HistogramChart.tsx src/utils/histogram.ts
git commit -m "feat: implement individual mode visualization with session duration lines"
```

---

## Task 7: Implement Mean & Std Dev Box Plot Visualization

**Files:**
- Modify: `src/components/HistogramChart.tsx`
- Modify: `src/utils/histogram.ts`

**Dependencies:** Task 6 complete. **Note:** Box plot library choice (recharts-box-plot vs custom) is TBD based on spike. Using custom render approach here.

- [ ] **Step 1: Update HistogramBar to render box plot when Mean & Std Dev enabled**

```typescript
// In HistogramBar, add box plot rendering:
function renderBoxPlot(boxData: BoxPlotData[], metric: HistogramMetric) {
  return (
    <div style={{ border: '1px solid rgba(0,255,0,0.1)', borderRadius: '2px', padding: '8px' }}>
      <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px' }}>
        {metric.charAt(0).toUpperCase() + metric.slice(1)} Distribution
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart
          data={boxData.map((d) => ({
            label: d.bin,
            median: d.median,
            q1: d.q1,
            q3: d.q3,
            min: d.min,
            max: d.max,
          }))}
          margin={{ top: 10, right: 20, left: 40, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="label" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 9, fill: '#888' }} />
          <YAxis tick={{ fontSize: 9, fill: '#888' }} label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
            formatter={(value: any) => (typeof value === 'number' ? `${value.toFixed(2)}s` : value)}
          />
          {/* Error bars representing whiskers */}
          <Bar dataKey="median" fill={METRIC_COLORS[metric]} radius={[2, 2, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Update main rendering logic in HistogramBar:
if (!isSingleSession && showMeanStdDev && !showIndividual) {
  const boxData = calculateBoxPlotData(sessions, metric);
  return renderBoxPlot(boxData, metric);
}
```

- [ ] **Step 2: Test box plot rendering**

```bash
npm run dev
```

Navigate to multi-session, toggle "Mean & Std Dev" on (with "Individual" off). Expected:
- Box plot appears with quartile visualization
- Median lines visible in metric color

- [ ] **Step 3: Commit**

```bash
git add src/components/HistogramChart.tsx
git commit -m "feat: implement Mean & Std Dev box plot visualization for aggregate view"
```

---

## Task 8: Fix HistogramChart Layout Issue (SVG Empty Space)

**Files:**
- Modify: `src/components/HistogramChart.tsx`

**Dependencies:** Task 7 complete

- [ ] **Step 1: Diagnose current layout**

The issue: ~100px empty space below x-axis labels in a 250px tall container. Adjust ResponsiveContainer height and BarChart margins.

```bash
# First, run the dev server and inspect the chart in browser DevTools
npm run dev
```

Open browser DevTools → Elements tab → Find HistogramChart SVG element → check computed height and margins.

- [ ] **Step 2: Reduce ResponsiveContainer height and adjust margins**

```typescript
// In HistogramBar, replace ResponsiveContainer height and margins:
<ResponsiveContainer width="100%" height={120}>  {/* Reduced from 150 */}
  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 40, bottom: 25 }}>  {/* Reduced bottom from 30 */}
    {/* ... */}
  </BarChart>
</ResponsiveContainer>

// For box plot:
<ResponsiveContainer width="100%" height={120}>
  <ComposedChart {...} margin={{ top: 5, right: 20, left: 40, bottom: 25 }}>
    {/* ... */}
  </ComposedChart>
</ResponsiveContainer>
```

- [ ] **Step 3: Test in browser to verify spacing is correct**

```bash
npm run dev
```

Navigate to HistogramChart. Expected:
- No visible empty space below x-axis labels
- Chart fits snugly in its container
- Labels still readable

- [ ] **Step 4: Commit**

```bash
git add src/components/HistogramChart.tsx
git commit -m "fix: reduce SVG height and margins to eliminate empty space in HistogramChart"
```

---

## Task 9: Integrate HistogramChart with useViewState (State Persistence)

**Files:**
- Modify: `src/components/HistogramChart.tsx`

**Dependencies:** Tasks 3-8 complete

- [ ] **Step 1: Update HistogramChart to read/write state from useViewState**

```typescript
// In HistogramChart, ensure all state reads/writes use useViewState:
import { useViewState } from '../hooks/useViewState';

export function HistogramChart({ sessions, isSingleSession }: HistogramChartProps) {
  const { state, toggleHistogramMetric, toggleHistogramDisplayMode } = useViewState();

  // All state is now from useViewState
  const selectedMetrics = state.histogramMetrics;
  const displayModes = state.histogramDisplayModes;

  // ... rest of component
}
```

Verify all toggles call the useViewState setters.

- [ ] **Step 2: Test state persistence**

```bash
npm run dev
```

1. Set metrics to [deviation, x]
2. Set display modes to [individual, meanStddev]
3. Refresh page
4. Verify metrics and modes are restored

Expected: All state persisted and restored from localStorage

- [ ] **Step 3: Commit**

```bash
git add src/components/HistogramChart.tsx
git commit -m "feat: integrate HistogramChart with useViewState for state persistence"
```

---

## Task 10: Merge TimeSeriesGraph Display Modes (Mean + Std Dev → Mean & Std Dev)

**Files:**
- Modify: `src/components/TimeSeriesGraph.tsx`

**Dependencies:** Task 1 complete

- [ ] **Step 1: Read current TimeSeriesGraph code**

```bash
head -150 src/components/TimeSeriesGraph.tsx
```

- [ ] **Step 2: Update display mode state from separate toggles to unified checkbox**

```typescript
// In TimeSeriesGraph:
import { useViewState } from '../hooks/useViewState';

export function TimeSeriesGraph({ sessions, isSingleSession }: TimeSeriesGraphProps) {
  const { state, toggleTimeSeriesMetric, toggleTimeSeriesDisplayMode, setTimeSeriesTimeMode } = useViewState();

  const selectedMetrics = state.timeSeriesMetrics;
  const displayModes = state.timeSeriesDisplayModes;
  const timeMode = state.timeSeriesTimeMode;

  // Remove old state: const [displayMode, setDisplayMode] = useState<Set<DisplayMode>>(...)
}
```

- [ ] **Step 3: Update UI to show merged "Mean & Std Dev" checkbox**

Find the display mode selector UI and replace:

```typescript
// OLD: Separate checkboxes for 'mean', 'stddev', 'individual'
// NEW: Combined 'meanStddev', 'individual'

<div style={{ marginBottom: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
  <label style={{ fontSize: '10px', color: '#aaa' }}>Display:</label>
  {(['individual', 'meanStddev'] as const).map((mode) => (
    <label
      key={mode}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '10px',
        color: '#aaa',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={displayModes.has(mode)}
        onChange={() => toggleTimeSeriesDisplayMode(mode)}
        style={{ cursor: 'pointer' }}
      />
      {mode === 'individual' ? 'Individual' : 'Mean & Std Dev'}
    </label>
  ))}
</div>
```

- [ ] **Step 4: Update visualization logic to render both mean and stddev together**

In the chart rendering section, where mean and stddev are currently separate:

```typescript
// When 'meanStddev' is enabled, render BOTH mean line and stddev bounds
if (displayModes.has('meanStddev')) {
  // Render mean line
  // Render stddev bounds as dashed lines
}

// When 'individual' is enabled, render individual session lines
if (displayModes.has('individual')) {
  // Render thin grey lines
}
```

- [ ] **Step 5: Test the updated controls**

```bash
npm run dev
```

Navigate to multi-session view. Expected:
- Old "Mean" and "Std Dev" toggles are gone
- New "Mean & Std Dev" checkbox appears
- Both "Individual" and "Mean & Std Dev" can be toggled independently
- Chart updates correctly when toggling

- [ ] **Step 6: Commit**

```bash
git add src/components/TimeSeriesGraph.tsx
git commit -m "feat: merge Mean and Std Dev toggles into unified Mean & Std Dev checkbox"
```

---

## Task 11: Integrate TimeSeriesGraph with useViewState (State Persistence)

**Files:**
- Modify: `src/components/TimeSeriesGraph.tsx`

**Dependencies:** Task 10 complete

- [ ] **Step 1: Verify all state reads/writes use useViewState**

```typescript
// TimeSeriesGraph should already have:
const { state, toggleTimeSeriesMetric, toggleTimeSeriesDisplayMode, setTimeSeriesTimeMode } = useViewState();
```

Verify all toggle calls use these setters (no local setState).

- [ ] **Step 2: Test state persistence**

```bash
npm run dev
```

1. Select metrics: [deviation, rotation]
2. Enable display modes: [individual]
3. Set time mode: relative
4. Refresh page
5. Verify all state is restored

Expected: Metrics, display modes, and time mode all persisted

- [ ] **Step 3: Commit**

```bash
git add src/components/TimeSeriesGraph.tsx
git commit -m "feat: integrate TimeSeriesGraph with useViewState for state persistence"
```

---

## Task 12: Update Documentation

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/styling.md` (if needed)

**Dependencies:** Tasks 9-11 complete

- [ ] **Step 1: Update docs/architecture.md with useViewState**

Add a new section about state management:

```markdown
## State Management (useViewState)

All HistoryPage persistent state is managed by `useViewState` hook, stored in `localStorage` under the key `"strabismus_view_state"`.

### ViewState Shape
```typescript
{
  filters: { dateRange: [start, end], exerciseType: string | null },
  selectedSessions: Set<string>,
  histogramMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>,
  histogramDisplayModes: Set<'individual' | 'meanStddev'>,
  timeSeriesMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>,
  timeSeriesDisplayModes: Set<'individual' | 'meanStddev'>,
  timeSeriesTimeMode: 'absolute' | 'relative',
}
```

### Usage in Components
Components access state via the hook and call setters to update:

```typescript
const { state, toggleHistogramMetric, toggleHistogramDisplayMode, ... } = useViewState();
state.histogramMetrics; // read current metrics
toggleHistogramMetric('deviation'); // toggle metric on/off
```

Persistence is automatic: state changes are debounced and saved to localStorage.
```

- [ ] **Step 2: Update architecture diagram to show useViewState**

Update the data flow diagram to show:

```
useViewState (localStorage)
  ↓
HistoryPage
  ├→ DateFilterBar, ExerciseTypeFilterBar
  ├→ HistoryListView (selection)
  └→ UnifiedSessionPanel
     ├→ TimeSeriesGraph
     └→ HistogramChart
```

- [ ] **Step 3: Update HistogramChart and TimeSeriesGraph descriptions**

Update descriptions to mention:
- Independent metric checkboxes (multiple selection)
- Display mode toggles: "Individual" + "Mean & Std Dev" (independent)
- State persisted via useViewState

Example:

```markdown
### HistogramChart
- Single session: bar chart with selected metric (default: Deviation)
- Aggregate view:
  - Metric checkboxes: select any subset of deviation/X/Y/rotation
  - Display mode toggles (independent): Individual + Mean & Std Dev
  - Individual: thin grey horizontal lines per session per bin
  - Mean & Std Dev: box plot with quartiles, median, whiskers
- All state persisted to localStorage via useViewState
```

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md docs/styling.md
git commit -m "docs: update architecture documentation for useViewState and chart changes"
```

---

## Task 13: Full Integration & Manual Testing

**Files:** None (testing only)

**Dependencies:** All tasks complete

- [ ] **Step 1: End-to-end test scenario 1: Multi-metric selection with persistence**

```bash
npm run dev
```

1. Navigate to HistoryPage
2. Select multiple sessions (shift+click)
3. In HistogramChart, select metrics: [deviation, x, y]
4. Verify three histograms displayed vertically
5. Refresh page (F5)
6. Verify metrics are restored and histograms reappear

Expected: ✓ Multi-metric selection works, persists across navigation

- [ ] **Step 2: End-to-end test scenario 2: Display mode toggling**

1. Ensure multiple sessions selected
2. Toggle "Individual" on, "Mean & Std Dev" off
3. Verify individual session lines appear
4. Toggle "Individual" off, "Mean & Std Dev" on
5. Verify box plot appears
6. Toggle both on
7. Verify both visualizations appear together
8. Refresh page
9. Verify display modes are restored

Expected: ✓ Display modes toggle independently, persist across navigation

- [ ] **Step 3: End-to-end test scenario 3: TimeSeriesGraph consistency**

1. Select multiple sessions
2. In TimeSeriesGraph, select metrics: [deviation, rotation]
3. Toggle "Individual" and "Mean & Std Dev" independently
4. Verify both can be enabled simultaneously
5. Refresh page
6. Verify all state restored

Expected: ✓ TimeSeriesGraph controls match HistogramChart behavior, state persists

- [ ] **Step 4: Single session view has no chart controls**

1. Select a single session from the list
2. In HistogramChart and TimeSeriesGraph, verify no metric/display toggles appear
3. Charts show default visualization (Deviation metric)

Expected: ✓ Single session view is clean, no unnecessary controls

- [ ] **Step 5: Test localStorage behavior**

1. Open browser DevTools → Application → Local Storage
2. Find `"strabismus_view_state"` key
3. Make some selections (metrics, display modes, filters)
4. Verify localStorage entry updates
5. Manually edit localStorage value, refresh page
6. Verify app loads corrupted data gracefully (falls back to defaults)

Expected: ✓ localStorage format is correct, graceful error handling

- [ ] **Step 6: Commit (if manual testing reveals no issues)**

```bash
git add .
git commit -m "test: verify full integration of useViewState, charts, and persistence"
```

---

## Task 14: Bug Fix & Layout Polish (If Needed)

**Files:** TBD based on testing

**Dependencies:** Task 13 complete, any issues found during integration testing

This task is a catch-all for any layout, rendering, or interaction issues discovered during manual testing that weren't caught by the prior tasks. Examples:
- Chart margins/spacing adjustments
- Checkbox/label alignment
- Tooltip positioning
- Scrolling behavior with many metrics

- [ ] **Step 1: Identify any visual or interaction issues from Task 13 testing**

List any problems found (separate from the acceptance criteria in Task 13).

- [ ] **Step 2: Fix each issue**

For each issue:
1. Write a test (if applicable)
2. Implement the fix
3. Verify the test passes
4. Commit

- [ ] **Step 3: Re-test scenarios from Task 13 to verify fixes don't regress**

---

## Acceptance Criteria Checklist

- [ ] useViewState hook created and tested (Tasks 1-2)
- [ ] HistoryPage uses useViewState for filters and selection (Task 3)
- [ ] HistogramChart has metric checkboxes (Task 4)
- [ ] HistogramChart has display mode toggles (Task 5)
- [ ] Individual mode shows horizontal lines per session (Task 6)
- [ ] Mean & Std Dev mode shows box plot (Task 7)
- [ ] HistogramChart layout fixed (no empty space) (Task 8)
- [ ] HistogramChart persists state (Task 9)
- [ ] TimeSeriesGraph merged display modes (Task 10)
- [ ] TimeSeriesGraph persists state (Task 11)
- [ ] Documentation updated (Task 12)
- [ ] Full integration testing passed (Task 13)
- [ ] All bugs/layout issues fixed (Task 14)
- [ ] All tests pass: `npm run test`
- [ ] App builds successfully: `npm run build`
- [ ] No console errors in dev mode

