# History Page & Post-Measurement Results — Technical Design Specification

**Date:** 2026-03-26
**Phase:** MVP (Phase 1)
**Status:** Ready for Implementation

---

## Executive Summary

This specification defines the technical design for two interconnected features in the Strabismus Measurement App:

1. **History Page** — A full-screen page displaying all past measurement sessions with filtering and multi-select capabilities
2. **Post-Measurement Results Panel** — A side panel showing detailed statistics and graphs immediately after a measurement session ends

Both features integrate with the existing IndexedDB session storage and use recharts for graph visualization. The design prioritizes real-time filtering, multi-select interactions via Shift+Click/Ctrl+Click, and modular component architecture compatible with the desktop-first layout.

---

## Table of Contents

1. [User Stories](#user-stories)
2. [Design Approaches](#design-approaches)
3. [Component Architecture](#component-architecture)
4. [State Management & Data Flow](#state-management--data-flow)
5. [Data Transforms & Calculations](#data-transforms--calculations)
6. [UI/UX Specifications](#uiux-specifications)
7. [Integration Points](#integration-points)
8. [Implementation Checklist](#implementation-checklist)

---

## User Stories

### Story 1: History Page (Full-Screen View)

**As a clinician, I want to browse all past measurement sessions in a full-screen page so that I can review historical data, apply date filters, and analyze multi-session trends.**

**Acceptance Criteria:**
- [ ] Display all sessions from IndexedDB in a scrollable list
- [ ] Show brief session info per row (exercise, date/time, point count)
- [ ] Support date range filtering in real-time (no button clicks required)
- [ ] Allow multi-select via Shift+Click and Ctrl+Click
- [ ] Clicking a row (without modifier keys) shows detailed results panel for that session
- [ ] Multi-select rows display aggregate statistics and overlay graphs
- [ ] Export selected sessions to CSV

**Epic Scope:**
- Page-level layout (full screen, not floating panel)
- List rendering with virtualization for large datasets (100+ sessions)
- Filter controls (date range picker, real-time updates)
- Multi-select interaction model with visual indicators
- Session detail panel (side or modal based on device)
- Export functionality for selected sessions

---

### Story 2: Post-Measurement Results Panel

**As a user, I want to see immediate feedback (statistics and graphs) after I complete a measurement session so that I can validate the measurement quality before saving.**

**Acceptance Criteria:**
- [ ] Results panel appears automatically after session ends
- [ ] Display four key stats: position range, rotation range, duration/exercise tag, mean deviation from center
- [ ] Show graphs for the current session: line charts for position (x, y) and rotation (r) over time
- [ ] Support line graph toggle (show/hide individual or aggregate lines)
- [ ] Panel is dismissable and does not block the canvas
- [ ] Desktop: side panel (right side); Mobile: modal or slide-up panel
- [ ] User can re-open results panel from History page by selecting the session

**Epic Scope:**
- Automatic trigger on session end
- Real-time stat calculations
- Graph rendering (recharts)
- Responsive layout (desktop side panel, mobile modal)
- Session selection in history to view historical session results

---

## Design Approaches

### Layout Strategy

#### Desktop (> 1024px)
- **Canvas:** Full-screen measurement area (left/center)
- **Controls & History buttons:** Top-right overlay (existing)
- **Results panel:** Right sidebar, 350-450px wide, non-blocking
- **History page:** Full-screen page with side panel for session details

#### Mobile/Tablet (≤ 1024px)
- **Canvas:** Full-screen measurement area
- **Results panel:** Modal or slide-up panel from bottom
- **History page:** Full-screen list; session detail modal or tab panel

### Interaction Patterns

#### Date Filtering (Real-Time)
- **UI Component:** Date range picker (from/to)
- **Behavior:** Updates list immediately as user adjusts dates (no "Apply" button)
- **Default:** Show last 30 days
- **Persistence:** Store filter state in sessionStorage for UX continuity

#### Multi-Select
- **Shift+Click:** Select range from last clicked to current
- **Ctrl+Click / Cmd+Click:** Toggle individual row selection
- **Visual Feedback:** Highlight selected rows; show selection badge ("3 selected")
- **Actions:** Export, view aggregate stats, clear selection

#### Graph Library Choice
- **Library:** recharts (already included in roadmap for Phase 2)
- **Graphs:**
  - Position over time: Line chart (x vs time, y vs time, or 2D scatter)
  - Rotation over time: Line chart (r vs time)
  - Multi-session overlay: Thin subtle lines for individual sessions + bold line for aggregate
- **Interaction:** Hover for tooltips, click legend to toggle series visibility

---

## Component Architecture

### High-Level Component Tree

```
App.tsx
├── AssessmentCanvas (existing)
├── OverlayControls
│   ├── DataCaptureControl (existing)
│   ├── HistoryButton → navigates to HistoryPage
│   └── ResultsPanel (NEW)
└── HistoryPage (NEW) [full-screen, conditional routing]
    ├── HistoryListView
    │   ├── DateFilterBar
    │   ├── SessionListContainer
    │   │   └── SessionListRow (multi-selectable)
    │   ├── SelectionBar (shows count, export button)
    │   └── AggregateResultsPanel (side or modal)
    ├── ResultsDetail (shows single/multi session stats)
    └── ExportControl
```

### Component Details

#### ResultsPanel (Post-Measurement)
**Purpose:** Display immediate feedback after session end
**Props:**
- `session: Session` — Current completed session
- `onDismiss: () => void` — Close callback
- `isDesktop: boolean` — Layout responsive prop

**Features:**
- Stat cards (position range, rotation range, duration, mean deviation)
- Line graphs (position x/y, rotation over time)
- Optional: Comparison to previous session (delta)

**Location:** `src/components/ResultsPanel.tsx`

---

#### HistoryPage (Full-Screen)
**Purpose:** Display all sessions with filtering and multi-select
**Props:**
- `onSessionSelect: (sessionId: string) => void` — Navigate to session detail
- `onNavigateToMeasurement: () => void` — Return to measurement canvas

**State:**
- `sessions: Session[]` — Loaded from IndexedDB
- `filteredSessions: Session[]` — After applying date range
- `selectedSessionIds: Set<string>` — Multi-select state
- `dateRange: { from: Date; to: Date }` — Filter range

**Features:**
- Real-time date filtering
- Multi-select with Shift+Click, Ctrl+Click
- Session detail panel or modal
- Export selected sessions

**Location:** `src/components/HistoryPage.tsx`

---

#### HistoryListView
**Purpose:** Render filtered session list with multi-select interaction
**Props:**
- `sessions: Session[]` — Filtered sessions
- `selectedIds: Set<string>` — Current selections
- `onToggleSelect: (id: string, multiSelect: boolean) => void`
- `onSessionSelect: (id: string) => void`

**Virtualization:** Use `react-window` (or native scroll) for 100+ sessions

**Location:** `src/components/HistoryListView.tsx`

---

#### DateFilterBar
**Purpose:** Real-time date range filtering
**Props:**
- `onDateChange: (from: Date, to: Date) => void`
- `currentRange: { from: Date; to: Date }`

**UI:**
- Two input fields (from, to) or date picker
- "Last 7 days", "Last 30 days", "This month" quick presets
- "Clear" button to reset

**Location:** `src/components/DateFilterBar.tsx`

---

#### AggregateResultsPanel
**Purpose:** Show combined stats and overlay graphs for multi-select
**Props:**
- `sessions: Session[]` — Selected sessions
- `onClose: () => void`

**Features:**
- Aggregate statistics (mean position, rotation spread across sessions)
- Overlay graph showing all selected sessions as thin lines, aggregate as bold line
- Individual session toggle (show/hide each line)

**Location:** `src/components/AggregateResultsPanel.tsx`

---

#### SessionDetailPanel
**Purpose:** Show detailed stats and graphs for a single session
**Props:**
- `session: Session`
- `onClose: () => void`

**Features:**
- Four stat cards (position range, rotation range, duration/exercise, mean deviation)
- Time-series graphs (position, rotation)
- Option to add to multi-select or delete session

**Location:** `src/components/SessionDetailPanel.tsx`

---

## State Management & Data Flow

### Global State (SessionContext)
**Existing:**
```typescript
{
  currentSession: Session | null;
  sessions: Session[]; // In-memory cache
  startSession(tag, ppi): void;
  addTimeSeriesPoint(point): void;
  endSession(): Promise<void>;
  clearSession(): void;
}
```

**Enhancement:**
- Add `loadAllSessions(from: Date, to: Date): Promise<Session[]>` for history page filtering
- Track `resultsVisible: boolean` to show/hide post-measurement panel
- Add `selectedSessionIds: Set<string>` for multi-select state

### Local State (Component-Level)

**HistoryPage:**
```typescript
{
  allSessions: Session[];
  filteredSessions: Session[];
  selectedIds: Set<string>;
  dateRange: { from: Date; to: Date };
  detailPanelSession: Session | null;
}
```

**ResultsPanel:**
```typescript
{
  visible: boolean;
  session: Session;
}
```

### Data Flow Diagram

```
SessionContext (IndexedDB)
    ↓
HistoryPage (load all sessions)
    ↓ (filter by date)
HistoryListView (display filtered)
    ↓ (user selects rows)
Selected Sessions → AggregateResultsPanel or SessionDetailPanel
    ↓ (stats & graphs)
Display or Export CSV
```

### IndexedDB Integration

**No schema changes required.** Sessions already stored with:
```typescript
interface Session {
  sessionId: string;
  timestamp: string; // ISO8601
  exerciseTag: string;
  ppi: number;
  timeSeries: TimeSeries[];
}
```

**Query patterns:**
- Load all sessions: `getAllSessions()` (existing)
- Filter by date: Client-side filtering (avoid complex IDB queries)
- Aggregate stats: Compute in-memory post-fetch

---

## Data Transforms & Calculations

### Session Statistics

#### 1. Position Range
```typescript
function getPositionRange(session: Session) {
  const xs = session.timeSeries.map(p => p.x);
  const ys = session.timeSeries.map(p => p.y);
  return {
    xMin: Math.min(...xs),
    xMax: Math.max(...xs),
    xRange: Math.max(...xs) - Math.min(...xs),
    yMin: Math.min(...ys),
    yMax: Math.max(...ys),
    yRange: Math.max(...ys) - Math.min(...ys),
  };
}
```

#### 2. Rotation Range
```typescript
function getRotationRange(session: Session) {
  const rs = session.timeSeries.map(p => p.r);
  return {
    rMin: Math.min(...rs),
    rMax: Math.max(...rs),
    range: Math.max(...rs) - Math.min(...rs),
  };
}
```

#### 3. Duration & Exercise Tag
```typescript
function getSessionDuration(session: Session) {
  if (session.timeSeries.length === 0) return 0;
  const first = session.timeSeries[0].t;
  const last = session.timeSeries[session.timeSeries.length - 1].t;
  return last - first; // milliseconds
}
```

#### 4. Mean Deviation from Center
```typescript
function getMeanDeviation(session: Session) {
  const distances = session.timeSeries.map(p =>
    Math.sqrt(p.x * p.x + p.y * p.y)
  );
  return distances.reduce((a, b) => a + b, 0) / distances.length;
}
```

#### 5. Aggregate Statistics (Multi-Select)
```typescript
function aggregateStats(sessions: Session[]) {
  const allPoints = sessions.flatMap(s => s.timeSeries);

  // Mean position
  const meanX = allPoints.reduce((a, p) => a + p.x, 0) / allPoints.length;
  const meanY = allPoints.reduce((a, p) => a + p.y, 0) / allPoints.length;

  // Rotation variance
  const meanR = allPoints.reduce((a, p) => a + p.r, 0) / allPoints.length;
  const rotVariance = allPoints.reduce((a, p) =>
    a + Math.pow(p.r - meanR, 2), 0) / allPoints.length;

  return { meanX, meanY, meanR, rotVariance, pointCount: allPoints.length };
}
```

### Graph Data Preparation

#### Single Session Graph Data
```typescript
function prepareSessionGraphData(session: Session) {
  return session.timeSeries.map(point => ({
    time: point.t,
    x: point.x,
    y: point.y,
    r: point.r,
    timeFormatted: formatTime(point.t),
  }));
}
```

#### Multi-Session Overlay Data
```typescript
function prepareAggregateGraphData(sessions: Session[]) {
  const allPoints = sessions.flatMap((session, idx) =>
    session.timeSeries.map(point => ({
      ...point,
      sessionId: session.sessionId,
      sessionIndex: idx,
      timeFormatted: formatTime(point.t),
    }))
  );

  return {
    points: allPoints,
    aggregateLine: calculateMovingAverage(allPoints, 5), // 5-point smoothing
  };
}
```

---

## UI/UX Specifications

### Results Panel (Post-Measurement)

**Trigger:** Automatic display when `endSession()` is called in SessionContext

**Layout:**
- **Desktop:** Right sidebar, 400px wide, semi-transparent dark overlay, non-blocking
- **Mobile:** Modal or bottom sheet (120px height initially, expandable)

**Content:**
1. **Stat Cards** (4 columns, responsive to 2x2 on mobile)
   - Position Range: "X: 0.5–2.1 cm, Y: 0.3–1.8 cm"
   - Rotation Range: "R: −5.2° to +8.4°"
   - Duration/Exercise: "15 sec • Pencil Push-ups"
   - Mean Deviation: "0.8 cm from center"

2. **Graphs**
   - Line chart: Position over time (two series: X, Y)
   - Line chart: Rotation over time
   - Legend to toggle series visibility

3. **Actions**
   - Dismiss button (close panel)
   - "View in History" link (navigate to HistoryPage, session selected)
   - "Save to CSV" button (export single session)

**Styling:**
- Dark background matching existing UI (`rgba(10, 10, 10, 0.82)`)
- Green accent color (`#00ff00`)
- High contrast text

---

### History Page

**Trigger:** User clicks "History" button in top-right overlay (existing in App.tsx)

**Layout:** Full-screen page replacing canvas view

**Sections:**

#### 1. Header
- Title: "Session History"
- "Back to Measurement" button (navigate back to canvas)

#### 2. Filters
- **Date Range Selector**
  - From: date input (default: 30 days ago)
  - To: date input (default: today)
  - Presets: "Last 7 days", "Last 30 days", "This month", "All time"
  - Updates list in real-time

#### 3. Session List
- **Columns:**
  - Checkbox (for multi-select)
  - Exercise: Exercise tag (bold)
  - Date: "2026-03-26 10:23 AM"
  - Data Points: "45 pts"
  - Actions: "View" (or click row)

- **Row Interaction:**
  - Single-click (no modifier): Select for detail view
  - Shift+Click: Select range
  - Ctrl/Cmd+Click: Toggle individual selection
  - Visual indicator: Highlight selected rows

#### 4. Selection Bar
- Shows count: "3 sessions selected"
- "Export Selected" button
- "Clear Selection" link

#### 5. Detail Panel (Side or Modal)
- Shows single session or aggregate stats
- Embedded graphs (recharts)
- Close button

**Pagination/Virtualization:**
- Render only visible rows (react-window) if > 50 sessions
- Infinite scroll or "Load More" button for large datasets

**Styling:**
- Match existing dark theme
- Responsive columns (hide date on mobile, show on desktop)
- Green accents for interactive elements

---

## Integration Points

### 1. App.tsx Router Changes

**Current State:**
```typescript
const [showHistory, setShowHistory] = useState(false);

if (showHistory) {
  return <HistoryPage onNavigateBack={() => setShowHistory(false)} />;
}
```

**Updated State:**
- Use conditional rendering for HistoryPage (full-screen overlay)
- Show ResultsPanel only after `endSession()` in SessionContext

### 2. SessionContext Enhancement

**Add to SessionContext:**
```typescript
export const SessionContext = createContext<{
  // ... existing
  showResults: boolean;
  setShowResults: (visible: boolean) => void;
  selectedSessions: Set<string>;
  setSelectedSessions: (ids: Set<string>) => void;
  loadHistoricalSessions: (from?: Date, to?: Date) => Promise<Session[]>;
}>({
  // ... existing defaults
  showResults: false,
  setShowResults: () => {},
  selectedSessions: new Set(),
  setSelectedSessions: () => {},
  loadHistoricalSessions: async () => [],
});
```

### 3. Storage Service Usage

**Methods:**
- `getAllSessions()` — Load all for history page
- `getSession(id)` — Load single session detail
- `deleteSession(id)` — Delete from detail panel
- `downloadCSV(sessions)` — Export selected sessions (existing)

### 4. Date Filtering Library

**Option 1:** Native HTML date inputs + client-side filtering
**Option 2:** Lightweight date picker library (e.g., `react-dates`, `date-fns`)

**Recommendation:** Native HTML inputs for MVP (no new dependency), enhance with `date-fns` utilities for date arithmetic

### 5. Responsive Design

**Breakpoints:**
- Mobile: ≤ 640px
- Tablet: 640px–1024px
- Desktop: > 1024px

**Media queries:**
- ResultsPanel width: 350px (desktop), 100% modal (mobile)
- HistoryList columns: responsive grid
- Graphs: reduce chart height on mobile

---

## Implementation Checklist

### Phase 1: Core Components

- [ ] **ResultsPanel.tsx**
  - [ ] Props and state setup
  - [ ] Stat card layout (position, rotation, duration, deviation)
  - [ ] Graph rendering (recharts line charts)
  - [ ] Responsive design (desktop sidebar vs mobile modal)
  - [ ] Dismiss/close logic
  - [ ] Styling (dark theme, green accents)
  - [ ] Unit tests

- [ ] **HistoryPage.tsx**
  - [ ] Full-screen layout
  - [ ] State management (sessions, filters, selections)
  - [ ] Load initial sessions from IndexedDB
  - [ ] Back/navigate logic
  - [ ] Unit tests

- [ ] **HistoryListView.tsx**
  - [ ] Session list rendering
  - [ ] Row selection (single, shift+click, ctrl+click)
  - [ ] Visual feedback (highlighting)
  - [ ] Virtualization (if needed for large datasets)
  - [ ] Unit tests

- [ ] **DateFilterBar.tsx**
  - [ ] Date range inputs
  - [ ] Preset buttons
  - [ ] Real-time update callback
  - [ ] Unit tests

- [ ] **SessionDetailPanel.tsx**
  - [ ] Stat cards (reuse from ResultsPanel if possible)
  - [ ] Time-series graphs
  - [ ] Delete/export buttons
  - [ ] Unit tests

- [ ] **AggregateResultsPanel.tsx**
  - [ ] Multi-session stat aggregation
  - [ ] Overlay graph rendering (thin + aggregate)
  - [ ] Series toggle legend
  - [ ] Unit tests

### Phase 2: Integration & Enhancement

- [ ] **SessionContext.tsx enhancements**
  - [ ] Add showResults, selectedSessions state
  - [ ] Add loadHistoricalSessions method
  - [ ] Hook into endSession to trigger ResultsPanel

- [ ] **App.tsx integration**
  - [ ] Conditional HistoryPage rendering
  - [ ] ResultsPanel mounting logic
  - [ ] Route between canvas and history

- [ ] **Responsive design**
  - [ ] Mobile layout testing (tablet, phone)
  - [ ] Media query adjustments
  - [ ] Touch interaction (if needed)

- [ ] **Export enhancement**
  - [ ] Extend downloadCSV to handle multi-select
  - [ ] CSV header customization
  - [ ] Error handling

- [ ] **Performance optimization**
  - [ ] Session list virtualization
  - [ ] Graph render memoization
  - [ ] IndexedDB query optimization

### Phase 3: UX Polish

- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Error states (no sessions, failed load)
- [ ] Loading states (skeletal screens)
- [ ] Animations (panel transitions, graph updates)
- [ ] Tooltip enhancements
- [ ] Mobile testing & refinement

---

## Dependencies

**Existing (no new installs needed):**
- `react`, `react-dom` — Core framework
- `recharts` — Already in roadmap (Phase 2, now moved to Phase 1)
- `@emotion/react`, `@emotion/styled` — Styling
- `uuid` — Session IDs

**Optional (for enhancement):**
- `react-window` — Virtualization for large lists
- `date-fns` — Date utilities (alternative: native Date)
- `downshift` or `react-select` — Advanced filtering (defer to Phase 2)

---

## Testing Strategy

### Unit Tests
- Stat calculation functions (position range, rotation range, deviation)
- Aggregate functions (multi-session stats)
- Graph data preparation

### Component Tests
- ResultsPanel visibility/dismissal
- HistoryListView multi-select logic
- DateFilterBar real-time updates
- SessionDetailPanel rendering

### Integration Tests
- SessionContext showResults state
- App.tsx routing (canvas ↔ history)
- Export CSV with multi-select

### E2E Tests (Future)
- Complete user flow: measure → results panel → history → filter → multi-select → export

---

## File Structure Summary

```
src/
├── components/
│   ├── ResultsPanel.tsx (NEW)
│   ├── HistoryPage.tsx (NEW)
│   ├── HistoryListView.tsx (NEW)
│   ├── DateFilterBar.tsx (NEW)
│   ├── SessionDetailPanel.tsx (NEW)
│   ├── AggregateResultsPanel.tsx (NEW)
│   ├── ExportControl.tsx (REFACTOR from SessionExplorer)
│   ├── ... (existing)
│
├── hooks/
│   ├── useHistoryFilters.ts (NEW - local filtering hook)
│   ├── useMultiSelect.ts (NEW - selection logic)
│   ├── useSessionStats.ts (NEW - stat calculation)
│   └── ... (existing)
│
├── services/
│   ├── stats.ts (NEW - all stat & aggregate functions)
│   ├── graphData.ts (NEW - graph data preparation)
│   ├── storage.ts (existing - no changes)
│   ├── export.ts (existing - extend for multi-select)
│   └── ... (existing)
│
├── types/
│   └── index.ts (ENHANCE - add SessionStats interface)
│
└── ... (existing files)
```

---

## Success Criteria

- [ ] History page displays all sessions with real-time date filtering
- [ ] Multi-select works with Shift+Click and Ctrl+Click
- [ ] Results panel shows 4 stats + 2 graphs automatically post-measurement
- [ ] Aggregate graphs overlay individual sessions correctly
- [ ] Export CSV works for single and multi-select
- [ ] Desktop layout: side panel (non-blocking); Mobile layout: modal
- [ ] All components have unit tests with >80% coverage
- [ ] No performance degradation with 100+ sessions
- [ ] Responsive design passes mobile, tablet, desktop screens

---

## Version & Sign-Off

- **Specification Version:** 1.0
- **Approved for Implementation:** Yes
- **Estimated Implementation Effort:** 8–10 development days
- **Priority:** Phase 1 (MVP)

