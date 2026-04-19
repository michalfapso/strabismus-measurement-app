# History Page Responsive Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the History page fully responsive with a mobile drawer, auto-selection of last 30 sessions, filter/selection independence (Option A), and a unified click-to-lock tooltip for session drilldown on all devices.

**Architecture:** Changes flow bottom-up — leaf components first (SelectionBar, HistoryListView, SingleSessionView), then intermediate (MultiSessionAnalysisView, ProgressGraphs, SessionDrawer), then HistoryPage last. HistoryPage owns all new cross-cutting state: `isMobile`, `isDrawerOpen`, `drillDownSessionId`, `hiddenCount`, `visibleSelectedCount`. Existing callbacks (`handleRowClick`, `handleSelectNone`, etc.) are reused unchanged and shared between the desktop sidebar and the mobile drawer.

**Tech Stack:** React 19, TypeScript, Emotion CSS (`@emotion/react` css tagged templates with `@media` blocks), Recharts, Vitest + `@testing-library/react`

**Spec:** `docs/superpowers/specs/2026-04-18-history-page-responsive-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/SelectionBar.tsx` | Modify | Add `hiddenCount` + `visibleSelectedCount` props; fix `allSelected` logic |
| `src/components/HistoryListView.tsx` | Modify | Add `checkboxMode` prop for mobile tap-to-toggle |
| `src/components/SingleSessionView.tsx` | Modify | Add `onBack` prop for drilldown return button |
| `src/components/MultiSessionAnalysisView.tsx` | Modify | Add `onDrillDown` prop; remove internal `UnifiedSessionPanel` drilldown |
| `src/components/ProgressGraphs.tsx` | Modify | Rename `SharedTooltip` → `Tooltip`; alias recharts `Tooltip` → `RechartsTooltip`; add `lockedSession` state + click-to-lock overlay |
| `src/components/SessionDrawer.tsx` | Create | Full-screen mobile drawer; reuses `HistoryListView`, `DateFilterBar`, `ExerciseTypeFilterBar`; swipe-to-close |
| `src/components/HistoryPage.tsx` | Modify | Option A filter; `hiddenCount`; auto-select; `isMobile` responsive layout; `drillDownSessionId`; `SessionDrawer` + funnel button |

---

## Task 1: SelectionBar — hiddenCount and visibleSelectedCount

**Files:**
- Modify: `src/components/SelectionBar.tsx`

The current `allSelected = selectedCount === filteredSessionCount` breaks with Option A (hidden sessions inflate `selectedCount` above `filteredSessionCount`). We add `visibleSelectedCount` (filtered sessions that are selected) so the "All" button disables correctly. We also add `hiddenCount` to show a second line when sessions are hidden by the filter.

- [ ] **Step 1: Update SelectionBarProps**

Replace the interface in `src/components/SelectionBar.tsx`:

```tsx
export interface SelectionBarProps {
  selectedCount: number;
  filteredSessionCount: number;
  visibleSelectedCount: number;  // how many filteredSessions are in selectedSessions
  hiddenCount: number;           // selected sessions not visible under current filter
  onSelectAll: () => void;
  onSelectNone: () => void;
  onExport: () => void;
  onDelete: () => void;
  disabled?: boolean;
}
```

- [ ] **Step 2: Update derived booleans and destructuring**

Replace the function signature and the `allSelected` line:

```tsx
export function SelectionBar({
  selectedCount,
  filteredSessionCount,
  visibleSelectedCount,
  hiddenCount,
  onSelectAll,
  onSelectNone,
  onExport,
  onDelete,
  disabled = false,
}: SelectionBarProps) {
  const allSelected = visibleSelectedCount === filteredSessionCount && filteredSessionCount > 0;
  const noneSelected = selectedCount === 0;
  const selectAllEnabled = filteredSessionCount > 0 && !allSelected;
  const selectNoneEnabled = selectedCount > 0;
```

- [ ] **Step 3: Update the count display to show hidden count**

Replace the "Selection count (center)" div:

```tsx
{/* Selection count (center) */}
<div style={{ flex: 1 }}>
  <div>
    <strong>{selectedCount}</strong> {selectedCount === 1 ? 'session' : 'sessions'} selected
  </div>
  {hiddenCount > 0 && (
    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
      {hiddenCount} of them {hiddenCount === 1 ? 'is' : 'are'} hidden by filter
    </div>
  )}
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: TypeScript errors on the `SelectionBar` call site in `HistoryPage.tsx` (missing new props) — these will be fixed in Task 7. All other output should be clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/SelectionBar.tsx
git commit -m "feat(SelectionBar): add hiddenCount and visibleSelectedCount props"
```

---

## Task 2: HistoryListView — checkboxMode for mobile

**Files:**
- Modify: `src/components/HistoryListView.tsx`

When `checkboxMode` is true, each row shows a checkbox on the left and tapping anywhere on the row toggles that session (simulates Ctrl+click = toggle).

- [ ] **Step 1: Add checkboxMode to the props interface**

```tsx
export interface HistoryListViewProps {
  sessions: Session[];
  selectedIds: Set<string>;
  onRowClick: (id: string, ctrlKey: boolean, shiftKey: boolean, visibleIds: string[]) => void;
  checkboxMode?: boolean;
}
```

- [ ] **Step 2: Destructure the new prop**

```tsx
export function HistoryListView({
  sessions,
  selectedIds,
  onRowClick,
  checkboxMode = false,
}: HistoryListViewProps) {
```

- [ ] **Step 3: Add checkbox and update row click handler**

Inside the `sessions.map(...)`, replace the `onClick` handler and add the checkbox element. The full updated row div:

```tsx
<div
  key={session.sessionId}
  onClick={(e) => {
    if (checkboxMode) {
      // In checkbox mode: always toggle (simulate Ctrl+click)
      onRowClick(session.sessionId, true, false, visibleIds);
    } else {
      const ctrl = (e as any).ctrlKey || (e as any).metaKey;
      const shift = (e as any).shiftKey;
      onRowClick(session.sessionId, ctrl, shift, visibleIds);
    }
  }}
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    backgroundColor: isSelected ? 'rgba(0,255,0,0.15)' : 'transparent',
    borderLeft: isSelected ? '3px solid #00ff00' : '3px solid transparent',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    paddingLeft: '13px',
  }}
  onMouseEnter={(e) => {
    if (!isSelected) {
      (e.currentTarget as any).style.backgroundColor = 'rgba(255,255,255,0.03)';
    }
  }}
  onMouseLeave={(e) => {
    if (!isSelected) {
      (e.currentTarget as any).style.backgroundColor = 'transparent';
    }
  }}
>
  {checkboxMode && (
    <input
      type="checkbox"
      checked={isSelected}
      onChange={() => onRowClick(session.sessionId, true, false, visibleIds)}
      onClick={(e) => e.stopPropagation()}
      style={{ accentColor: '#00ff00', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
    />
  )}
  {/* Exercise & Time */}
  <div style={{ minWidth: '140px' }}>
    ...existing content unchanged...
  </div>
  ...rest of row content unchanged...
</div>
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | head -20
```

Expected: clean (no new errors).

- [ ] **Step 5: Commit**

```bash
git add src/components/HistoryListView.tsx
git commit -m "feat(HistoryListView): add checkboxMode prop for mobile tap-to-toggle"
```

---

## Task 3: SingleSessionView — onBack prop

**Files:**
- Modify: `src/components/SingleSessionView.tsx`

When `onBack` is provided, a "← Back to Analysis" button appears at the top. This is only passed from HistoryPage when the user drilled down via "View Session →" — not when 1 session is selected from the list.

- [ ] **Step 1: Add onBack to the props interface**

```tsx
interface SingleSessionViewProps {
  session: Session;
  onBack?: () => void;
}
```

- [ ] **Step 2: Destructure and render the back button**

In `export default function SingleSessionView({ session, onBack }: SingleSessionViewProps)`, add the back button as the first element inside the outer `<div>`:

```tsx
return (
  <div css={css`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  `}>
    {onBack && (
      <button
        onClick={onBack}
        css={css`
          align-self: flex-start;
          padding: 8px 12px;
          font-size: 13px;
          color: ${THEME.textPrimary};
          background-color: rgba(255, 255, 255, 0.05);
          border: 1px solid ${THEME.borderPrimary};
          border-radius: 4px;
          cursor: pointer;
          &:hover { background-color: rgba(255, 255, 255, 0.1); }
        `}
      >
        ← Back to Analysis
      </button>
    )}
    {/* Header */}
    <div css={css`...existing header styles...`}>
      ...existing header content...
    </div>
    ...rest unchanged...
  </div>
);
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -20
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/SingleSessionView.tsx
git commit -m "feat(SingleSessionView): add onBack prop for drilldown return button"
```

---

## Task 4: MultiSessionAnalysisView — lift drilldown to parent

**Files:**
- Modify: `src/components/MultiSessionAnalysisView.tsx`

Currently, `MultiSessionAnalysisView` manages `drilledDownSessionId` internally via `useSessionAnalysisState` and renders `UnifiedSessionPanel` inline. We lift this to `HistoryPage`. `useSessionAnalysisState` is kept for `exerciseFilter` and zoom state — we just stop using `drilledDownSessionId` from it.

- [ ] **Step 1: Add onDrillDown to the props interface**

```tsx
interface MultiSessionAnalysisViewProps {
  sessions: Session[];
  onDrillDown?: (sessionId: string) => void;
}
```

- [ ] **Step 2: Update the component signature**

```tsx
export default function MultiSessionAnalysisView({ sessions, onDrillDown }: MultiSessionAnalysisViewProps) {
```

- [ ] **Step 3: Update handleDrillDown to call the prop**

Replace the existing `handleDrillDown`:

```tsx
const handleDrillDown = (sessionId: string) => {
  onDrillDown?.(sessionId);
};
```

- [ ] **Step 4: Remove the drilledDownSessionId rendering block**

Delete lines 349–360 (the `if (state.drilledDownSessionId)` block that renders `UnifiedSessionPanel`):

```tsx
// DELETE this entire block:
if (state.drilledDownSessionId) {
  const session = sessions.find(s => s.sessionId === state.drilledDownSessionId);
  if (session) {
    return (
      <UnifiedSessionPanel
        session={session}
        onBack={() => setState({ ...state, drilledDownSessionId: undefined })}
      />
    );
  }
}
```

- [ ] **Step 5: Remove unused UnifiedSessionPanel import** (if it's only used in the deleted block)

Check the top of the file — if `UnifiedSessionPanel` is only imported for the deleted block, remove that import line.

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | head -20
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/MultiSessionAnalysisView.tsx
git commit -m "feat(MultiSessionAnalysisView): lift drilldown state to parent via onDrillDown prop"
```

---

## Task 5: ProgressGraphs — click-to-lock Tooltip

**Files:**
- Modify: `src/components/ProgressGraphs.tsx`

**Naming:** We rename `SharedTooltip` → `Tooltip` (our component) and alias the recharts import as `RechartsTooltip` to avoid collision.

**Behavior:**
- Hover (no lock): recharts `RechartsTooltip` shows hover tooltip via our `Tooltip` component with `isLocked={false}` — no action buttons
- Click a point: `lockedSession` is set → recharts tooltip suppressed → our `Tooltip` rendered as an absolutely-positioned overlay with `isLocked={true}`, neon green border, "✕" + "View Session →" buttons
- On mobile/touch: tap = click, so locked tooltip appears immediately on tap

- [ ] **Step 1: Alias the recharts Tooltip import**

Change line 3:

```tsx
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
```

- [ ] **Step 2: Add lockedSession state to ProgressGraphs**

Inside `export function ProgressGraphs(...)`, add after the existing hooks:

```tsx
const [lockedSession, setLockedSession] = useState<ProgressGraphsTooltipPayload | null>(null);
```

- [ ] **Step 3: Add onClick handler for charts**

Add this function inside `ProgressGraphs` (after the state declarations):

```tsx
const handleChartClick = (data: any) => {
  if (data && data.activePayload && data.activePayload.length > 0) {
    const payload = data.activePayload[0].payload as ProgressGraphsTooltipPayload;
    setLockedSession(payload);
  }
};
```

- [ ] **Step 4: Rename SharedTooltip → Tooltip and add isLocked prop**

Replace the entire `SharedTooltipProps` interface and `SharedTooltip` function with:

```tsx
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ProgressGraphsTooltipPayload }>;
  label?: any;
  isLocked: boolean;
  onUnlock?: () => void;
  onDrillDown?: (sessionId: string) => void;
  // When isLocked=true and used as overlay, data is passed directly:
  lockedData?: ProgressGraphsTooltipPayload;
}

function Tooltip({ active, payload, isLocked, onUnlock, onDrillDown, lockedData }: TooltipProps) {
  const data = isLocked ? lockedData : (active && payload && payload.length > 0 ? payload[0].payload : null);
  if (!data) return null;

  return (
    <div css={css`
      ${styles.tooltip};
      ${isLocked ? `border: 1px solid #00ff00; position: relative;` : ''}
    `}>
      {isLocked && (
        <button
          onClick={onUnlock}
          css={css`
            position: absolute;
            top: 4px;
            right: 4px;
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.6);
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
            padding: 2px 4px;
            &:hover { color: #fff; }
          `}
        >
          ✕
        </button>
      )}
      <p><strong>{data.date}</strong></p>
      <p>Exercise: {data.exerciseTag}</p>
      <p>Session #{data.sessionIndex + 1}</p>
      <hr />
      <p>Best Stable Deviation: {data.bestStableDeviation.toFixed(2)} cm</p>
      <p>Near-Best Stable Time: {data.nearBestStableTime.toFixed(1)}s</p>
      <p>Longest Quality Streak: {data.longestQualityStreak.toFixed(1)}s</p>
      <p>Quality Episode Count: {data.qualityEpisodeCount}</p>
      <hr />
      <p>Fusion: {data.fusionPercent.toFixed(1)}%</p>
      <p>Near Fusion: {data.nearFusionPercent.toFixed(1)}%</p>
      <p>Stable Deviation: {data.stableDeviationPercent.toFixed(1)}%</p>
      <p>Approaching: {data.approachingPercent.toFixed(1)}%</p>
      <p>Drifting: {data.driftingPercent.toFixed(1)}%</p>
      {isLocked && onDrillDown && (
        <button
          onClick={() => onDrillDown(data.sessionId)}
          css={css`
            margin-top: 8px;
            width: 100%;
            padding: 6px 0;
            background: rgba(0,255,0,0.15);
            border: 1px solid #00ff00;
            border-radius: 3px;
            color: #00ff00;
            font-size: 11px;
            cursor: pointer;
            &:hover { background: rgba(0,255,0,0.25); }
          `}
        >
          View Session →
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add the locked overlay and update chart JSX**

Each of the three charts (LineChart for deviation, LineChart for near-best, AreaChart for composition) needs:
1. `onClick={handleChartClick}` added to the chart element
2. `<RechartsTooltip active={!lockedSession} content={...} />` — disabled when locked
3. A locked overlay `<div>` positioned absolutely in the chart's wrapper div

For each chart's `<div css={styles.graphContainer}>`, wrap it as:

```tsx
<div css={styles.graphContainer} style={{ position: 'relative' }}>
  <h3>...</h3>
  <ResponsiveContainer width="100%" height={graphHeight}>
    <LineChart   {/* or AreaChart */}
      data={chartData}
      onClick={handleChartClick}
      style={{ cursor: lockedSession ? 'default' : 'pointer' }}
    >
      ...existing axes, lines, areas...
      <RechartsTooltip
        active={lockedSession === null ? undefined : false}
        content={(props) => (
          <Tooltip
            {...props}
            isLocked={false}
            onDrillDown={onDrillDown}
          />
        )}
      />
    </LineChart>
  </ResponsiveContainer>
  {lockedSession && (
    <div style={{
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 10,
      maxWidth: '220px',
    }}>
      <Tooltip
        isLocked={true}
        lockedData={lockedSession}
        onUnlock={() => setLockedSession(null)}
        onDrillDown={onDrillDown}
      />
    </div>
  )}
</div>
```

Apply this pattern to all three chart containers.

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | head -30
```

Expected: clean.

- [ ] **Step 7: Manual smoke test**

```bash
npm run dev
```

Navigate to History → select multiple sessions → scroll to ProgressGraphs section → hover a data point (tooltip appears, no buttons) → click a point (tooltip locks with green border, "View Session →" and "✕" visible) → click "✕" (returns to hover mode).

- [ ] **Step 8: Commit**

```bash
git add src/components/ProgressGraphs.tsx
git commit -m "feat(ProgressGraphs): add click-to-lock tooltip with View Session drilldown"
```

---

## Task 6: SessionDrawer — new mobile drawer component

**Files:**
- Create: `src/components/SessionDrawer.tsx`

Reuses `HistoryListView` (with `checkboxMode={true}`), `DateFilterBar`, and `ExerciseTypeFilterBar` directly. The swipe-to-close gesture tracks touch position and animates the drawer transform.

- [ ] **Step 1: Create the file with props interface and imports**

```tsx
import { useState, useRef } from 'react';
import { css } from '@emotion/react';
import { Session } from '../types';
import { THEME } from '../theme';
import { HistoryListView } from './HistoryListView';
import { DateFilterBar } from './DateFilterBar';
import { ExerciseTypeFilterBar } from './ExerciseTypeFilterBar';

interface SessionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // Filter props
  dateRange: { from: Date; to: Date };
  onDateChange: (from: Date, to: Date) => void;
  distinctExerciseTypes: string[];
  selectedExerciseTypes: Set<string>;
  onExerciseTypeChange: (types: Set<string>) => void;
  // Session list props
  sessions: Session[];           // filteredSessions from parent
  selectedIds: Set<string>;
  onRowClick: (id: string, ctrlKey: boolean, shiftKey: boolean, visibleIds: string[]) => void;
  // Selection status
  selectedCount: number;         // total selected (including hidden)
  hiddenCount: number;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onExport: () => void;
  onDelete: () => void;
}
```

- [ ] **Step 2: Add Emotion styles**

```tsx
const styles = {
  backdrop: css`
    display: none;
    @media (max-width: 768px) {
      display: block;
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.6);
      z-index: 200;
    }
  `,
  drawer: css`
    display: none;
    @media (max-width: 768px) {
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 100%;
      background-color: rgba(10, 10, 10, 0.98);
      z-index: 201;
      transition: transform 0.3s ease;
      overflow: hidden;
    }
  `,
  header: css`
    @media (max-width: 768px) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid ${THEME.borderPrimary};
      flex-shrink: 0;
    }
  `,
  title: css`
    @media (max-width: 768px) {
      font-size: 16px;
      font-weight: 600;
      color: ${THEME.textPrimary};
      margin: 0;
    }
  `,
  closeButton: css`
    @media (max-width: 768px) {
      background: transparent;
      border: 1px solid ${THEME.borderPrimary};
      border-radius: 4px;
      color: ${THEME.textPrimary};
      padding: 6px 10px;
      font-size: 16px;
      cursor: pointer;
      line-height: 1;
      &:hover { border-color: ${THEME.textPrimary}; }
    }
  `,
  filtersSection: css`
    @media (max-width: 768px) {
      flex-shrink: 0;
      padding: 12px 16px;
      border-bottom: 1px solid ${THEME.borderPrimary};
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  `,
  statusBar: css`
    @media (max-width: 768px) {
      flex-shrink: 0;
      border-top: 1px solid rgba(0, 255, 0, 0.2);
      background-color: rgba(0, 255, 0, 0.05);
    }
  `,
  statusRow: css`
    @media (max-width: 768px) {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      flex-wrap: wrap;
    }
  `,
  statusText: css`
    @media (max-width: 768px) {
      flex: 1;
      font-size: 13px;
      color: ${THEME.textPrimary};
    }
  `,
  statusButton: css`
    @media (max-width: 768px) {
      padding: 5px 10px;
      font-size: 12px;
      color: ${THEME.accentGreen};
      background-color: rgba(0, 255, 0, 0.1);
      border: 1px solid ${THEME.accentGreen};
      border-radius: 3px;
      cursor: pointer;
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
  `,
  expandButton: css`
    @media (max-width: 768px) {
      padding: 5px 8px;
      font-size: 12px;
      color: ${THEME.textSecondary};
      background-color: transparent;
      border: 1px solid ${THEME.borderPrimary};
      border-radius: 3px;
      cursor: pointer;
    }
  `,
  advancedRow: css`
    @media (max-width: 768px) {
      display: flex;
      gap: 8px;
      padding: 0 16px 10px;
    }
  `,
  dangerButton: css`
    @media (max-width: 768px) {
      padding: 5px 10px;
      font-size: 12px;
      color: #ff6b6b;
      background-color: transparent;
      border: 1px solid #ff6b6b;
      border-radius: 3px;
      cursor: pointer;
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
  `,
};
```

- [ ] **Step 3: Implement the component with swipe-to-close**

```tsx
export function SessionDrawer({
  isOpen,
  onClose,
  dateRange,
  onDateChange,
  distinctExerciseTypes,
  selectedExerciseTypes,
  onExerciseTypeChange,
  sessions,
  selectedIds,
  onRowClick,
  selectedCount,
  hiddenCount,
  onSelectAll,
  onSelectNone,
  onExport,
  onDelete,
}: SessionDrawerProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartTime.current = Date.now();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !drawerRef.current) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    // Only allow swiping left (negative deltaX)
    if (deltaX < 0) {
      drawerRef.current.style.transform = `translateX(${deltaX}px)`;
      drawerRef.current.style.transition = 'none';
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !drawerRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const elapsed = Date.now() - (touchStartTime.current ?? 0);
    const velocity = Math.abs(deltaX) / elapsed; // px/ms

    drawerRef.current.style.transition = 'transform 0.3s ease';

    if (deltaX < -80 || (deltaX < -20 && velocity > 0.5)) {
      // Threshold met: close
      drawerRef.current.style.transform = 'translateX(-100%)';
      setTimeout(onClose, 300);
    } else {
      // Spring back
      drawerRef.current.style.transform = 'translateX(0)';
    }

    touchStartX.current = null;
    touchStartTime.current = null;
  };

  return (
    <>
      {isOpen && <div css={styles.backdrop} onClick={onClose} />}
      <div
        ref={drawerRef}
        css={styles.drawer}
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div css={styles.header}>
          <span css={styles.title}>Sessions</span>
          <button css={styles.closeButton} onClick={onClose} aria-label="Close session drawer">
            ✕
          </button>
        </div>

        {/* Filters */}
        <div css={styles.filtersSection}>
          <DateFilterBar currentRange={dateRange} onDateChange={onDateChange} />
          <ExerciseTypeFilterBar
            distinctTypes={distinctExerciseTypes}
            selectedTypes={selectedExerciseTypes}
            onSelectedTypesChange={onExerciseTypeChange}
          />
        </div>

        {/* Sessions list — reuses HistoryListView with checkboxMode */}
        <HistoryListView
          sessions={sessions}
          selectedIds={selectedIds}
          onRowClick={onRowClick}
          checkboxMode={true}
        />

        {/* Status bar */}
        <div css={styles.statusBar}>
          <div css={styles.statusRow}>
            <span css={styles.statusText}>
              <strong>{selectedCount}</strong> selected
              {hiddenCount > 0 && (
                <span style={{ color: THEME.textSecondary, fontSize: '12px', marginLeft: '6px' }}>
                  · {hiddenCount} hidden by filter
                </span>
              )}
            </span>
            <button
              css={styles.statusButton}
              onClick={onSelectAll}
              disabled={sessions.length === 0}
            >
              All
            </button>
            <button
              css={styles.statusButton}
              onClick={onSelectNone}
              disabled={selectedCount === 0}
            >
              None
            </button>
            <button
              css={styles.expandButton}
              onClick={() => setShowAdvanced(v => !v)}
              aria-label={showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
            >
              {showAdvanced ? '⌃' : '⌄'}
            </button>
          </div>
          {showAdvanced && (
            <div css={styles.advancedRow}>
              <button
                css={styles.statusButton}
                onClick={onExport}
                disabled={selectedCount === 0}
              >
                📥 Export CSV
              </button>
              <button
                css={styles.dangerButton}
                onClick={onDelete}
                disabled={selectedCount === 0}
              >
                🗑 Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | head -20
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/SessionDrawer.tsx
git commit -m "feat(SessionDrawer): new mobile drawer with filters, checkboxes, swipe-to-close"
```

---

## Task 7: HistoryPage — Option A filter + hiddenCount + visibleSelectedCount

**Files:**
- Modify: `src/components/HistoryPage.tsx`

Option A: filters narrow the list but do not remove sessions from `selectedSessions`. We remove the useEffect that was doing this. We also compute `hiddenCount` and `visibleSelectedCount` for passing to `SelectionBar`.

- [ ] **Step 1: Remove the deselect-on-filter useEffect**

Delete the entire useEffect block (currently lines ~85–94):

```tsx
// DELETE this entire block:
useEffect(() => {
  const visibleIds = filteredSessions.map((s) => s.sessionId);
  const filtered = new Set(
    Array.from(state.selectedSessions).filter((id) => visibleIds.includes(id))
  );
  if (filtered.size !== state.selectedSessions.size ||
      Array.from(filtered).some((id) => !state.selectedSessions.has(id))) {
    updateSelectedSessions(filtered);
  }
}, [filteredSessions, state.selectedSessions, updateSelectedSessions]);
```

- [ ] **Step 2: Add hiddenCount and visibleSelectedCount memos**

After the existing `filteredSessions` useMemo, add:

```tsx
// visibleSelectedCount: how many filteredSessions are currently selected
const visibleSelectedCount = useMemo(() => {
  return filteredSessions.filter(s => state.selectedSessions.has(s.sessionId)).length;
}, [filteredSessions, state.selectedSessions]);

// hiddenCount: selected sessions not visible under current filter
const hiddenCount = useMemo(() => {
  const visibleIds = new Set(filteredSessions.map(s => s.sessionId));
  return Array.from(state.selectedSessions).filter(id => !visibleIds.has(id)).length;
}, [filteredSessions, state.selectedSessions]);
```

- [ ] **Step 3: Update SelectionBar call site**

Pass the two new props to `<SelectionBar>`:

```tsx
<SelectionBar
  selectedCount={selectedCount}
  filteredSessionCount={filteredSessions.length}
  visibleSelectedCount={visibleSelectedCount}
  hiddenCount={hiddenCount}
  onSelectAll={handleSelectAll}
  onSelectNone={handleSelectNone}
  onExport={handleExport}
  onDelete={handleDelete}
/>
```

- [ ] **Step 4: Write a test for Option A filter behavior**

Create `src/__tests__/hooks/historyPageOptionA.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

// Pure logic test: hiddenCount and visibleSelectedCount computation
function computeCounts(
  selectedIds: Set<string>,
  filteredIds: string[]
): { hiddenCount: number; visibleSelectedCount: number } {
  const visibleSet = new Set(filteredIds);
  const hiddenCount = Array.from(selectedIds).filter(id => !visibleSet.has(id)).length;
  const visibleSelectedCount = filteredIds.filter(id => selectedIds.has(id)).length;
  return { hiddenCount, visibleSelectedCount };
}

describe('Option A filter/selection logic', () => {
  it('hiddenCount is 0 when all selected sessions are visible', () => {
    const selected = new Set(['a', 'b', 'c']);
    const filtered = ['a', 'b', 'c', 'd'];
    const { hiddenCount } = computeCounts(selected, filtered);
    expect(hiddenCount).toBe(0);
  });

  it('hiddenCount counts selected sessions outside the current filter', () => {
    const selected = new Set(['a', 'b', 'c', 'hidden1', 'hidden2']);
    const filtered = ['a', 'b', 'c', 'd'];
    const { hiddenCount } = computeCounts(selected, filtered);
    expect(hiddenCount).toBe(2);
  });

  it('visibleSelectedCount counts only filtered sessions that are selected', () => {
    const selected = new Set(['a', 'b', 'hidden1']);
    const filtered = ['a', 'b', 'c', 'd'];
    const { visibleSelectedCount } = computeCounts(selected, filtered);
    expect(visibleSelectedCount).toBe(2);
  });

  it('neither count is affected by unselected visible sessions', () => {
    const selected = new Set(['a']);
    const filtered = ['a', 'b', 'c'];
    const { hiddenCount, visibleSelectedCount } = computeCounts(selected, filtered);
    expect(hiddenCount).toBe(0);
    expect(visibleSelectedCount).toBe(1);
  });
});
```

- [ ] **Step 5: Run the test**

```bash
npx vitest run src/__tests__/hooks/historyPageOptionA.test.ts
```

Expected: 4 passing tests.

- [ ] **Step 6: Verify full build**

```bash
npm run build 2>&1 | head -20
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/HistoryPage.tsx src/__tests__/hooks/historyPageOptionA.test.ts
git commit -m "feat(HistoryPage): Option A filter - selections preserved when filter changes"
```

---

## Task 8: HistoryPage — auto-select last 30 sessions on mount

**Files:**
- Modify: `src/components/HistoryPage.tsx`

When History page loads and `selectedSessions` is empty (first visit or after "None"), auto-select the 30 most recent sessions.

- [ ] **Step 1: Add auto-select logic inside loadSessions**

Inside the `loadSessions` async function, after `setAllSessions(sessions)` and before `setLoading(false)`:

```tsx
// Auto-select last 30 sessions if nothing is currently selected
if (state.selectedSessions.size === 0 && sessions.length > 0) {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const last30Ids = sorted.slice(0, 30).map(s => s.sessionId);
  updateSelectedSessions(new Set(last30Ids));
}
```

- [ ] **Step 2: Write a test for the auto-select logic**

Add to `src/__tests__/hooks/historyPageOptionA.test.ts`:

```ts
function autoSelectLast30(sessions: Array<{ sessionId: string; timestamp: string }>) {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return new Set(sorted.slice(0, 30).map(s => s.sessionId));
}

describe('Auto-select last 30 sessions', () => {
  it('selects up to 30 most recent sessions', () => {
    const sessions = Array.from({ length: 50 }, (_, i) => ({
      sessionId: `s${i}`,
      timestamp: new Date(2026, 0, i + 1).toISOString(),
    }));
    const result = autoSelectLast30(sessions);
    expect(result.size).toBe(30);
    // Should include the 30 most recent (s20–s49)
    expect(result.has('s49')).toBe(true);
    expect(result.has('s20')).toBe(true);
    expect(result.has('s19')).toBe(false);
  });

  it('selects all sessions when fewer than 30 exist', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      sessionId: `s${i}`,
      timestamp: new Date(2026, 0, i + 1).toISOString(),
    }));
    const result = autoSelectLast30(sessions);
    expect(result.size).toBe(5);
  });
});
```

- [ ] **Step 3: Run the test**

```bash
npx vitest run src/__tests__/hooks/historyPageOptionA.test.ts
```

Expected: all tests passing.

- [ ] **Step 4: Commit**

```bash
git add src/components/HistoryPage.tsx src/__tests__/hooks/historyPageOptionA.test.ts
git commit -m "feat(HistoryPage): auto-select last 30 sessions on mount when selection is empty"
```

---

## Task 9: HistoryPage — isMobile state + responsive CSS layout

**Files:**
- Modify: `src/components/HistoryPage.tsx`

Add `isMobile` state with a resize listener. Convert inline styles on the outer container, header, left panel, and right panel to Emotion CSS with `@media (max-width: 768px)` breakpoints. On mobile, the left panel is hidden.

- [ ] **Step 1: Add css import and isMobile state**

At the top of the file, add `css` to the `@emotion/react` import (or add it if not present):

```tsx
import { css } from '@emotion/react';
import { THEME } from '../theme';
```

Inside the component, add after the existing state declarations:

```tsx
const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

useEffect(() => {
  const handler = () => setIsMobile(window.innerWidth < 768);
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

- [ ] **Step 2: Add module-scope Emotion styles**

Below all imports and above the `HistoryPage` function, add:

```tsx
const styles = {
  outer: css`
    position: fixed;
    inset: 0;
    background-color: rgba(10, 10, 10, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 100;
    display: flex;
    flex-direction: column;
  `,
  header: css`
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background-color: rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
    @media (max-width: 768px) {
      padding: 12px 16px 8px;
    }
  `,
  mainContent: css`
    display: flex;
    flex: 1;
    overflow: hidden;
  `,
  leftPanel: css`
    width: fit-content;
    min-width: 300px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    @media (max-width: 768px) {
      display: none;
    }
  `,
  rightPanel: css`
    flex: 1;
    overflow: auto;
    position: relative;
    display: flex;
    flex-direction: column;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
  `,
  funnelButton: css`
    display: none;
    @media (max-width: 768px) {
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 150;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background-color: rgba(0, 0, 0, 0.85);
      border: 2px solid ${THEME.accentGreen};
      color: ${THEME.accentGreen};
      font-size: 20px;
      cursor: pointer;
      box-shadow: 0 2px 16px rgba(0, 255, 0, 0.25);
      &:hover { box-shadow: 0 2px 20px rgba(0, 255, 0, 0.4); }
    }
  `,
};
```

- [ ] **Step 3: Replace inline style props with Emotion css props in JSX**

Update the return statement's JSX to use `css={styles.*}` instead of `style={{...}}` on the structural divs:

```tsx
return (
  <div css={styles.outer}>
    {/* Header */}
    <div css={styles.header}>
      <h1 style={{ margin: '0 0 12px 0', fontSize: '20px', color: '#fff' }}>
        Session History
      </h1>
      {!isMobile && (
        <DateFilterBar currentRange={dateRange} onDateChange={handleDateChange} />
      )}
      {!isMobile && (
        <ExerciseTypeFilterBar
          distinctTypes={distinctExerciseTypes}
          selectedTypes={selectedExerciseTypes}
          onSelectedTypesChange={handleExerciseTypeChange}
        />
      )}
    </div>

    {/* Main content */}
    <div css={styles.mainContent}>
      {/* List side — hidden on mobile */}
      <div css={styles.leftPanel}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#ddd' }}>
            Loading sessions...
          </div>
        ) : (
          <>
            <HistoryListView
              sessions={filteredSessions}
              selectedIds={state.selectedSessions}
              onRowClick={handleRowClick}
            />
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
              <SelectionBar
                selectedCount={selectedCount}
                filteredSessionCount={filteredSessions.length}
                visibleSelectedCount={visibleSelectedCount}
                hiddenCount={hiddenCount}
                onSelectAll={handleSelectAll}
                onSelectNone={handleSelectNone}
                onExport={handleExport}
                onDelete={handleDelete}
              />
            </div>
          </>
        )}
      </div>

      {/* Detail side */}
      <div css={styles.rightPanel}>
        ...right panel content (unchanged for now)...
      </div>
    </div>

    {/* Floating funnel button — mobile only */}
    <button
      css={styles.funnelButton}
      onClick={() => {/* isDrawerOpen setter — added in Task 10 */}}
      aria-label="Open session list"
    >
      ⧩
    </button>
  </div>
);
```

- [ ] **Step 4: Verify build and visual check at 768px**

```bash
npm run dev
```

Open in browser. Resize to below 768px — left panel should disappear. Resize back — left panel reappears.

- [ ] **Step 5: Commit**

```bash
git add src/components/HistoryPage.tsx
git commit -m "feat(HistoryPage): responsive layout - hide sidebar on mobile, add isMobile state"
```

---

## Task 10: HistoryPage — drilldown state + SessionDrawer + funnel button

**Files:**
- Modify: `src/components/HistoryPage.tsx`

Wire up `drillDownSessionId` state (for "View Session →" drilldown), `isDrawerOpen` state (for mobile drawer), the `SessionDrawer` component, and the floating funnel button.

- [ ] **Step 1: Add isDrawerOpen and drillDownSessionId state**

```tsx
const [isDrawerOpen, setIsDrawerOpen] = useState(false);
const [drillDownSessionId, setDrillDownSessionId] = useState<string | null>(null);
```

- [ ] **Step 2: Add SessionDrawer import**

```tsx
import { SessionDrawer } from './SessionDrawer';
```

- [ ] **Step 3: Update right panel JSX to handle drilldown**

Replace the right panel content:

```tsx
{/* Detail side */}
<div css={styles.rightPanel}>
  {drillDownSessionId !== null ? (
    (() => {
      const drillSession = allSessions.find(s => s.sessionId === drillDownSessionId);
      return drillSession ? (
        <SingleSessionView
          session={drillSession}
          onBack={() => setDrillDownSessionId(null)}
        />
      ) : null;
    })()
  ) : selectedCount === 0 ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#999', fontSize: '14px' }}>
      Select one or more sessions to view analysis
    </div>
  ) : selectedCount === 1 && selectedSessions.length > 0 ? (
    <SingleSessionView session={selectedSessions[0]} />
  ) : (
    <MultiSessionAnalysisView
      sessions={selectedSessions}
      onDrillDown={setDrillDownSessionId}
    />
  )}
</div>
```

- [ ] **Step 4: Wire up SessionDrawer and funnel button**

Add `<SessionDrawer>` and update the funnel button `onClick` at the end of the outer div:

```tsx
{/* Mobile drawer */}
<SessionDrawer
  isOpen={isDrawerOpen}
  onClose={() => setIsDrawerOpen(false)}
  dateRange={dateRange}
  onDateChange={handleDateChange}
  distinctExerciseTypes={distinctExerciseTypes}
  selectedExerciseTypes={selectedExerciseTypes}
  onExerciseTypeChange={handleExerciseTypeChange}
  sessions={filteredSessions}
  selectedIds={state.selectedSessions}
  onRowClick={handleRowClick}
  selectedCount={selectedCount}
  hiddenCount={hiddenCount}
  onSelectAll={handleSelectAll}
  onSelectNone={handleSelectNone}
  onExport={handleExport}
  onDelete={handleDelete}
/>

{/* Floating funnel button — mobile only */}
<button
  css={styles.funnelButton}
  onClick={() => setIsDrawerOpen(true)}
  aria-label="Open session list"
>
  ⧩
</button>
```

- [ ] **Step 5: Verify full build**

```bash
npm run build 2>&1 | head -20
```

Expected: clean.

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 7: Manual end-to-end test on desktop**

```bash
npm run dev
```

1. Navigate to History — multi-session analysis shown with last 30 auto-selected
2. Hover over a ProgressGraphs data point — tooltip appears without buttons
3. Click the data point — tooltip locks (green border), "✕" and "View Session →" visible
4. Click "✕" — tooltip unlocks, hover mode restored
5. Click a point again, click "View Session →" — single-session view with "← Back to Analysis" button
6. Click "← Back to Analysis" — returns to multi-session view

- [ ] **Step 8: Manual end-to-end test on mobile**

Using browser DevTools responsive mode at 375px width:

1. History page shows full-width graphs, funnel button visible bottom-left
2. Tap funnel button — drawer slides in from left, full screen
3. Filters visible at top, session list with checkboxes
4. Tap a checkbox — selection updates live, status bar count updates
5. Tap "None" — all sessions deselected
6. Tap "⌄" — advanced row with Export/Delete appears
7. Tap "✕" — drawer closes
8. Tap a graph data point — locked tooltip appears
9. Swipe left on drawer — drawer follows finger, releases past threshold → closes

- [ ] **Step 9: Commit**

```bash
git add src/components/HistoryPage.tsx
git commit -m "feat(HistoryPage): wire drilldown, SessionDrawer, and funnel button"
```

---

## Self-Review Checklist

- [x] **Spec Section 1 (breakpoint 768px):** Covered — all `@media (max-width: 768px)` blocks use 768px
- [x] **Spec Section 3 (mobile layout):** Covered — Task 9 hides left panel, Task 10 adds drawer + funnel button
- [x] **Spec Section 4 (auto-select 30):** Covered — Task 8
- [x] **Spec Section 5 (Option A filter):** Covered — Task 7 removes the deselect useEffect
- [x] **Spec Section 6 (hidden count):** Covered — Tasks 1 + 7 (SelectionBar + HistoryPage)
- [x] **Spec Section 7 (checkboxes):** Covered — Task 2 (HistoryListView checkboxMode)
- [x] **Spec Section 8 (click-to-lock tooltip):** Covered — Task 5 (ProgressGraphs)
- [x] **Spec Section 9 (back to analysis):** Covered — Task 3 (SingleSessionView onBack) + Task 10 (drilldown rendering)
- [x] **Spec Section 10 (status bar controls):** Covered — Task 6 (SessionDrawer status bar with All/None/⌄/Export/Delete)
- [x] **Spec Section 11 (swipe-to-close):** Covered — Task 6 (touch handlers in SessionDrawer)
- [x] **SessionDrawer reuses HistoryListView:** Confirmed — Task 6 uses `<HistoryListView checkboxMode={true} />`
- [x] **Tooltip naming:** Task 5 renames `SharedTooltip` → `Tooltip` and aliases recharts `Tooltip as RechartsTooltip`
- [x] **No code duplication in Tooltip:** Task 5 uses single `Tooltip` component with `isLocked` prop for both hover and locked states
- [x] **allSelected fixed for Option A:** Task 1 uses `visibleSelectedCount === filteredSessionCount`
