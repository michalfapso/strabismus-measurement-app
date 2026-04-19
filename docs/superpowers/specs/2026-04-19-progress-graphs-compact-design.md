# ProgressGraphs Compaction & Shared Tooltip Design

**Date:** 2026-04-19  
**Component:** ProgressGraphs.tsx  
**Goal:** Reduce vertical space consumption and improve hover/click interaction consistency across three stacked graphs.

## Current State

The ProgressGraphs component displays three LineChart/AreaChart graphs stacked vertically:
1. Best Stable Deviation (cm) — single line, no legend needed
2. Near-Best Stable Time (seconds) — two lines
3. Session Composition (%) — stacked area chart with 5 metrics

**Pain points:**
- Each graph has its own x-axis with full date-time labels at 45° angle → takes ~140px per graph (420px total)
- Each graph has independent hover tooltip → three separate tooltips showing same data
- Locked tooltip (from clicking) positions itself at left edge of screen, not at data point

## Design: Approach 1 — Individual X-Axes with Top Two Removed

### 1. Layout Structure

**Graph 1: Best Stable Deviation**
- Title: "Best Stable Deviation (cm)"
- LineChart with single data line
- **No x-axis** (removes ~140px bottom margin)
- **No legend** (single line is self-evident)

**Graph 2: Near-Best Stable Time**
- Title: "Near-Best Stable Time (seconds)"
- **Centered legend** (between title and graph) showing both lines: "Near-Best Stable Time" and "Longest Quality Streak"
- LineChart with two data lines
- **No x-axis** (removes ~140px bottom margin)

**Graph 3: Session Composition**
- Title: "Session Composition (%)"
- **Centered legend** (between title and graph) showing all five state areas
- AreaChart with stacked areas
- **X-axis with date labels in YYYY-MM-DD format** at 45° angle
- Standard bottom margin for x-axis

### 2. Shared Hover Interaction

**Visual behavior:**
- When user hovers over any graph area, three vertical cursor lines appear simultaneously — one on each graph, all at the same x-position
- Single tooltip appears centered vertically near the cursor
- Tooltip content includes all current fields: date, exercise, session#, metrics, state percentages

**Implementation:**
- Lift hover state to ProgressGraphs container level
- Track active data point index in a shared state
- Pass synchronized `activeTooltipIndex` to all three Recharts components
- Render single tooltip at container level, positioned relative to cursor

**Behavior:**
- Moving cursor updates all three lines in real-time
- Cursor position synchronized across all graphs
- Exiting hover area hides all three lines and tooltip

### 3. Locked Tooltip Behavior

**Trigger:** User clicks on any graph to lock the tooltip at that data point.

**Visual state:**
- Tooltip gains neon-green border (`THEME.accentGreen`) instead of normal border
- Close button (×) appears in top-right corner
- All other tooltip content remains unchanged
- Tooltip stays at the same position relative to the locked data point

**Behavior:**
- Locked tooltip moves with the data point if user pans/zooms and point remains visible
- If user pans/zooms and the data point scrolls off-screen, tooltip disappears
- Locked state persists across pan/zoom operations until user clicks × to close
- Pan/zoom controls remain fully functional while tooltip is locked
- Clicking a different graph point unlocks the previous tooltip and locks the new one

**Implementation:**
- Extend `lockedSession` state to include screen position/reference
- Recalculate tooltip position after zoom/pan state changes
- Use CSS `position: absolute` with calculated `left`/`top` relative to graph container
- When zoomed data range changes, check if locked data point is still visible; hide tooltip if not

### 4. X-Axis Label Format Change

Current format on G3: full datetime (e.g., "2026-04-19 14:30:45")  
New format: date only in ISO format (e.g., "2026-04-19")

**Rationale:**
- Reduces label width, decreases angle rotation needed
- Session dates are the primary identifier; time is secondary
- Cleaner, more compact appearance

## Data Flow

```
ProgressGraphs (shared state)
├─ hover state: { activeIndex, cursorX, cursorY }
├─ locked state: { lockedSession, lockPosition }
├─ zoom/pan state: { zoomStart, zoomEnd }
│
├─ Graph1 (LineChart)
│  └─ receives activeIndex → shows vertical cursor line
│
├─ Graph2 (LineChart)
│  └─ receives activeIndex → shows vertical cursor line
│
├─ Graph3 (AreaChart)
│  └─ receives activeIndex → shows vertical cursor line
│
└─ Tooltip (container-level)
   └─ renders at calculated position based on cursor or locked session
```

## Implementation Strategy

### Phase 1: Remove X-Axes
- Remove XAxis from Graph1 and Graph2 LineCharts
- Reduce bottom margin from 60 to ~20 for those graphs
- Update formatDatetimeLabel to YYYY-MM-DD format for Graph3

### Phase 2: Add Legends Between Title and Graph
- Restructure Graph2 and Graph3 containers to: title → legend → ResponsiveContainer
- Use Recharts `<Legend />` with `wrapperStyle={{ display: 'flex', justifyContent: 'center' }}`
- Remove legend from Graph1

### Phase 3: Shared Hover State
- Create `useSharedHover()` hook to manage active tooltip index and position
- Replace individual Tooltip components with single container-level tooltip
- Synchronize activeTooltipIndex across all three charts via props
- Render vertical cursor lines using custom Recharts layer or SVG overlay

### Phase 4: Locked Tooltip with Movement
- Extend `lockedSession` state to track: `{ data, screenPosition }`
- On chart click, calculate screen position of data point
- On pan/zoom, recalculate position; hide if out of visible range
- Add close button with green border styling

### Phase 5: Testing
- Touch interactions still work (pan/zoom)
- Locked tooltip persists correctly during pan/zoom
- Cursor lines align properly across graphs at different widths
- Responsive behavior on mobile (graphs may be narrower)

## Success Criteria

1. ✓ Graph 1 and 2 x-axes removed (visual space saved)
2. ✓ Legends positioned between title and graph
3. ✓ Shared hover: single vertical cursor line per graph, single tooltip
4. ✓ Locked tooltip: green border, close button, moves with data point
5. ✓ Date format on Graph 3 is YYYY-MM-DD
6. ✓ All existing functionality preserved (pan, zoom, click-to-drill)
7. ✓ Touch zoom still works
8. ✓ Responsive on mobile

## Scope Notes

- No changes to data preparation or metrics calculations
- No changes to zoom/pan controls or logic
- No changes to the "View Session" drill-down functionality
- Legends remain centered horizontally (no left/right alignment changes)
- Tooltip content stays the same; only positioning and visual state change
