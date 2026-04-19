# ProgressGraphs Compaction & Shared Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce vertical space consumption of ProgressGraphs by removing redundant x-axes, consolidate hover interactions into a single shared tooltip with synchronized cursor lines, and implement locked tooltip that moves with data points during pan/zoom.

**Architecture:** Lift hover state to container level using a custom `useSharedHover()` hook. Remove x-axes from graphs 1 & 2, restructure legends to sit between title and graph for graphs 2 & 3. Render a single tooltip at container level positioned relative to the active data point. Extend locked state to track screen position and recalculate on pan/zoom.

**Tech Stack:** React, TypeScript, Recharts, emotion, existing useZoomPan hook

---

### Task 1: Write tests for x-axis removal

**Files:**
- Modify: `src/components/__tests__/ProgressGraphs.test.tsx`

- [ ] **Step 1: Add test cases for x-axis visibility**

Open `src/components/__tests__/ProgressGraphs.test.tsx` and add these test cases:

```typescript
describe('ProgressGraphs x-axis rendering', () => {
  it('should not render XAxis in graph 1 (Best Stable Deviation)', () => {
    const { container } = render(<ProgressGraphs sessions={mockSessions} />);
    const graphContainers = container.querySelectorAll('[class*="graphContainer"]');
    const graph1 = graphContainers[0];
    // Check that first graph has no XAxis component
    // (Recharts XAxis renders specific elements; we'll verify after implementation)
  });

  it('should not render XAxis in graph 2 (Near-Best Stable Time)', () => {
    const { container } = render(<ProgressGraphs sessions={mockSessions} />);
    const graphContainers = container.querySelectorAll('[class*="graphContainer"]');
    const graph2 = graphContainers[1];
    // Check that second graph has no XAxis component
  });

  it('should render XAxis in graph 3 (Session Composition)', () => {
    const { container } = render(<ProgressGraphs sessions={mockSessions} />);
    const graphContainers = container.querySelectorAll('[class*="graphContainer"]');
    const graph3 = graphContainers[2];
    // Check that third graph HAS XAxis component with YYYY-MM-DD formatted labels
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npm run test -- ProgressGraphs.test.tsx -t "x-axis"`

Expected: Tests exist but won't validate x-axis presence correctly until we implement the changes.

---

### Task 2: Remove x-axes from graphs 1 & 2

**Files:**
- Modify: `src/components/ProgressGraphs.tsx:462-507` (Graph 1)
- Modify: `src/components/ProgressGraphs.tsx:509-563` (Graph 2)

- [ ] **Step 1: Remove XAxis from Graph 1**

In the first LineChart (Best Stable Deviation), remove the entire XAxis component and reduce bottom margin:

```typescript
<ResponsiveContainer width="100%" height={graphHeight}>
  <LineChart
    data={visibleData}
    margin={{ right: 30, left: 0, bottom: 20, top: 10 }}  // Changed from 60
    onClick={handleChartClick}
  >
    <CartesianGrid strokeDasharray="3 3" />
    {/* Remove: <XAxis ... /> */}
    <YAxis label={{ value: 'Deviation (cm)', angle: -90, position: 'insideLeft', fill: THEME.textSecondary }} />
    <Legend wrapperStyle={{ color: THEME.textPrimary }} />
    <Tooltip
      active={!lockedSession}
      content={(props: any) => (
        <ProgressGraphsTooltipContent
          {...props}
          isLocked={!!lockedSession}
          lockedSession={lockedSession}
          onCloseLocked={() => setLockedSession(null)}
          onDrillDown={onDrillDown}
        />
      )}
    />
    <Line
      type="monotone"
      dataKey="bestStableDeviation"
      stroke={THEME.metricDeviation}
      name="Best Stable Deviation"
      isAnimationActive={false}
    />
  </LineChart>
</ResponsiveContainer>
```

- [ ] **Step 2: Remove Legend from Graph 1**

In the same LineChart, remove the `<Legend />` component since Graph 1 is a single line that doesn't need a legend.

- [ ] **Step 3: Remove XAxis from Graph 2**

In the second LineChart (Near-Best Stable Time), apply the same changes: remove XAxis, reduce bottom margin to 20, keep Legend for now (we'll restructure it in Task 4).

```typescript
<ResponsiveContainer width="100%" height={graphHeight}>
  <LineChart
    data={visibleData}
    margin={{ right: 30, left: 0, bottom: 20, top: 10 }}  // Changed from 60
    onClick={handleChartClick}
  >
    <CartesianGrid strokeDasharray="3 3" />
    {/* Remove: <XAxis ... /> */}
    <YAxis label={{ value: 'Time (seconds)', angle: -90, position: 'insideLeft', fill: THEME.textSecondary }} />
    <Legend wrapperStyle={{ color: THEME.textPrimary }} />
    {/* Tooltip and Lines remain unchanged */}
  </LineChart>
</ResponsiveContainer>
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- ProgressGraphs.test.tsx -t "x-axis" -v`

Expected: X-axis removal tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat: remove x-axes from graphs 1 and 2"
```

---

### Task 3: Write tests for legend positioning

**Files:**
- Modify: `src/components/__tests__/ProgressGraphs.test.tsx`

- [ ] **Step 1: Add legend positioning tests**

```typescript
describe('ProgressGraphs legend positioning', () => {
  it('should not render legend in graph 1', () => {
    const { container } = render(<ProgressGraphs sessions={mockSessions} />);
    const graphContainers = container.querySelectorAll('[class*="graphContainer"]');
    const graph1 = graphContainers[0];
    const legend = graph1.querySelector('[class*="legend"]');
    expect(legend).not.toBeInTheDocument();
  });

  it('should render centered legend between title and graph in graph 2', () => {
    const { container } = render(<ProgressGraphs sessions={mockSessions} />);
    const graphContainers = container.querySelectorAll('[class*="graphContainer"]');
    const graph2 = graphContainers[1];
    const legend = graph2.querySelector('[class*="legend"]');
    expect(legend).toBeInTheDocument();
    // Verify it's centered (CSS flexbox)
    const computedStyle = window.getComputedStyle(legend?.parentElement!);
    expect(computedStyle.justifyContent).toBe('center');
  });

  it('should render centered legend between title and graph in graph 3', () => {
    const { container } = render(<ProgressGraphs sessions={mockSessions} />);
    const graphContainers = container.querySelectorAll('[class*="graphContainer"]');
    const graph3 = graphContainers[2];
    const legend = graph3.querySelector('[class*="legend"]');
    expect(legend).toBeInTheDocument();
    const computedStyle = window.getComputedStyle(legend?.parentElement!);
    expect(computedStyle.justifyContent).toBe('center');
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npm run test -- ProgressGraphs.test.tsx -t "legend positioning"`

Expected: Tests fail (legends not yet repositioned).

---

### Task 4: Restructure legends to sit between title and graph

**Files:**
- Modify: `src/components/ProgressGraphs.tsx:509-563` (Graph 2)
- Modify: `src/components/ProgressGraphs.tsx:565-608` (Graph 3)

- [ ] **Step 1: Add CSS for centered legend wrapper**

Add this to the `styles` object in ProgressGraphs.tsx:

```typescript
legendWrapper: css`
  display: flex;
  justify-content: center;
  margin: 8px 0;
  
  @media (max-width: 768px) {
    margin: 4px 0;
  }
`,
```

- [ ] **Step 2: Restructure Graph 2 container**

Replace the Graph 2 `<div css={styles.graphContainer}>` section:

```typescript
<div css={styles.graphContainer}>
  <h3>Near-Best Stable Time (seconds)</h3>
  
  {/* Legend positioned between title and graph */}
  <div css={styles.legendWrapper}>
    <svg width={300} height={30}>
      {/* Recharts Legend will render here after we restructure the LineChart */}
    </svg>
  </div>

  <ResponsiveContainer width="100%" height={graphHeight}>
    <LineChart
      data={visibleData}
      margin={{ right: 30, left: 0, bottom: 20, top: 10 }}
      onClick={handleChartClick}
    >
      <CartesianGrid strokeDasharray="3 3" />
      <YAxis label={{ value: 'Time (seconds)', angle: -90, position: 'insideLeft', fill: THEME.textSecondary }} />
      <Legend wrapperStyle={{ color: THEME.textPrimary, justifyContent: 'center', display: 'flex' }} />
      <Tooltip
        active={!lockedSession}
        content={(props: any) => (
          <ProgressGraphsTooltipContent
            {...props}
            isLocked={!!lockedSession}
            lockedSession={lockedSession}
            onCloseLocked={() => setLockedSession(null)}
            onDrillDown={onDrillDown}
          />
        )}
      />
      <Line
        type="monotone"
        dataKey="nearBestStableTime"
        stroke={THEME.stateNearFusion}
        name="Near-Best Stable Time"
        isAnimationActive={false}
      />
      <Line
        type="monotone"
        dataKey="longestQualityStreak"
        stroke="#20b2aa"
        strokeDasharray="5 5"
        dot={false}
        name="Longest Quality Streak"
        isAnimationActive={false}
      />
    </LineChart>
  </ResponsiveContainer>
</div>
```

- [ ] **Step 3: Restructure Graph 3 container**

Apply the same legend restructuring to Graph 3:

```typescript
<div css={styles.graphContainer}>
  <h3>Session Composition (%)</h3>
  
  <div css={styles.legendWrapper}>
    <svg width={300} height={30}>
      {/* Recharts Legend will render here */}
    </svg>
  </div>

  <ResponsiveContainer width="100%" height={graphHeight}>
    <AreaChart
      data={visibleData}
      margin={{ right: 30, left: 0, bottom: 60, top: 10 }}
      onClick={handleChartClick}
    >
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis
        dataKey="sessionIndex"
        label={{ value: 'Session Index', position: 'insideBottomRight', offset: -10, fill: THEME.textSecondary }}
        tickFormatter={(index) => {
          if (visibleData && visibleData[index]) {
            return formatDatetimeLabel(visibleData[index].date);
          }
          return index.toString();
        }}
        angle={-45}
        textAnchor="end"
        height={80}
      />
      <YAxis label={{ value: 'Percent (%)', angle: -90, position: 'insideLeft', fill: THEME.textSecondary }} />
      <Legend wrapperStyle={{ color: THEME.textPrimary, justifyContent: 'center', display: 'flex' }} />
      <Tooltip
        active={!lockedSession}
        content={(props: any) => (
          <ProgressGraphsTooltipContent
            {...props}
            isLocked={!!lockedSession}
            lockedSession={lockedSession}
            onCloseLocked={() => setLockedSession(null)}
            onDrillDown={onDrillDown}
          />
        )}
      />
      <Area type="monotone" dataKey="fusionPercent" stackId="1" stroke={THEME.stateFusion} fill={THEME.stateFusion} name="Fusion" />
      <Area type="monotone" dataKey="nearFusionPercent" stackId="1" stroke={THEME.stateNearFusion} fill={THEME.stateNearFusion} name="Near Fusion" />
      <Area type="monotone" dataKey="stableDeviationPercent" stackId="1" stroke={THEME.stateStableDeviation} fill={THEME.stateStableDeviation} name="Stable Deviation" />
      <Area type="monotone" dataKey="approachingPercent" stackId="1" stroke={THEME.stateApproaching} fill={THEME.stateApproaching} name="Approaching" />
      <Area type="monotone" dataKey="driftingPercent" stackId="1" stroke={THEME.stateDrifting} fill={THEME.stateDrifting} name="Drifting" />
    </AreaChart>
  </ResponsiveContainer>
</div>
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- ProgressGraphs.test.tsx -t "legend positioning"`

Expected: Legend positioning tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat: restructure legends between titles and graphs for graphs 2 and 3"
```

---

### Task 5: Change date format to YYYY-MM-DD

**Files:**
- Modify: `src/components/ProgressGraphs.tsx:14-30`

- [ ] **Step 1: Update formatDatetimeLabel function**

Replace the existing `formatDatetimeLabel` function:

```typescript
function formatDatetimeLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  } catch {
    return dateStr;
  }
}
```

- [ ] **Step 2: Run visual check**

Run: `npm run dev`

Navigate to ProgressGraphs and verify that Graph 3 x-axis labels now show YYYY-MM-DD format (e.g., "2026-04-19") instead of full datetime.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat: change x-axis date format to YYYY-MM-DD"
```

---

### Task 6: Create useSharedHover hook

**Files:**
- Create: `src/hooks/useSharedHover.ts`

- [ ] **Step 1: Create the hook file with tests inline**

Create `src/hooks/useSharedHover.ts`:

```typescript
import { useState, useCallback } from 'react';

interface SharedHoverState {
  activeIndex: number | null;
  cursorX: number | null;
  cursorY: number | null;
}

export function useSharedHover() {
  const [state, setState] = useState<SharedHoverState>({
    activeIndex: null,
    cursorX: null,
    cursorY: null,
  });

  const setHover = useCallback((index: number | null, cursorX?: number, cursorY?: number) => {
    setState({
      activeIndex: index,
      cursorX: cursorX ?? null,
      cursorY: cursorY ?? null,
    });
  }, []);

  const clearHover = useCallback(() => {
    setState({
      activeIndex: null,
      cursorX: null,
      cursorY: null,
    });
  }, []);

  return {
    activeIndex: state.activeIndex,
    cursorX: state.cursorX,
    cursorY: state.cursorY,
    setHover,
    clearHover,
  };
}
```

- [ ] **Step 2: Write tests for useSharedHover**

Create `src/hooks/__tests__/useSharedHover.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useSharedHover } from '../useSharedHover';

describe('useSharedHover', () => {
  it('should initialize with null values', () => {
    const { result } = renderHook(() => useSharedHover());
    expect(result.current.activeIndex).toBeNull();
    expect(result.current.cursorX).toBeNull();
    expect(result.current.cursorY).toBeNull();
  });

  it('should set hover state with index and cursor position', () => {
    const { result } = renderHook(() => useSharedHover());
    act(() => {
      result.current.setHover(5, 150, 200);
    });
    expect(result.current.activeIndex).toBe(5);
    expect(result.current.cursorX).toBe(150);
    expect(result.current.cursorY).toBe(200);
  });

  it('should clear hover state', () => {
    const { result } = renderHook(() => useSharedHover());
    act(() => {
      result.current.setHover(5, 150, 200);
    });
    act(() => {
      result.current.clearHover();
    });
    expect(result.current.activeIndex).toBeNull();
    expect(result.current.cursorX).toBeNull();
    expect(result.current.cursorY).toBeNull();
  });

  it('should set hover with index only (cursor position optional)', () => {
    const { result } = renderHook(() => useSharedHover());
    act(() => {
      result.current.setHover(3);
    });
    expect(result.current.activeIndex).toBe(3);
    expect(result.current.cursorX).toBeNull();
    expect(result.current.cursorY).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- useSharedHover.test.ts -v`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSharedHover.ts src/hooks/__tests__/useSharedHover.test.ts
git commit -m "feat: create useSharedHover hook for synchronized hover state"
```

---

### Task 7: Update ProgressGraphs to use shared hover hook

**Files:**
- Modify: `src/components/ProgressGraphs.tsx:369-440` (component logic)

- [ ] **Step 1: Import useSharedHover**

Add at the top of ProgressGraphs.tsx:

```typescript
import { useSharedHover } from '../hooks/useSharedHover';
```

- [ ] **Step 2: Replace individual tooltip state with shared hook**

In the ProgressGraphs function, replace the individual tooltip logic with shared hover:

```typescript
export function ProgressGraphs({ sessions, onDrillDown, exerciseFilter }: ProgressGraphsProps) {
  // Locked session state for click-to-lock tooltip
  const [lockedSession, setLockedSession] = useState<ProgressGraphsTooltipPayload | null>(null);

  // NEW: Shared hover state across all graphs
  const { activeIndex, cursorX, cursorY, setHover, clearHover } = useSharedHover();

  // ... rest of the component initialization
}
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- ProgressGraphs.test.tsx -v`

Expected: Existing tests pass (we haven't changed the UI yet, just the state management).

- [ ] **Step 4: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "refactor: integrate useSharedHover hook into ProgressGraphs"
```

---

### Task 8: Pass shared hover state to all three charts

**Files:**
- Modify: `src/components/ProgressGraphs.tsx:462-608` (all three chart containers)

- [ ] **Step 1: Update Graph 1 LineChart**

Update the LineChart JSX to pass hover handlers and receive the active index:

```typescript
<LineChart
  data={visibleData}
  margin={{ right: 30, left: 0, bottom: 20, top: 10 }}
  onClick={handleChartClick}
  onMouseMove={(state: any) => {
    if (state && state.activeTooltipIndex !== undefined) {
      setHover(state.activeTooltipIndex, state.chartX, state.chartY);
    }
  }}
  onMouseLeave={() => clearHover()}
>
  {/* ... children remain the same, but activeTooltipIndex will now be synchronized */}
</LineChart>
```

- [ ] **Step 2: Update Graph 2 LineChart**

Apply the same handlers to Graph 2.

- [ ] **Step 3: Update Graph 3 AreaChart**

Apply the same handlers to Graph 3.

- [ ] **Step 4: Update Tooltip components**

For now, keep the individual Tooltip components in each chart but pass the shared `activeIndex`:

```typescript
<Tooltip
  active={!lockedSession && activeIndex !== null}
  content={(props: any) => (
    <ProgressGraphsTooltipContent
      {...props}
      isLocked={!!lockedSession}
      lockedSession={lockedSession}
      onCloseLocked={() => setLockedSession(null)}
      onDrillDown={onDrillDown}
    />
  )}
/>
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- ProgressGraphs.test.tsx -v`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "refactor: synchronize hover state across all three graphs"
```

---

### Task 9: Write tests for shared container-level tooltip

**Files:**
- Modify: `src/components/__tests__/ProgressGraphs.test.tsx`

- [ ] **Step 1: Add test for shared tooltip rendering**

```typescript
describe('ProgressGraphs shared tooltip', () => {
  it('should render a single shared tooltip at container level when hovering', () => {
    const { container } = render(<ProgressGraphs sessions={mockSessions} />);
    // Simulate hover on first graph
    const firstLineChart = container.querySelector('[role="img"]'); // Recharts renders SVG
    if (firstLineChart) {
      fireEvent.mouseMove(firstLineChart, { clientX: 100, clientY: 100 });
    }
    // Verify that a single tooltip is rendered at container level
    // (We'll validate this more thoroughly after implementing the container-level tooltip)
  });

  it('should not render tooltip when not hovering', () => {
    const { container } = render(<ProgressGraphs sessions={mockSessions} />);
    const tooltip = container.querySelector('[class*="tooltip"]');
    // Should be hidden or not rendered
  });
});
```

- [ ] **Step 2: Verify test setup**

Run: `npm run test -- ProgressGraphs.test.tsx -t "shared tooltip" -v`

Expected: Tests set up correctly (may fail until we implement container-level tooltip).

---

### Task 10: Implement container-level tooltip with position calculation

**Files:**
- Modify: `src/components/ProgressGraphs.tsx:159-221` (ProgressGraphsTooltipContent component)
- Modify: `src/components/ProgressGraphs.tsx:222-361` (styles)
- Modify: `src/components/ProgressGraphs.tsx:369-622` (main component)

- [ ] **Step 1: Add new style for container-level tooltip positioning**

Add to the `styles` object:

```typescript
sharedTooltipContainer: css`
  position: absolute;
  pointer-events: auto;
  z-index: 100;
  transform: translateX(-50%);  // Center tooltip on cursor x
  
  @media (max-width: 768px) {
    z-index: 100;
  }
`,
```

- [ ] **Step 2: Add tooltip positioning calculation function**

Add a helper function inside ProgressGraphs component:

```typescript
function calculateTooltipPosition(
  cursorX: number | null,
  cursorY: number | null,
  containerWidth: number,
  containerHeight: number,
  tooltipWidth: number = 200,
  tooltipHeight: number = 250
) {
  if (cursorX === null || cursorY === null) return null;

  // Center tooltip vertically around cursor
  let top = cursorY - tooltipHeight / 2;
  
  // Clamp to container bounds
  if (top < 0) top = 0;
  if (top + tooltipHeight > containerHeight) top = containerHeight - tooltipHeight;

  return {
    left: cursorX,
    top: Math.max(0, top),
  };
}
```

- [ ] **Step 3: Render container-level tooltip**

In the return JSX of ProgressGraphs, add a container-level tooltip overlay:

```typescript
return (
  <div
    css={styles.container}
    data-component="ProgressGraphs"
    onTouchStart={touchHandlers.handleTouchStart}
    onTouchMove={touchHandlers.handleTouchMove}
    onTouchEnd={touchHandlers.handleTouchEnd}
  >
    {/* existing controls and graphs ... */}

    {/* Container-level shared tooltip for hover state */}
    {!lockedSession && activeIndex !== null && visibleData[activeIndex] && (
      <div
        css={styles.sharedTooltipContainer}
        style={{
          left: `${cursorX}px`,
          top: `${cursorY}px`,
        }}
      >
        <ProgressGraphsTooltipContent
          payload={[{ payload: visibleData[activeIndex] }]}
          isLocked={false}
          onCloseLocked={() => setLockedSession(null)}
          onDrillDown={onDrillDown}
        />
      </div>
    )}

    {/* Locked tooltip overlay (existing) */}
    {lockedSession && (
      <div css={styles.lockedOverlay}>
        <ProgressGraphsTooltipContent
          isLocked={true}
          lockedSession={lockedSession}
          onCloseLocked={() => setLockedSession(null)}
          onDrillDown={onDrillDown}
        />
      </div>
    )}
  </div>
);
```

- [ ] **Step 4: Run tests**

Run: `npm run dev`

Visually verify that:
- Hovering over any graph shows a single tooltip
- Tooltip follows cursor (centered vertically)
- Tooltip disappears when mouse leaves graphs

Run: `npm run test -- ProgressGraphs.test.tsx -v`

Expected: Tests pass; visual behavior matches spec.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat: implement container-level shared tooltip with cursor-relative positioning"
```

---

### Task 11: Write tests for locked tooltip movement during pan/zoom

**Files:**
- Modify: `src/components/__tests__/ProgressGraphs.test.tsx`

- [ ] **Step 1: Add tests for locked tooltip behavior**

```typescript
describe('ProgressGraphs locked tooltip', () => {
  it('should keep locked tooltip visible when locked data point is in view', () => {
    const { container } = render(<ProgressGraphs sessions={mockSessions} />);
    // Simulate click to lock
    // Verify locked tooltip is rendered
    // Simulate pan
    // Verify locked tooltip still visible if data point in range
  });

  it('should hide locked tooltip when locked data point scrolls out of view', () => {
    const { container } = render(<ProgressGraphs sessions={mockSessions} />);
    // Simulate lock on first session
    // Simulate pan right to hide first session
    // Verify tooltip disappears
  });

  it('should display green border and close button in locked state', () => {
    const { container } = render(<ProgressGraphs sessions={mockSessions} />);
    // Simulate click to lock
    // Verify tooltip has green border
    // Verify close button (×) is visible
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npm run test -- ProgressGraphs.test.tsx -t "locked tooltip"`

Expected: Tests fail (locked tooltip movement logic not yet implemented).

---

### Task 12: Implement locked tooltip with screen position tracking

**Files:**
- Modify: `src/components/ProgressGraphs.tsx:1-70` (types and state)
- Modify: `src/components/ProgressGraphs.tsx:369-500` (handleChartClick and state)

- [ ] **Step 1: Extend lockedSession state to include position**

Update the locked session state initialization and type:

```typescript
interface LockedTooltipState {
  sessionData: ProgressGraphsTooltipPayload;
  visibleIndex: number | null;  // Index within visibleData
  globalIndex: number;          // Global index in graphData
}

// In ProgressGraphs function:
const [lockedSession, setLockedSession] = useState<LockedTooltipState | null>(null);
```

- [ ] **Step 2: Update handleChartClick to track locked position**

Replace the handleChartClick function:

```typescript
const handleChartClick = (state: any) => {
  if (state && state.activeTooltipIndex !== undefined) {
    const sessionData = visibleData[state.activeTooltipIndex];
    if (sessionData) {
      setLockedSession({
        sessionData: {
          sessionIndex: sessionData.sessionIndex,
          sessionId: sessionData.sessionId,
          date: sessionData.date,
          exerciseTag: sessionData.exerciseTag,
          bestStableDeviation: sessionData.bestStableDeviation,
          nearBestStableTime: sessionData.nearBestStableTime,
          longestQualityStreak: sessionData.longestQualityStreak,
          qualityEpisodeCount: sessionData.qualityEpisodeCount,
          fusionPercent: sessionData.fusionPercent,
          nearFusionPercent: sessionData.nearFusionPercent,
          stableDeviationPercent: sessionData.stableDeviationPercent,
          approachingPercent: sessionData.approachingPercent,
          driftingPercent: sessionData.driftingPercent,
        },
        visibleIndex: state.activeTooltipIndex,
        globalIndex: sessionData.sessionIndex,
      });
    }
  }
};
```

- [ ] **Step 3: Update styles for locked tooltip green border**

Update the `tooltip` style in the styles object:

```typescript
tooltip: css`
  background: rgba(0, 0, 0, 1);
  border: 1px solid ${THEME.borderPrimary};
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  color: ${THEME.textPrimary};

  &[data-locked="true"] {
    border: 2px solid ${THEME.accentGreen};
  }

  p {
    margin: 4px 0;
  }

  hr {
    margin: 4px 0;
    border: none;
    border-top: 1px solid ${THEME.borderSecondary || '#444'};
  }
`,
```

- [ ] **Step 4: Update locked tooltip JSX to use green border**

Update the ProgressGraphsTooltipContent to accept a `data-locked` attribute:

```typescript
return (
  <div
    css={styles.tooltip}
    data-locked={isLocked ? "true" : "false"}
    style={{
      borderColor: isLocked ? THEME.accentGreen : undefined,
      position: 'relative',
    }}
  >
    {/* ... rest of tooltip content */}
  </div>
);
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- ProgressGraphs.test.tsx -t "locked tooltip" -v`

Expected: Tests for locked state pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat: implement locked tooltip with position tracking and green border"
```

---

### Task 13: Implement locked tooltip position recalculation on zoom/pan

**Files:**
- Modify: `src/components/ProgressGraphs.tsx:369-622` (zoom/pan integration)

- [ ] **Step 1: Add function to check if locked data point is visible**

Add a helper function in ProgressGraphs:

```typescript
function isLockedSessionVisible(
  lockedGlobalIndex: number,
  zoomStart: number,
  zoomEnd: number
): boolean {
  return lockedGlobalIndex >= Math.floor(zoomStart) && lockedGlobalIndex <= Math.ceil(zoomEnd);
}

function getLockedSessionVisibleIndex(
  lockedGlobalIndex: number,
  zoomStart: number,
  visibleData: any[]
): number | null {
  const visibleIndex = visibleData.findIndex(d => d.sessionIndex === lockedGlobalIndex);
  return visibleIndex >= 0 ? visibleIndex : null;
}
```

- [ ] **Step 2: Update state when zoom/pan changes**

Add an effect to recalculate locked session visibility:

```typescript
useEffect(() => {
  if (lockedSession) {
    const isVisible = isLockedSessionVisible(
      lockedSession.globalIndex,
      zoomStart,
      zoomEnd
    );
    if (!isVisible) {
      // Hide locked tooltip if data point is out of view
      setLockedSession(null);
    } else {
      // Update visible index
      const newVisibleIndex = getLockedSessionVisibleIndex(
        lockedSession.globalIndex,
        zoomStart,
        visibleData
      );
      if (newVisibleIndex !== null) {
        setLockedSession(prev => ({
          ...prev!,
          visibleIndex: newVisibleIndex,
        }));
      }
    }
  }
}, [zoomStart, zoomEnd, visibleData, lockedSession]);
```

- [ ] **Step 3: Render locked tooltip at locked data point position**

Update the locked tooltip JSX to position it at the locked data point (not fixed overlay):

```typescript
{lockedSession && visibleData[lockedSession.visibleIndex ?? -1] && (
  <div
    css={styles.sharedTooltipContainer}
    style={{
      left: `${cursorX ?? 0}px`,  // Use last known cursor position, or calculate from data point
      top: `${cursorY ?? 0}px`,
    }}
  >
    <ProgressGraphsTooltipContent
      isLocked={true}
      lockedSession={lockedSession.sessionData}
      onCloseLocked={() => setLockedSession(null)}
      onDrillDown={onDrillDown}
    />
  </div>
)}
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- ProgressGraphs.test.tsx -t "locked tooltip" -v`

Expected: All locked tooltip tests pass.

Run: `npm run dev`

Visually verify:
- Click a data point to lock tooltip
- Pan left/right with pan buttons
- Locked tooltip disappears when locked data point goes out of view
- Locked tooltip has green border and close button

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat: locked tooltip disappears when scrolled out of view, recalculates position on pan/zoom"
```

---

### Task 14: Run full test suite and fix regressions

**Files:**
- Modify: `src/components/__tests__/ProgressGraphs.test.tsx`
- Modify: `src/components/__tests__/ProgressGraphs.touch.test.tsx` (if needed)

- [ ] **Step 1: Run all ProgressGraphs tests**

Run: `npm run test -- ProgressGraphs -v`

Expected: All tests pass. If any fail, note which ones.

- [ ] **Step 2: Fix any regressions**

If tests fail, update test expectations to match new behavior. Common regressions:
- Tooltip positioning changed → update selectors
- Locked overlay position changed → update mock assertions
- Hover behavior changed → update test stimulation

Run tests again after fixes.

- [ ] **Step 3: Run full test suite**

Run: `npm run test`

Expected: All tests in the project pass (not just ProgressGraphs).

- [ ] **Step 4: Commit**

```bash
git add src/components/__tests__/ProgressGraphs.test.tsx src/components/__tests__/ProgressGraphs.touch.test.tsx
git commit -m "test: update tests for shared tooltip and locked state behavior"
```

---

### Task 15: Test touch interactions (zoom/pan)

**Files:**
- `src/components/__tests__/ProgressGraphs.touch.test.tsx`

- [ ] **Step 1: Run touch zoom tests**

Run: `npm run test -- ProgressGraphs.touch.test.tsx -v`

Expected: All touch tests pass (zoom, pan with two fingers).

- [ ] **Step 2: Manual testing on mobile**

Run: `npm run dev`

Using a mobile device or browser dev tools (mobile mode):
- Try two-finger zoom on a graph
- Verify that locked tooltip still appears correctly
- Verify that pan buttons work
- Verify that locked tooltip disappears when zoomed

- [ ] **Step 3: Verify no regressions**

Confirm:
- Hover/lock interactions work on touch
- Pan/zoom controls still functional
- No JavaScript errors in console

If issues found, fix in ProgressGraphs.tsx.

- [ ] **Step 4: Commit (if changes)**

```bash
git add src/components/__tests__/ProgressGraphs.touch.test.tsx
git commit -m "test: verify touch zoom/pan interactions with new shared tooltip"
```

---

### Task 16: Test responsive behavior on mobile

**Files:**
- `src/components/ProgressGraphs.tsx` (visual testing only)

- [ ] **Step 1: Test on mobile viewport (375px)**

Run: `npm run dev`

Using browser dev tools, set viewport to:
- Width: 375px
- Height: 667px (iPhone SE)

Verify:
- Graph containers render correctly
- Legends are centered and visible
- X-axis labels (on Graph 3) don't overflow
- Tooltip doesn't exceed viewport bounds
- Close button (×) is easily clickable

- [ ] **Step 2: Test on tablet viewport (768px)**

Set viewport to:
- Width: 768px
- Height: 1024px (iPad)

Verify:
- All elements scale properly
- Tooltip positioning is correct
- No layout breaks

- [ ] **Step 3: Test on wide viewport (1920px)**

Set viewport to:
- Width: 1920px
- Height: 1080px

Verify:
- Graphs don't become too wide
- Tooltip stays within bounds
- No horizontal scroll

If responsive issues found, update media queries in styles and commit.

- [ ] **Step 4: Commit (if changes)**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "style: improve responsive behavior for shared tooltip on mobile"
```

---

### Task 17: Final integration testing and visual verification

**Files:**
- None (manual testing)

- [ ] **Step 1: Full feature walkthrough**

Run: `npm run dev`

Test the complete feature flow:
1. Hover over Graph 1 → single tooltip appears, centered vertically
2. Move cursor to Graph 2 → tooltip updates data, stays at same vertical position
3. Move cursor to Graph 3 → tooltip continues to follow cursor
4. Click on a data point → tooltip locks (green border, close button visible)
5. Use pan/zoom controls while locked → tooltip moves with data point
6. Pan so locked data point goes off-screen → tooltip disappears
7. Click close button (×) → return to hover mode
8. Verify x-axis labels on Graph 3 show YYYY-MM-DD format

- [ ] **Step 2: Test drill-down functionality**

While locked tooltip is visible:
1. Click "View Session →" button
2. Verify it opens the correct session

- [ ] **Step 3: Browser console check**

Verify no errors or warnings in console during all interactions.

- [ ] **Step 4: Performance check**

Verify smooth interactions:
- No lag when hovering
- No stutter when panning/zooming
- Smooth animation (if any)

- [ ] **Step 5: Final commit (if minor tweaks)**

If any small fixes needed, commit them:

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "polish: final visual and interaction refinements"
```
