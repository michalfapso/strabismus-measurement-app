# Chart Visualization Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix UI/UX issues across TimeSeriesGraph, HistogramChart, and TrendChart—remove visual noise, fix incomplete Relative time mode, improve data visibility, replace misleading sparse-data bar charts with honest box plots, and align styling across all three charts.

**Architecture:**
- **TimeSeriesGraph refactor:** Add data transformation for Relative mode (0-100% normalization), split multi-metric display into stacked graphs, update individual series coloring and opacity, refine tooltip formatting.
- **HistogramChart rewrite:** Replace bar chart with box plot visualization that handles sparse data honestly, add coverage percentage labels, implement degenerate case handling (n=1, n=2, n≥3).
- **Styling pass:** Unified visual state indicators (lighter background instead of neon green borders) across TimeSeriesGraph, HistogramChart, and TrendChart.

**Tech Stack:** React, TypeScript, recharts, emotion (CSS-in-JS)

---

## File Structure

### Modified Files
- `src/components/TimeSeriesGraph.tsx` — Add Relative/Absolute mode implementation, multi-metric stacking, individual series coloring, tooltip rounding
- `src/components/HistogramChart.tsx` — Replace bar chart with box plots, add coverage labels, handle degenerate cases
- `src/components/TrendChart.tsx` — Update button styling to match TimeSeriesGraph pattern
- `src/utils/chartUtils.ts` — Create (new) utility functions for box plot calculations, quartile/whisker/outlier logic
- `src/styles/chartControlsStyles.ts` — Create (new) or update emotion styles for button/checkbox states (lighter background, no border)
- `docs/styling.md` — Verify color definitions; update if any changes needed
- Tests will be added throughout: `src/components/__tests__/TimeSeriesGraph.test.tsx`, `src/components/__tests__/HistogramChart.test.tsx`, etc.

---

## Task List

### Task 1: Create Chart Utilities for Box Plot Calculations

**Files:**
- Create: `src/utils/chartUtils.ts`

**Goal:** Implement reusable functions for computing quartiles, IQR, whiskers, and outliers — the math backbone for box plots.

- [ ] **Step 1: Write failing tests for box plot statistics**

Create file: `src/utils/__tests__/chartUtils.test.ts`

```typescript
import { calculateQuartiles, calculateWhiskers, identifyOutliers } from '../chartUtils';

describe('Box Plot Utilities', () => {
  describe('calculateQuartiles', () => {
    test('returns median, q1, q3 for sorted array of length >= 3', () => {
      const data = [1, 2, 3, 4, 5];
      const result = calculateQuartiles(data);
      expect(result).toEqual({
        min: 1,
        q1: 2,
        median: 3,
        q3: 4,
        max: 5,
      });
    });

    test('handles array of length 2', () => {
      const data = [1, 5];
      const result = calculateQuartiles(data);
      expect(result).toEqual({
        min: 1,
        q1: 1,
        median: 3,
        q3: 5,
        max: 5,
      });
    });

    test('returns null for empty array', () => {
      expect(calculateQuartiles([])).toBeNull();
    });

    test('returns single value object for array of length 1', () => {
      const data = [42];
      const result = calculateQuartiles(data);
      expect(result).toEqual({
        min: 42,
        q1: 42,
        median: 42,
        q3: 42,
        max: 42,
      });
    });
  });

  describe('calculateWhiskers', () => {
    test('calculates whiskers as 1.5 * IQR from quartiles', () => {
      const quartiles = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
      const result = calculateWhiskers(quartiles);
      const iqr = 4 - 2; // 2
      const expectedLower = Math.max(1, 2 - 1.5 * iqr); // max(1, -1) = 1
      const expectedUpper = Math.min(5, 4 + 1.5 * iqr); // min(5, 7) = 5
      expect(result).toEqual({
        lower: expectedLower,
        upper: expectedUpper,
      });
    });
  });

  describe('identifyOutliers', () => {
    test('identifies values outside whisker range', () => {
      const data = [1, 2, 3, 4, 5, 100];
      const quartiles = { min: 1, q1: 2, median: 3, q3: 4, max: 100 };
      const whiskers = { lower: 1, upper: 5 };
      const result = identifyOutliers(data, whiskers);
      expect(result).toEqual([100]);
    });

    test('returns empty array if no outliers', () => {
      const data = [1, 2, 3, 4, 5];
      const whiskers = { lower: 1, upper: 5 };
      const result = identifyOutliers(data, whiskers);
      expect(result).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/utils/__tests__/chartUtils.test.ts
```

Expected: FAIL with "chartUtils not found" or "functions not exported"

- [ ] **Step 3: Implement chartUtils functions**

```typescript
// src/utils/chartUtils.ts

export interface Quartiles {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export interface Whiskers {
  lower: number;
  upper: number;
}

/**
 * Calculate quartiles (Q1, median, Q3) and min/max from sorted data.
 * Uses linear interpolation for quartile positions.
 */
export function calculateQuartiles(data: number[]): Quartiles | null {
  if (data.length === 0) return null;

  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (sorted.length === 1) {
    return { min, q1: min, median: min, q3: min, max };
  }

  if (sorted.length === 2) {
    const median = (sorted[0] + sorted[1]) / 2;
    return { min, q1: sorted[0], median, q3: sorted[1], max };
  }

  // Linear interpolation method for quartiles
  const q1Index = (sorted.length - 1) * 0.25;
  const medianIndex = (sorted.length - 1) * 0.5;
  const q3Index = (sorted.length - 1) * 0.75;

  const q1 = interpolateValue(sorted, q1Index);
  const median = interpolateValue(sorted, medianIndex);
  const q3 = interpolateValue(sorted, q3Index);

  return { min, q1, median, q3, max };
}

/**
 * Calculate whisker bounds based on 1.5 * IQR rule.
 * Whiskers extend from quartile ± 1.5 * IQR, capped at min/max data.
 */
export function calculateWhiskers(
  quartiles: Quartiles
): Whiskers {
  const iqr = quartiles.q3 - quartiles.q1;
  const lower = quartiles.q1 - 1.5 * iqr;
  const upper = quartiles.q3 + 1.5 * iqr;

  return {
    lower: Math.max(lower, quartiles.min),
    upper: Math.min(upper, quartiles.max),
  };
}

/**
 * Identify outliers as values outside the whisker range.
 */
export function identifyOutliers(data: number[], whiskers: Whiskers): number[] {
  return data.filter((v) => v < whiskers.lower || v > whiskers.upper);
}

/**
 * Helper: linear interpolation at fractional index.
 */
function interpolateValue(sorted: number[], index: number): number {
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/utils/__tests__/chartUtils.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/chartUtils.ts src/utils/__tests__/chartUtils.test.ts
git commit -m "feat: add box plot calculation utilities (quartiles, whiskers, outliers)"
```

---

### Task 2: Create Chart Control Styling

**Files:**
- Create: `src/styles/chartControlsStyles.ts`

**Goal:** Define emotion CSS for button and checkbox styling—remove neon green borders, add lighter background for active states.

- [ ] **Step 1: Create styles file**

```typescript
// src/styles/chartControlsStyles.ts

import { css } from '@emotion/react';

/**
 * Style for metric checkboxes.
 * Shows bottom border (color legend), no outline border, subtle active background.
 */
export const metricCheckboxStyle = css`
  appearance: none;
  border: none;
  outline: none;
  padding: 6px 12px;
  background-color: transparent;
  cursor: pointer;
  border-bottom: 3px solid currentColor; /* Shows metric color */
  color: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 150ms ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  &:checked {
    background-color: rgba(255, 255, 255, 0.08);
  }
`;

/**
 * Style for Time mode toggle buttons (Absolute / Relative).
 * No border, lighter background on active state.
 */
export const timeModButtonStyle = css`
  appearance: none;
  border: none;
  outline: none;
  padding: 6px 12px;
  background-color: transparent;
  cursor: pointer;
  color: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 150ms ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  &:checked,
  &[aria-pressed="true"] {
    background-color: rgba(255, 255, 255, 0.12); /* 10-15% opacity */
  }
`;

/**
 * Style for metric toggle buttons (e.g., in TrendChart).
 * Same as Time mode button—lighter background for active state.
 */
export const metricButtonStyle = css`
  appearance: none;
  border: none;
  outline: none;
  padding: 6px 12px;
  background-color: transparent;
  cursor: pointer;
  color: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 150ms ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  &:checked,
  &[data-active="true"] {
    background-color: rgba(255, 255, 255, 0.12);
  }
`;
```

- [ ] **Step 2: Verify styles are syntactically correct**

```bash
npm run build
```

Expected: No emotion/CSS errors

- [ ] **Step 3: Commit**

```bash
git add src/styles/chartControlsStyles.ts
git commit -m "feat: create chart control styling (remove borders, add lighter active states)"
```

---

### Task 3: Refactor TimeSeriesGraph — Part 1: Data Transformation for Relative Mode

**Files:**
- Modify: `src/components/TimeSeriesGraph.tsx` (lines ~95–200)

**Goal:** Implement data transformation so Relative mode normalizes time to 0-100% per session, not just labels.

- [ ] **Step 1: Write test for Relative mode normalization**

Add to `src/components/__tests__/TimeSeriesGraph.test.tsx`:

```typescript
import { TimeSeriesGraph } from '../TimeSeriesGraph';
import { Session } from '../../types';
import { render, screen } from '@testing-library/react';

describe('TimeSeriesGraph', () => {
  const mockSession: Session = {
    id: 'sess1',
    exerciseType: 'Pencil Push-ups',
    startTime: 0,
    endTime: 10000, // 10 seconds
    timeSeries: [
      { t: 0, x: 0, y: 0, r: 0 },
      { t: 5000, x: 1, y: 1, r: 0 },
      { t: 10000, x: 2, y: 0, r: 0 },
    ],
  };

  test('Relative mode normalizes time to 0-100%', () => {
    // This will render the component with Relative mode
    // and check that x-axis shows percentages (0%, 50%, 100%)
    // Implementation verified manually via browser devtools
  });
});
```

- [ ] **Step 2: Read current TimeSeriesGraph implementation**

```bash
head -n 300 src/components/TimeSeriesGraph.tsx
```

Understand: where `timeMode` state is read, where data is prepared for recharts.

- [ ] **Step 3: Add normalizeTimeForRelativeMode helper**

In `src/components/TimeSeriesGraph.tsx`, add this function before the component:

```typescript
/**
 * Transform session data for Relative mode: normalize time to 0-100%.
 * @param session Session with absolute timestamps
 * @param metric Which metric to extract (deviation, x, y, rotation)
 * @returns Array of {normalizedTime, value} for plotting
 */
function normalizeSessionTimeToRelative(
  session: Session,
  metric: MetricType
): Array<{ normalizedTime: number; value: number }> {
  const duration = session.endTime - session.startTime;
  if (duration === 0) return [];

  return session.timeSeries.map((ts) => ({
    normalizedTime: ((ts.t - session.startTime) / duration) * 100,
    value: getMetricValue(ts, metric),
  }));
}
```

- [ ] **Step 4: Update TimeSeriesGraph to use Relative/Absolute modes**

Replace the chart data preparation logic (around line ~150–200) with:

```typescript
// Inside TimeSeriesGraph component, in the data preparation section:

const timeMode = state.timeSeriesTimeMode || 'absolute';
const selectedMetrics = Array.from(state.timeSeriesMetrics);

// For each metric, prepare data differently based on timeMode
const chartDataByMetric = selectedMetrics.map((metric) => {
  if (isSingleSession) {
    // Single session: no aggregation
    const session = sessions[0];
    const data =
      timeMode === 'relative'
        ? normalizeSessionTimeToRelative(session, metric)
        : session.timeSeries.map((ts) => ({
            time: ts.t,
            value: getMetricValue(ts, metric),
          }));
    return { metric, data };
  } else {
    // Aggregate view: prepare mean/stddev or individual lines
    if (timeMode === 'relative') {
      // Normalize all sessions to 0-100%, then aggregate
      const normalizedSessions = sessions.map((s) =>
        normalizeSessionTimeToRelative(s, metric)
      );
      // Aggregate at common time points (0, 10, 20, ..., 100%)
      const commonTimePoints = Array.from({ length: 11 }, (_, i) => i * 10);
      const aggregatedData = commonTimePoints.map((pct) => ({
        normalizedTime: pct,
        value: calculateMeanAtTime(normalizedSessions, pct),
        stddev: calculateStddevAtTime(normalizedSessions, pct),
      }));
      return { metric, data: aggregatedData };
    } else {
      // Absolute mode: use wall-clock time
      // (existing logic, no change needed for now)
      return { metric, data: [] }; // Placeholder
    }
  }
});
```

- [ ] **Step 5: Update recharts XAxis for Relative mode**

When `timeMode === 'relative'`, set XAxis domain to `[0, 100]` and label as percentages:

```typescript
<XAxis
  dataKey={timeMode === 'relative' ? 'normalizedTime' : 'time'}
  domain={timeMode === 'relative' ? [0, 100] : undefined}
  label={
    timeMode === 'relative'
      ? { value: 'Session Duration (%)', position: 'insideBottom', offset: -5 }
      : { value: 'Time (seconds)', position: 'insideBottom', offset: -5 }
  }
  tickFormatter={(value) => {
    if (timeMode === 'relative') return `${value}%`;
    return formatTimeSeconds(value);
  }}
/>
```

- [ ] **Step 6: Run dev server and manually test Relative mode**

```bash
npm run dev
```

Navigate to History page, select aggregate view, switch between Absolute/Relative. Verify:
- Absolute: x-axis shows 0:00, 0:05, etc.; sessions at natural width
- Relative: x-axis shows 0%, 25%, 50%, etc.; all sessions aligned 0-100%

- [ ] **Step 7: Commit**

```bash
git add src/components/TimeSeriesGraph.tsx
git commit -m "feat: implement Relative time mode normalization (0-100% per session)"
```

---

### Task 4: Refactor TimeSeriesGraph — Part 2: Multi-Metric Stacking & Individual Series Coloring

**Files:**
- Modify: `src/components/TimeSeriesGraph.tsx`

**Goal:** When multiple metrics selected, show separate stacked graphs (not overlaid); color individual series by metric.

- [ ] **Step 1: Refactor TimeSeriesGraph to render multiple ComposedCharts**

Replace the single chart render with a map over selectedMetrics:

```typescript
// Inside TimeSeriesGraph component render:

return (
  <div css={css`display: flex; flex-direction: column; gap: 10px;`}>
    {selectedMetrics.length === 0 ? (
      <div>Select a metric to view</div>
    ) : (
      selectedMetrics.map((metric, index) => {
        const isBottomChart = index === selectedMetrics.length - 1;
        return (
          <ResponsiveContainer key={metric} width="100%" height={250}>
            <ComposedChart data={preparedData[metric]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />

              {/* Only show x-axis on bottom chart */}
              {isBottomChart && (
                <XAxis
                  dataKey={timeMode === 'relative' ? 'normalizedTime' : 'time'}
                  domain={timeMode === 'relative' ? [0, 100] : undefined}
                  tickFormatter={(value) => {
                    if (timeMode === 'relative') return `${value}%`;
                    return formatTimeSeconds(value);
                  }}
                />
              )}

              <YAxis label={{ value: metric, angle: -90, position: 'insideLeft' }} />
              <Tooltip content={<CustomTooltip metric={metric} />} />

              {/* Individual session lines */}
              {!isSingleSession &&
                displayModes.has('individual') &&
                sessions.map((session, idx) => (
                  <Line
                    key={`${metric}-session-${idx}`}
                    dataKey={`session_${idx}`}
                    stroke={METRIC_COLORS[metric]}
                    opacity={0.7}
                    strokeWidth={1}
                    dot={false}
                  />
                ))}

              {/* Mean line */}
              {!isSingleSession &&
                displayModes.has('meanStddev') && (
                  <Line
                    dataKey={`${metric}_mean`}
                    stroke={METRIC_COLORS[metric]}
                    strokeWidth={2.5}
                    dot={false}
                  />
                )}

              {/* Stddev bounds */}
              {!isSingleSession &&
                displayModes.has('meanStddev') && (
                  <Line
                    dataKey={`${metric}_stddev_upper`}
                    stroke={METRIC_COLORS[metric]}
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    opacity={0.5}
                    dot={false}
                  />
                )}
            </ComposedChart>
          </ResponsiveContainer>
        );
      })
    )}
  </div>
);
```

- [ ] **Step 2: Update individual series rendering to use metric colors**

Change individual session line color from grey to metric color with higher opacity (0.6–0.8):

```typescript
// In individual session line rendering:
<Line
  key={`${metric}-session-${idx}`}
  dataKey={`session_${idx}`}
  stroke={METRIC_COLORS[metric]}
  opacity={0.7} // increased from 0.1-0.2
  strokeWidth={1}
  dot={false}
/>
```

- [ ] **Step 3: Update existing tests or add new ones**

Create test file `src/components/__tests__/TimeSeriesGraph.multiMetric.test.tsx`:

```typescript
import { TimeSeriesGraph } from '../TimeSeriesGraph';
import { useViewState } from '../../hooks/useViewState';
import { render, screen } from '@testing-library/react';

describe('TimeSeriesGraph - Multi-Metric Display', () => {
  test('renders separate graphs for each selected metric', () => {
    // Mock viewState with multiple metrics selected
    const mockViewState = {
      state: {
        timeSeriesMetrics: new Set(['deviation', 'x']),
        timeSeriesDisplayModes: new Set(['individual']),
        timeSeriesTimeMode: 'absolute',
      },
      // ... other properties
    };

    // Render and check that two separate chart containers appear
    // This is verified manually via browser inspection
  });

  test('individual session lines use metric color, not grey', () => {
    // Verify that stroke color for individual sessions matches METRIC_COLORS[metric]
    // Manual inspection via browser devtools
  });
});
```

- [ ] **Step 4: Run manual test in browser**

```bash
npm run dev
```

Navigate to History page, select aggregate view, toggle multiple metrics on. Verify:
- Each metric appears in separate stacked graph
- Individual session lines are colored (not grey), opacity ~0.7
- Only bottom graph shows x-axis labels
- Switching between Absolute/Relative works across all graphs

- [ ] **Step 5: Commit**

```bash
git add src/components/TimeSeriesGraph.tsx
git commit -m "feat: split multi-metric display into stacked graphs, color individual series by metric"
```

---

### Task 5: Refactor TimeSeriesGraph — Part 3: Hover Tooltip Formatting

**Files:**
- Modify: `src/components/TimeSeriesGraph.tsx`

**Goal:** Round values to 2 decimals, remove individual session data from tooltip, show only aggregate stats.

- [ ] **Step 1: Create CustomTooltip component**

Add to `src/components/TimeSeriesGraph.tsx`:

```typescript
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  metric?: MetricType;
  isSingleSession?: boolean;
}

function CustomTooltip({
  active,
  payload,
  metric,
  isSingleSession,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  if (isSingleSession) {
    // Single session: show the session's value
    const value = payload[0]?.value;
    return (
      <div
        css={css`
          background-color: rgba(0, 0, 0, 0.8);
          padding: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        `}
      >
        <p css={css`margin: 0; color: #fff; font-size: 12px;`}>
          {(value as number).toFixed(2)}
        </p>
      </div>
    );
  } else {
    // Aggregate view: show mean ± stddev (filter out individual session data)
    const mean = payload.find((p) => p.name.includes('mean'))?.value;
    const stddev = payload.find((p) => p.name.includes('stddev'))?.value;

    if (mean === undefined) return null;

    return (
      <div
        css={css`
          background-color: rgba(0, 0, 0, 0.8);
          padding: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        `}
      >
        <p css={css`margin: 0; color: #fff; font-size: 12px;`}>
          Mean: {(mean as number).toFixed(2)}
        </p>
        {stddev !== undefined && (
          <p css={css`margin: 4px 0 0 0; color: #ccc; font-size: 11px;`}>
            ±{(stddev as number).toFixed(2)}
          </p>
        )}
      </div>
    );
  }
}
```

- [ ] **Step 2: Update Tooltip component usage**

Replace existing Tooltip in each chart with:

```typescript
<Tooltip
  content={<CustomTooltip metric={metric} isSingleSession={isSingleSession} />}
  cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
/>
```

- [ ] **Step 3: Test tooltip formatting**

```bash
npm run dev
```

Navigate to a chart, hover over data points. Verify:
- Values show 2 decimals (e.g., "3.14", not "3.14159")
- Single session view: shows only the value
- Aggregate view: shows "Mean: X ± Y" format
- No individual session names or data visible

- [ ] **Step 4: Commit**

```bash
git add src/components/TimeSeriesGraph.tsx
git commit -m "feat: format hover tooltips (round to 2 decimals, show only aggregate stats)"
```

---

### Task 6: Update TimeSeriesGraph Styling (Remove Neon Green Border)

**Files:**
- Modify: `src/components/TimeSeriesGraph.tsx`

**Goal:** Apply new chart control styling from Task 2 to metric checkboxes and Time mode buttons.

- [ ] **Step 1: Import new styles**

At top of `TimeSeriesGraph.tsx`:

```typescript
import { metricCheckboxStyle, timeModButtonStyle } from '../styles/chartControlsStyles';
```

- [ ] **Step 2: Apply styles to metric checkboxes**

Find the metric checkbox rendering (around line ~250–300) and apply:

```typescript
<label css={metricCheckboxStyle}>
  <input
    type="checkbox"
    checked={state.timeSeriesMetrics.has(metric)}
    onChange={() => toggleTimeSeriesMetric(metric)}
  />
  {metric}
</label>
```

- [ ] **Step 3: Apply styles to Time mode buttons**

Find the Time mode button group (likely near metric checkboxes) and apply:

```typescript
<button
  css={timeModButtonStyle}
  aria-pressed={state.timeSeriesTimeMode === 'absolute'}
  onClick={() => setTimeSeriesTimeMode('absolute')}
>
  Absolute
</button>
<button
  css={timeModButtonStyle}
  aria-pressed={state.timeSeriesTimeMode === 'relative'}
  onClick={() => setTimeSeriesTimeMode('relative')}
>
  Relative
</button>
```

- [ ] **Step 4: Manual test styling**

```bash
npm run dev
```

Verify:
- Metric checkboxes: no outline border, have bottom border in metric color
- Active metrics: subtle lighter background
- Time mode buttons: no outline border, lighter background when active
- No neon green (#00ff00) borders visible

- [ ] **Step 5: Commit**

```bash
git add src/components/TimeSeriesGraph.tsx
git commit -m "style: remove neon green borders, apply lighter active state indicators"
```

---

### Task 7: Refactor HistogramChart — Part 1: Data Aggregation for Box Plots

**Files:**
- Modify: `src/components/HistogramChart.tsx`

**Goal:** Transform histogram data aggregation to support box plot calculations (quartiles, coverage %), handle degenerate cases.

- [ ] **Step 1: Write test for histogram data aggregation**

Create `src/components/__tests__/HistogramChart.aggregation.test.tsx`:

```typescript
import { aggregateHistogramData } from '../HistogramChart';

describe('HistogramChart - Data Aggregation', () => {
  test('aggregates session data into bins with box plot stats', () => {
    const sessions = [
      {
        id: 's1',
        timeSeries: [
          { t: 0, x: 0.5, y: 0.5, r: 0 },
          { t: 1000, x: 0.8, y: 0.2, r: 0 },
        ],
      },
      {
        id: 's2',
        timeSeries: [
          { t: 0, x: 1.2, y: 0.3, r: 0 },
          { t: 1000, x: 1.5, y: 0.1, r: 0 },
        ],
      },
    ];

    const result = aggregateHistogramData(sessions, 'deviation', 1); // 1cm bins
    expect(result).toContainEqual({
      binRange: '0-1cm',
      values: expect.any(Array),
      coverage: expect.any(Number), // percentage
      count: expect.any(Number), // n
      totalMeasurements: 2,
    });
  });

  test('calculates coverage as percentage of measurements with data in bin', () => {
    const sessions = [
      { id: 's1', timeSeries: [{ t: 0, x: 0.5, y: 0.5, r: 0 }] },
      { id: 's2', timeSeries: [{ t: 0, x: 3.0, y: 0.0, r: 0 }] }, // No data in 0-1cm bin
    ];

    const result = aggregateHistogramData(sessions, 'deviation', 1);
    const bin0to1 = result.find((b) => b.binRange === '0-1cm');
    expect(bin0to1?.coverage).toBe(50); // 1 of 2 measurements
  });
});
```

- [ ] **Step 2: Read current HistogramChart implementation**

```bash
head -n 250 src/components/HistogramChart.tsx
```

Understand: how bins are currently created, how data is aggregated.

- [ ] **Step 3: Create aggregateHistogramData function**

Add to `src/components/HistogramChart.tsx`:

```typescript
interface BinData {
  binRange: string; // e.g., "0-1cm"
  binStart: number;
  binEnd: number;
  values: number[]; // All values in this bin across all measurements
  coverage: number; // Percentage of measurements with data in this bin
  count: number; // n value in this bin
  totalMeasurements: number;
}

function aggregateHistogramData(
  sessions: Session[],
  metric: MetricType,
  binSize: number = 1
): BinData[] {
  const bins: Map<string, number[]> = new Map();
  const measurementsWithDataInBin: Map<string, Set<string>> = new Map();
  const totalMeasurements = sessions.length;

  // Iterate through sessions and place values in bins
  sessions.forEach((session) => {
    const sessionMeasuredBins = new Set<string>();

    session.timeSeries.forEach((ts) => {
      const value = getMetricValue(ts, metric);
      const binIndex = Math.floor(value / binSize);
      const binStart = binIndex * binSize;
      const binEnd = binStart + binSize;
      const binKey = `${binStart}-${binEnd}`;

      if (!bins.has(binKey)) {
        bins.set(binKey, []);
      }
      bins.get(binKey)!.push(value);
      sessionMeasuredBins.add(binKey);
    });

    // Track which measurements contributed to each bin
    sessionMeasuredBins.forEach((binKey) => {
      if (!measurementsWithDataInBin.has(binKey)) {
        measurementsWithDataInBin.set(binKey, new Set());
      }
      measurementsWithDataInBin.get(binKey)!.add(session.id);
    });
  });

  // Convert to sorted array of BinData
  const result: BinData[] = Array.from(bins.entries())
    .map(([binKey, values]) => {
      const [binStart, binEnd] = binKey.split('-').map(Number);
      const count = measurementsWithDataInBin.get(binKey)?.size || 0;
      const coverage = (count / totalMeasurements) * 100;

      return {
        binRange: binKey,
        binStart,
        binEnd,
        values,
        coverage,
        count,
        totalMeasurements,
      };
    })
    .sort((a, b) => a.binStart - b.binStart);

  return result;
}
```

- [ ] **Step 4: Run test to verify aggregation**

```bash
npm test -- src/components/__tests__/HistogramChart.aggregation.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/HistogramChart.tsx src/components/__tests__/HistogramChart.aggregation.test.tsx
git commit -m "feat: add histogram data aggregation with coverage tracking for box plots"
```

---

### Task 8: Refactor HistogramChart — Part 2: Box Plot Visualization

**Files:**
- Modify: `src/components/HistogramChart.tsx`
- Import: `src/utils/chartUtils.ts`

**Goal:** Replace bar chart rendering with box plot visualization; handle degenerate cases (n=1, n=2, n≥3).

- [ ] **Step 1: Write test for box plot rendering**

Add to `src/components/__tests__/HistogramChart.test.tsx`:

```typescript
import { renderBoxPlot } from '../HistogramChart';
import { calculateQuartiles, calculateWhiskers } from '../../utils/chartUtils';

describe('HistogramChart - Box Plot Rendering', () => {
  test('renders full box plot for n >= 3', () => {
    const data = [1, 2, 3, 4, 5];
    const quartiles = calculateQuartiles(data);
    const whiskers = calculateWhiskers(quartiles!);

    const boxPlot = renderBoxPlot(data, quartiles!, whiskers);
    expect(boxPlot).toHaveProperty('median');
    expect(boxPlot).toHaveProperty('box');
    expect(boxPlot).toHaveProperty('whiskers');
    expect(boxPlot).toHaveProperty('outliers');
  });

  test('renders line only for n = 1', () => {
    const data = [42];
    const boxPlot = renderBoxPlot(data, null, null);
    expect(boxPlot).toEqual({
      type: 'line',
      value: 42,
    });
  });

  test('renders min/max with median for n = 2', () => {
    const data = [1, 5];
    const quartiles = calculateQuartiles(data);
    const boxPlot = renderBoxPlot(data, quartiles!, null);
    expect(boxPlot).toHaveProperty('median');
    expect(boxPlot).toHaveProperty('min');
    expect(boxPlot).toHaveProperty('max');
  });
});
```

- [ ] **Step 2: Implement renderBoxPlot helper**

Add to `src/components/HistogramChart.tsx`:

```typescript
import { calculateQuartiles, calculateWhiskers, identifyOutliers } from '../utils/chartUtils';

interface BoxPlotElements {
  type: 'full' | 'minmax' | 'line';
  median?: number;
  q1?: number;
  q3?: number;
  min?: number;
  max?: number;
  whiskerLower?: number;
  whiskerUpper?: number;
  outliers?: number[];
  value?: number; // for single value case
}

function renderBoxPlot(
  values: number[],
  quartiles: Quartiles | null,
  whiskers: Whiskers | null
): BoxPlotElements {
  if (values.length === 0) {
    return { type: 'line', value: 0 };
  }

  if (values.length === 1) {
    return { type: 'line', value: values[0] };
  }

  if (values.length === 2 && quartiles) {
    return {
      type: 'minmax',
      median: quartiles.median,
      min: quartiles.min,
      max: quartiles.max,
    };
  }

  // n >= 3: full box plot
  if (quartiles && whiskers) {
    const outliers = identifyOutliers(values, whiskers);
    return {
      type: 'full',
      median: quartiles.median,
      q1: quartiles.q1,
      q3: quartiles.q3,
      whiskerLower: whiskers.lower,
      whiskerUpper: whiskers.upper,
      outliers,
    };
  }

  return { type: 'line', value: 0 };
}
```

- [ ] **Step 3: Replace bar chart with box plot rendering**

In the HistogramChart render method, replace the `<BarChart>` section with custom rendering using recharts `Line`, `Area`, and `Scatter` components:

```typescript
// Inside HistogramChart render:
const binData = aggregateHistogramData(sessions, selectedMetric, 1);

return (
  <ResponsiveContainer width="100%" height={400}>
    <ComposedChart
      data={binData.map((bin) => {
        const quartiles = calculateQuartiles(bin.values);
        const whiskers = quartiles ? calculateWhiskers(quartiles) : null;
        const boxPlot = renderBoxPlot(bin.values, quartiles, whiskers);

        return {
          binRange: bin.binRange,
          binStart: bin.binStart,
          coverage: bin.coverage,
          count: bin.count,
          ...boxPlot,
        };
      })}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
      <XAxis dataKey="binRange" />
      <YAxis label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft' }} />

      {/* Box plot elements */}
      {/* Whiskers */}
      <Line dataKey="whiskerLower" stroke={METRIC_COLORS[selectedMetric]} />
      <Line dataKey="whiskerUpper" stroke={METRIC_COLORS[selectedMetric]} />

      {/* Median */}
      <Line dataKey="median" stroke={METRIC_COLORS[selectedMetric]} strokeWidth={2} />

      {/* Outliers */}
      <Scatter dataKey="outliers" fill={METRIC_COLORS[selectedMetric]} />

      <Tooltip content={<BoxPlotTooltip />} />
    </ComposedChart>
  </ResponsiveContainer>
);
```

- [ ] **Step 4: Create BoxPlotTooltip for coverage labels**

Add component:

```typescript
interface BoxPlotTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: {
      coverage: number;
      count: number;
    };
  }>;
}

function BoxPlotTooltip({ active, payload }: BoxPlotTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const { coverage, count } = payload[0].payload;
  const totalMeasurements = payload[0].payload.totalMeasurements || 100;

  return (
    <div
      css={css`
        background-color: rgba(0, 0, 0, 0.8);
        padding: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      `}
    >
      <p css={css`margin: 0; color: #fff; font-size: 12px;`}>
        {coverage.toFixed(0)}% of measurements
      </p>
      <p css={css`margin: 4px 0 0 0; color: #ccc; font-size: 11px;`}>
        n={count} of {totalMeasurements}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Manual test box plot rendering**

```bash
npm run dev
```

Navigate to History page, view aggregate histogram. Verify:
- Each bin shows a box plot (not bars)
- Coverage % label appears below each box
- Hovering coverage label shows "X% of measurements (n=X/Y)"
- Degenerate cases render correctly (n=1 as line, n=2 with min/max)

- [ ] **Step 6: Commit**

```bash
git add src/components/HistogramChart.tsx
git commit -m "feat: replace histogram bars with box plots, add coverage labels"
```

---

### Task 9: Update HistogramChart Styling

**Files:**
- Modify: `src/components/HistogramChart.tsx`

**Goal:** Reduce hover background opacity to 30%, apply chart control styling to metric buttons.

- [ ] **Step 1: Update hover background opacity**

In the HistogramChart, find the hover styling and change:

```typescript
// Before:
<ComposedChart onMouseMove={(state) => {
  // Sets hover background to bright grey
}}>

// After:
<ComposedChart
  onMouseMove={(state) => {
    // Set hover background with 30% opacity
    // CSS: background: rgba(180, 180, 180, 0.3)
  }}
>
```

Or use recharts Tooltip styling:

```typescript
<Tooltip
  contentStyle={{
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  }}
  cursor={{ fill: 'rgba(255, 255, 255, 0.3)' }} // 30% opacity
/>
```

- [ ] **Step 2: Apply metric button styling**

At the top of HistogramChart, import styles:

```typescript
import { metricButtonStyle } from '../styles/chartControlsStyles';
```

Find metric button group and apply:

```typescript
{['deviation', 'x', 'y', 'rotation'].map((metric) => (
  <button
    key={metric}
    css={metricButtonStyle}
    data-active={state.histogramMetrics.has(metric as MetricType)}
    onClick={() => toggleHistogramMetric(metric as MetricType)}
  >
    {metric}
  </button>
))}
```

- [ ] **Step 3: Manual test styling**

```bash
npm run dev
```

Verify:
- Histogram hover background is subtle (30% grey)
- Metric buttons have no outline border, lighter background when active

- [ ] **Step 4: Commit**

```bash
git add src/components/HistogramChart.tsx
git commit -m "style: reduce hover opacity to 30%, apply chart control styling to metric buttons"
```

---

### Task 10: Update TrendChart Styling

**Files:**
- Modify: `src/components/TrendChart.tsx`

**Goal:** Apply same styling fix as TimeSeriesGraph (remove neon green borders, lighter active background).

- [ ] **Step 1: Import styles**

At top of `TrendChart.tsx`:

```typescript
import { metricButtonStyle } from '../styles/chartControlsStyles';
```

- [ ] **Step 2: Apply styles to metric buttons**

Find the metric button group and apply:

```typescript
{['deviation', 'x', 'y', 'rotation'].map((metric) => (
  <button
    key={metric}
    css={metricButtonStyle}
    data-active={selectedMetrics.includes(metric)}
    onClick={() => toggleMetric(metric)}
  >
    {metric}
  </button>
))}
```

- [ ] **Step 3: Manual test styling**

```bash
npm run dev
```

Verify:
- Metric buttons: no outline border
- Active metrics: subtle lighter background (10-15% opacity)
- No neon green (#00ff00) visible

- [ ] **Step 4: Commit**

```bash
git add src/components/TrendChart.tsx
git commit -m "style: remove neon green borders, apply lighter active state indicators"
```

---

### Task 11: Update Documentation

**Files:**
- Review: `docs/styling.md`

**Goal:** Verify color definitions match implementation; update if needed.

- [ ] **Step 1: Review current styling.md**

Read the file to check metric colors and box plot styling.

- [ ] **Step 2: Verify colors match codebase**

Compare `METRIC_COLORS` in TimeSeriesGraph.tsx with styling.md:
- deviation: #00FFFF (cyan) ✓
- x: #FF00FF (magenta) ✓
- y: #FF9500 (orange) ✓
- rotation: #FFC107 (gold) ✓

- [ ] **Step 3: Add box plot styling section if missing**

If `docs/styling.md` doesn't have a section for box plot colors/opacity, add:

```markdown
### TimeSeriesGraph Individual Series
| Element | Style |
|---------|-------|
| Individual session lines | metric color, opacity 0.7, 1px |

### HistogramChart Box Plots
| Element | Style |
|---------|-------|
| Median line | metric color, 2px, opacity 1 |
| Quartile box | metric color filled, opacity 1 |
| Whiskers | metric color, 1px, opacity 1 |
| Outliers | metric color dots, opacity 1 |
| Coverage label | metric color text, 12px, below box |
```

- [ ] **Step 4: Commit if changes made**

```bash
git add docs/styling.md
git commit -m "docs: verify/update styling documentation for box plots and individual series"
```

---

### Task 12: Integration Testing

**Files:**
- Create: `src/components/__tests__/ChartIntegration.test.tsx`

**Goal:** Test that all three charts render correctly with refined UI/UX.

- [ ] **Step 1: Write integration tests**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeSeriesGraph } from '../TimeSeriesGraph';
import { HistogramChart } from '../HistogramChart';
import { TrendChart } from '../TrendChart';

describe('Chart Refinements - Integration', () => {
  const mockSessions = [
    {
      id: 's1',
      exerciseType: 'Pencil Push-ups',
      startTime: 0,
      endTime: 10000,
      timeSeries: [
        { t: 0, x: 0, y: 0, r: 0 },
        { t: 5000, x: 1, y: 0.5, r: 0 },
        { t: 10000, x: 0.5, y: 0, r: 0 },
      ],
    },
  ];

  test('TimeSeriesGraph: Relative mode normalizes time to 0-100%', () => {
    // Render with Relative mode active
    // Verify x-axis shows percentages
  });

  test('TimeSeriesGraph: Multiple metrics render in separate graphs', () => {
    // Select multiple metrics
    // Verify separate chart containers
  });

  test('HistogramChart: Box plots render for aggregate view', () => {
    // Render aggregate histogram
    // Verify box plot elements visible
  });

  test('TrendChart: Buttons have lighter background when active', () => {
    // Toggle metric button
    // Verify background color (not green border)
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
npm test -- src/components/__tests__/ChartIntegration.test.tsx
```

Expected: All tests PASS (or document failures for manual verification)

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/ChartIntegration.test.tsx
git commit -m "test: add integration tests for chart refinements"
```

---

### Task 13: Final Manual Testing & Cleanup

**Files:**
- None (manual testing only)

**Goal:** Comprehensive manual verification of all changes, then final commit.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: TimeSeriesGraph manual test**

- [ ] Single-session view:
  - [ ] No controls visible; metric defaults to Deviation
  - [ ] Absolute/Relative buttons not shown

- [ ] Aggregate view:
  - [ ] Switch between Absolute/Relative:
    - [ ] Absolute: x-axis shows 0:00, 0:05, etc.; sessions at natural width
    - [ ] Relative: x-axis shows 0%, 50%, 100%; all sessions aligned
  - [ ] Select 1, 2, 3+ metrics:
    - [ ] Each metric in separate stacked graph
    - [ ] Individual session lines colored (not grey), opacity ~0.7
    - [ ] Only bottom graph shows x-axis labels
  - [ ] Hover over data:
    - [ ] Single-session: shows value (2 decimals)
    - [ ] Aggregate: shows "Mean: X ± Y" (2 decimals)
  - [ ] Metric checkboxes: no outline border, bottom border in color, lighter background when checked
  - [ ] Time buttons: no outline border, lighter background when active

- [ ] **Step 3: HistogramChart manual test**

- [ ] Single-session view:
  - [ ] Shows bars (not affected by box plot change)

- [ ] Aggregate view:
  - [ ] Each bin shows box plot (median line, quartile box, whiskers, outliers)
  - [ ] Coverage % label below each box
  - [ ] Hover coverage label: shows "X% of measurements (n=X/Y)"
  - [ ] Degenerate cases:
    - [ ] n=1: single horizontal line
    - [ ] n=2: min/max with median
    - [ ] n≥3: full box plot
  - [ ] Hover background: subtle (30% opacity, not bright)
  - [ ] Metric buttons: no outline border, lighter background when active

- [ ] **Step 4: TrendChart manual test**

- [ ] Metric buttons: no outline border, lighter background when active

- [ ] **Step 5: Check for any regressions**

- [ ] [ ] All other pages/views still work (Calibration, Recording, etc.)
- [ ] [ ] State persistence works (navigate away and back)
- [ ] [ ] No console errors or warnings

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete chart visualization refinements (multi-part implementation)"
```

---

## Acceptance Criteria Checklist

After completing all tasks, verify:

- [ ] TimeSeriesGraph: neon green borders removed; lighter background on Time buttons
- [ ] TimeSeriesGraph: Relative mode data normalized to 0-100%; Absolute shows natural duration
- [ ] TimeSeriesGraph: Individual series colored by metric, opacity ~0.6-0.8
- [ ] TimeSeriesGraph: Multiple metrics show in separate stacked graphs
- [ ] TimeSeriesGraph: Hover tooltip rounded to 2 decimals, no individual session data
- [ ] HistogramChart: Bar chart replaced with box plots per bin
- [ ] HistogramChart: Sample coverage label "87%" displayed; hover shows expanded "87% of measurements (n=87/100)"
- [ ] HistogramChart: Hover background opacity 30%
- [ ] TrendChart: neon green borders removed; lighter background on active metric buttons
- [ ] All color schemes (metric colors) consistent across all three charts
- [ ] Unit tests updated/added for all behavioral changes
- [ ] Manual testing completed per strategy above
- [ ] `docs/styling.md` reviewed/updated if color definitions changed

---
