# Phase 2: Core UI Components Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement these component tasks sequentially.

**Goal:** Implement 7 core UI components for the History Page and Results Panel features with responsive design, recharts integration, and proper state management.

**Architecture:** Each component is a focused React functional component using hooks (useHistoryFilters, useMultiSelect, useSessionStats). Components layer to compose HistoryPage and ResultsPanel experiences.

**Tech Stack:** React 18, recharts (for graphs), Emotion (styling), existing hooks and services from Phase 1.

---

## File Structure & Boundaries

```
src/components/
├── ResultsPanel.tsx (NEW) — Post-measurement feedback panel
├── HistoryPage.tsx (NEW) — Full-screen history view and routing
├── HistoryListView.tsx (NEW) — Filtered session list with multi-select
├── DateFilterBar.tsx (NEW) — Real-time date range controls
├── SessionDetailPanel.tsx (NEW) — Single session stats and graphs
├── AggregateResultsPanel.tsx (NEW) — Multi-session comparison panel
├── StatCards.tsx (NEW) — Reusable stat card layout
├── PositionGraph.tsx (NEW) — Line chart for position over time
├── RotationGraph.tsx (NEW) — Line chart for rotation over time
└── SelectionBar.tsx (NEW) — Selection count and export controls
```

---

## Phase 2a: Graph Components (2 tasks)

### Task 7: Create PositionGraph Component

**Files:**
- Create: `src/components/PositionGraph.tsx`

**Purpose:** Recharts wrapper for position (x, y) line graphs with optional overlay support.

**Props:**
```typescript
interface PositionGraphProps {
  data: Array<{
    time: number;
    x: number;
    y: number;
    timeFormatted: string;
  }>;
  multiSession?: boolean; // true = overlay mode
  title?: string;
}
```

**Features:**
- Line chart with two lines (X position, Y position)
- Legend toggle (show/hide each line)
- Tooltip on hover showing values
- Responsive width (fill parent container)
- Height: 300px

**Implementation Note:**
- Use recharts `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`
- X-axis: time formatted (from data.timeFormatted)
- Y-axis: position in cm
- Two Line components: one for x (color #FF6B6B), one for y (color #4ECDC4)

**Integration:**
- Will be used in ResultsPanel and SessionDetailPanel
- Data prepared by prepareSessionGraphData (Task 2 output)

---

### Task 8: Create RotationGraph Component

**Files:**
- Create: `src/components/RotationGraph.tsx`

**Purpose:** Recharts wrapper for rotation (r) line graph.

**Props:**
```typescript
interface RotationGraphProps {
  data: Array<{
    time: number;
    r: number;
    timeFormatted: string;
  }>;
  title?: string;
}
```

**Features:**
- Single line for rotation over time
- Legend, tooltip, responsive
- Height: 300px
- Y-axis label: "Rotation (degrees)"

**Implementation Note:**
- Use recharts `LineChart` with single `Line` component
- Line color: #FFD93D
- Baseline at 0 degrees

---

## Phase 2b: Stat Cards Component (1 task)

### Task 9: Create StatCards Component

**Files:**
- Create: `src/components/StatCards.tsx`

**Purpose:** Reusable grid of stat cards for displaying session metrics.

**Props:**
```typescript
interface StatCardsProps {
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
  duration: number; // milliseconds
  meanDeviation: number;
  exerciseTag?: string;
}
```

**Layout:**
- Grid: 2 columns (desktop), 1 column (mobile)
- 4 cards minimum:
  1. **Position Range** — X: min-max, Y: min-max, Overall range
  2. **Rotation Range** — R: min-max, Range
  3. **Duration & Exercise** — Duration formatted (MM:SS), Exercise tag
  4. **Mean Deviation** — Distance from center in cm

**Styling:**
- Card bg: rgba(255,255,255,0.05)
- Text: white on dark
- Padding: 16px
- Border-radius: 4px
- Font: 14px labels, 18px values

**Reusability:**
- Used by ResultsPanel and SessionDetailPanel
- Optional fields (positionRange, rotationRange) render conditionally

---

## Phase 2c: Bar/Selection Component (1 task)

### Task 10: Create SelectionBar Component

**Files:**
- Create: `src/components/SelectionBar.tsx`

**Purpose:** Show selection count and export button for multi-select operations.

**Props:**
```typescript
interface SelectionBarProps {
  selectedCount: number;
  onExport: () => void;
  onClear: () => void;
  disabled?: boolean;
}
```

**Features:**
- Display: "N sessions selected"
- Export button → triggers CSV download
- Clear button → clears selection
- Hidden when selectedCount === 0

**Styling:**
- Bar bg: rgba(0,255,0,0.1) (green tint for accent)
- Buttons: small, green text, outline style
- Height: 48px

---

## Phase 2d: Filter Bar Component (1 task)

### Task 11: Create DateFilterBar Component

**Files:**
- Create: `src/components/DateFilterBar.tsx`

**Purpose:** Real-time date range filtering with preset helpers.

**Props:**
```typescript
interface DateFilterBarProps {
  onDateChange: (from: Date, to: Date) => void;
  currentRange: { from: Date; to: Date };
}
```

**Features:**
- Two date input fields (from, to)
- Quick preset buttons:
  - "Last 7 days"
  - "Last 30 days"
  - "This month"
  - "All time"
- Clear button
- Updates parent on every change (no apply button)

**Implementation:**
- Use native HTML5 date inputs (`<input type="date">`)
- onChange handlers trigger onDateChange immediately
- Buttons call preset functions from useHistoryFilters hook

**Styling:**
- Flex row with gap
- Input fields: dark bg, white text, 120px width
- Buttons: small, secondary style

---

## Phase 2e: Panel Components (3 tasks)

### Task 12: Create SessionDetailPanel Component

**Files:**
- Create: `src/components/SessionDetailPanel.tsx`

**Purpose:** Show detailed stats and graphs for a single selected session.

**Props:**
```typescript
interface SessionDetailPanelProps {
  session: Session | null;
  onClose: () => void;
}
```

**Features:**
- Session title: "{exerciseTag} on {timestamp}"
- StatCards with session stats (use Task 9)
- PositionGraph for position over time
- RotationGraph for rotation over time
- "Delete" button (optional)
- "Add to multi-select" button (future)

**Data Flow:**
- Accept session prop
- Use useSessionStats hook to calculate stats
- Use prepareSessionGraphData to format graph data
- Render StatCards + graphs

**Layout:**
- Header: title + close button
- Body: vertical scroll
- StatCards: 2-column grid
- Graphs: stacked vertically

**Styling:**
- Panel width: 400px (desktop), 100% (mobile, modal)
- Dark bg, white text
- Padding: 20px
- Box shadow for depth

---

### Task 13: Create AggregateResultsPanel Component

**Files:**
- Create: `src/components/AggregateResultsPanel.tsx`

**Purpose:** Show combined stats and overlay graphs for multi-selected sessions.

**Props:**
```typescript
interface AggregateResultsPanelProps {
  sessions: Session[]; // Multiple selected sessions
  onClose: () => void;
}
```

**Features:**
- Title: "Results for N sessions"
- Aggregate stat cards (mean X, mean Y, rotation variance, point count)
- Overlay graph showing:
  - Individual session lines (thin, subtle colors)
  - Aggregate line (bold, bright green)
  - Legend with individual session names
- Per-session toggles to show/hide each line

**Data Flow:**
- Accept sessions array
- Use useAggregateStats hook to calculate aggregate stats
- Use prepareAggregateGraphData to format overlay graph
- Render with recharts overlay pattern

**Layout:**
- Similar to SessionDetailPanel
- StatCards (different values: aggregate stats)
- Single overlay graph (position or rotation)
- Tabs or toggle to switch between position/rotation

---

### Task 14: Create ResultsPanel Component

**Files:**
- Create: `src/components/ResultsPanel.tsx`

**Purpose:** Auto-triggered post-measurement feedback shown after session ends.

**Props:**
```typescript
interface ResultsPanelProps {
  session: Session | null; // Current completed session
  visible: boolean;
  onDismiss: () => void;
}
```

**Features:**
- Only appears when visible && session !== null
- StatCards for immediate stats feedback
- PositionGraph and RotationGraph
- "View in History" button (navigate to HistoryPage)
- "Start New Measurement" button
- Dismiss (X) button

**Responsive:**
- Desktop: Side panel on right (350-400px width, non-blocking)
- Mobile: Full-screen modal or bottom sheet

**Styling:**
- Darker overlay on desktop
- Smooth slide-in animation (optional)
- Positioned: fixed or relative to canvas

**Integration with SessionContext:**
- Receives `visible` and `session` from SessionContext
- onDismiss calls `setShowResults(false)` in SessionContext
- Automatically shown when endSession() triggers setShowResults(true)

---

### Task 15: Create HistoryListView Component

**Files:**
- Create: `src/components/HistoryListView.tsx`

**Purpose:** Render filtered session list with multi-select interaction.

**Props:**
```typescript
interface HistoryListViewProps {
  sessions: Session[];
  selectedIds: Set<string>;
  onRowClick: (id: string, ctrlKey: boolean, shiftKey: boolean) => void;
  onSessionSelect: (session: Session) => void;
}
```

**Features:**
- List of session rows with:
  - Checkbox or visual highlight for selection
  - Exercise tag
  - Timestamp
  - Duration (calculated from timeSeries)
  - Position range summary
- Supports Shift+Click and Ctrl+Click for multi-select
- Hover highlight
- Click to view detail panel

**Implementation:**
- Row component for each session
- Conditional CSS classes for selected state
- onClick handlers: onRowClick for selection, onSessionSelect for detail view

**Layout:**
- Vertical list
- Each row: ~60px height
- Columns: checkbox | exercise | timestamp | duration | range
- Scrollable container (virtualization optional for 100+ items)

**Styling:**
- Row border-bottom: 1px rgba(255,255,255,0.1)
- Selected: bg-color rgba(0,255,0,0.1)
- Hover: bg-color rgba(255,255,255,0.05)

---

### Task 16: Create HistoryPage Component

**Files:**
- Create: `src/components/HistoryPage.tsx`

**Purpose:** Full-screen history view integrating all list and filter components.

**Props:**
```typescript
interface HistoryPageProps {
  onNavigateBack: () => void;
}
```

**State & Hooks:**
- useHistoryFilters(sessions) → dateRange, filteredSessions, setDateRange, presets
- useMultiSelect() → selectedIds, handleRowClick, clearSelection
- Local state: detailPanelSession: Session | null

**Layout:**
```
HistoryPage
├── Header
│   ├── "History" title
│   └── Close button (onNavigateBack)
├── DateFilterBar
│   └── (date range inputs + presets)
├── Main content area
│   ├── HistoryListView
│   │   └── (filtered sessions with multi-select)
│   └── SelectionBar
│       └── (show count, export, clear)
└── Detail panel (conditional)
    └── SessionDetailPanel or AggregateResultsPanel
        └── (single or multi-session details)
```

**Features:**
- Load sessions on mount (via SessionContext.loadHistoricalSessions)
- Real-time filtering as date range changes
- Multi-select sessions
- Click row: show detail panel for that session
- Export selected sessions as CSV
- Close (navigate back to measurement canvas)

**Responsive:**
- Desktop: Side-by-side layout (list + detail panel)
- Mobile: Full-width list, detail panel as modal overlay

**Styling:**
- Full-screen overlay (fixed, z-index: 1000)
- Dark bg with border/shadow
- Padding: 16px
- Header: 48px, close button on right

---

## Implementation Roadmap

### Order of Implementation

**Priority 1 (Atomic, no dependencies):**
1. Task 7: PositionGraph
2. Task 8: RotationGraph
3. Task 9: StatCards
4. Task 10: SelectionBar

**Priority 2 (Use Task 9-10):**
5. Task 11: DateFilterBar
6. Task 12: SessionDetailPanel (uses PositionGraph, RotationGraph, StatCards)
7. Task 13: AggregateResultsPanel (uses overlay graphs, StatCards)
8. Task 14: ResultsPanel (uses PositionGraph, RotationGraph, StatCards)

**Priority 3 (Integration):**
9. Task 15: HistoryListView (can be stubbed initially)
10. Task 16: HistoryPage (integrates all previous components)

---

## Success Criteria

- [ ] All 10 components implement required props and features
- [ ] Components use hooks from Phase 1 (useHistoryFilters, useMultiSelect, useSessionStats)
- [ ] Graphs render correctly with recharts
- [ ] Responsive design (desktop/mobile) tested
- [ ] Multi-select interaction works (Shift+Click, Ctrl+Click)
- [ ] Real-time filtering with no button clicks
- [ ] Export functionality integrated
- [ ] Stat cards display all 4 metrics correctly
- [ ] No console errors
- [ ] Components pass code review (reusability, clarity, performance)

---

## Document Control

- **Version:** 1.0
- **Date Created:** 2026-03-26
- **Status:** Ready for Implementation
- **Phase:** 2 (Core UI Components)
- **Total Tasks:** 10 (Tasks 7-16)

---
