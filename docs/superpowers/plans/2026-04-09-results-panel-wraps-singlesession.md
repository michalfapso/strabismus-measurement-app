# ResultsPanel Wraps SingleSessionView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Stop & Save panel display the same rich analysis view (TimeSeriesSegmentationGraph with segmentation visualization) as the History page single session view by wrapping SingleSessionView.

**Architecture:** SingleSessionView is refactored to compute SessionMetrics internally. ResultsPanel becomes a thin fixed-width container (800px) with a close button header that wraps SingleSessionView. HistoryPage is simplified to pass only the session prop. Documentation is updated to reflect these changes.

**Tech Stack:** React, TypeScript, emotion (CSS-in-JS)

---

## Files to Modify

- `src/components/SingleSessionView.tsx` — Add internal metric computation with error handling
- `src/components/ResultsPanel.tsx` — Simplify to wrap SingleSessionView (800px width)
- `src/components/HistoryPage.tsx` — Remove metric computation, pass only session to SingleSessionView
- `CLAUDE.md` — Fix incorrect description of analysis view components
- `docs/architecture.md` — Update SingleSessionView and ResultsPanel descriptions

---

### Task 1: Refactor SingleSessionView to compute metrics internally

**Files:**
- Modify: `src/components/SingleSessionView.tsx:1-108`

- [ ] **Step 1: Update SingleSessionViewProps interface**

Change the props interface from requiring both `session` and `metrics` to requiring only `session`:

```typescript
interface SingleSessionViewProps {
  session: Session;
}
```

- [ ] **Step 2: Add metric computation with error handling**

At the top of the component function (after the settings line), add:

```typescript
const metrics = useMemo(() => {
  try {
    const primaryMetric = (settings.selectedMetrics.find(
      m => m === 'deviation' || m === 'rotation'
    ) ?? 'deviation') as 'deviation' | 'rotation';
    const thresholds = {
      deviation: settings.thresholds.deviation ?? 1.0,
      rotation: settings.thresholds.rotation ?? 1.0,
    };
    return computeSessionMetrics(session, thresholds, primaryMetric);
  } catch {
    return null;
  }
}, [session, settings]);
```

- [ ] **Step 3: Import computeSessionMetrics**

Add this import at the top of the file (after other imports):

```typescript
import { computeSessionMetrics } from '../utils/sessionMetrics';
```

- [ ] **Step 4: Handle metrics computation error**

Wrap the entire return statement in a check. If metrics is null, return an error message:

```typescript
if (metrics === null) {
  return (
    <div css={css`
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: ${THEME.textSecondary};
      padding: 16px;
      text-align: center;
    `}>
      Unable to compute metrics (session may be too short)
    </div>
  );
}

return (
  <div css={css`...`}>
    {/* existing return JSX */}
  </div>
);
```

- [ ] **Step 5: Verify file compiles**

Run: `npm run build`
Expected: Compilation succeeds with no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/SingleSessionView.tsx
git commit -m "refactor: SingleSessionView now computes metrics internally from session prop"
```

---

### Task 2: Simplify ResultsPanel to wrap SingleSessionView

**Files:**
- Modify: `src/components/ResultsPanel.tsx` (entire file rewrite)

- [ ] **Step 1: Replace imports**

Replace the entire imports section with:

```typescript
import { Session } from '../types';
import { SingleSessionView } from './SingleSessionView';

export interface ResultsPanelProps {
  session: Session | null;
  visible: boolean;
  onDismiss: () => void;
}
```

Remove these imports (no longer needed):
- `useSessionStats`
- `prepareSessionGraphData`
- `StatCards`
- `PositionGraph`
- `RotationGraph`
- `SubScoresPanel`
- `computeSessionMetrics`
- `getAnalysisSettings`
- `useState`
- `useMemo`

- [ ] **Step 2: Rewrite the component body**

Replace the entire function body with:

```typescript
export function ResultsPanel({ session, visible, onDismiss }: ResultsPanelProps) {
  if (!visible || !session) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 'min(800px, 100vw)',
        backgroundColor: 'rgba(10, 10, 10, 0.98)',
        border: '1px solid rgba(0,255,0,0.3)',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.7)',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      {/* Header with close button */}
      <div
        style={{
          padding: '12px 16px',
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0 4px',
            opacity: 0.7,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        >
          ✕
        </button>
      </div>

      {/* Content: SingleSessionView */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <SingleSessionView session={session} />
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 3: Verify file compiles**

Run: `npm run build`
Expected: Compilation succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ResultsPanel.tsx
git commit -m "refactor: ResultsPanel simplified to wrap SingleSessionView"
```

---

### Task 3: Simplify HistoryPage to remove metric computation

**Files:**
- Modify: `src/components/HistoryPage.tsx:1-20, 284-314`

- [ ] **Step 1: Remove unused imports**

Find these lines at the top and remove them:

```typescript
import { computeSessionMetrics } from '../utils/sessionMetrics';
import { getGlobalSettings } from '../utils/globalSettings';
```

- [ ] **Step 2: Simplify single-session rendering**

Find lines 284-314 (the `{selectedCount === 1 && selectedSessions.length > 0 && ...}` block) and replace with:

```typescript
{selectedCount === 1 && selectedSessions.length > 0 && (
  <SingleSessionView session={selectedSessions[0]} />
)}
```

- [ ] **Step 3: Verify file compiles**

Run: `npm run build`
Expected: Compilation succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/HistoryPage.tsx
git commit -m "refactor: HistoryPage simplified — remove metric computation from single-session view"
```

---

### Task 4: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md:28`

- [ ] **Step 1: Fix the analysis view description**

Find line 28 which currently says:
```
3. **Review**: History page → click session → UnifiedSessionPanel shows StatCards + TimeSeriesGraph + HistogramChart
```

Replace it with:
```
3. **Review**: History page → click session → SingleSessionView shows AnalysisMetricsBanner + SubScoresPanel + TimeSeriesSegmentationGraph + HistogramChart
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: correct analysis view description in CLAUDE.md"
```

---

### Task 5: Update docs/architecture.md

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: Find and update SingleSessionView section**

Find the SingleSessionView description in architecture.md and add this section if it doesn't exist, or update it if it does:

```markdown
### SingleSessionView
- Displays rich analysis view for a single session
- Props: `session` only (computes metrics internally)
- Internally calls `getGlobalSettings()` and `computeSessionMetrics()` to derive SessionMetrics
- Components: AnalysisMetricsBanner + SubScoresPanel + TimeSeriesSegmentationGraph (per metric) + HistogramChart (per metric)
- Includes error handling: if metrics computation fails, displays "Unable to compute metrics (session may be too short)"
```

- [ ] **Step 2: Add ResultsPanel section**

Add a new section for ResultsPanel (preferably after SingleSessionView):

```markdown
### ResultsPanel
- Fixed-width side panel (800px, responsive to `min(800px, 100vw)`) displayed after Stop & Save
- Simple wrapper container around SingleSessionView
- Structure: close button header (flexShrink: 0) + SingleSessionView in scrollable content area
- Close button stays fixed at top while content scrolls independently
- Passes only `session` prop to SingleSessionView
```

- [ ] **Step 3: Verify markdown syntax**

Open the file and verify it renders correctly (no broken links, proper headings)

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: update architecture for SingleSessionView metrics computation and ResultsPanel wrapper"
```

---

### Task 6: Verify integration

**Files:**
- Test: Record a session and verify Stop & Save panel, then check History page

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Wait for server to start

- [ ] **Step 2: Record a test session**

1. Navigate to AssessmentCanvas
2. Select an exercise
3. Click "Start"
4. Move the cross cursor on canvas for a few seconds
5. Click "Stop & Save"

Expected: ResultsPanel opens with 800px width

- [ ] **Step 3: Verify Stop & Save panel content**

Check that the panel displays:
- Close button (✕) in top-right corner
- AnalysisMetricsBanner
- SubScoresPanel
- TimeSeriesSegmentationGraph (with smoothing lines and segmentation stripe)
- HistogramChart
- No old PositionGraph or RotationGraph

- [ ] **Step 4: Test close button**

Click the ✕ button. Expected: Panel closes

- [ ] **Step 5: Test History page still works**

1. Click "History" in toolbar
2. Select a session
3. Verify SingleSessionView renders with same components as Stop & Save panel

- [ ] **Step 6: Run build and tests**

Run: `npm run build`
Expected: Build succeeds

Run: `npm test 2>&1 | grep -E "(PASS|FAIL|passed|failed)"` (or similar to check test status)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: integration verified for ResultsPanel wrapping SingleSessionView"
```

---

## Success Criteria Checklist

- [ ] SingleSessionView accepts `session` prop only (no metrics prop)
- [ ] SingleSessionView computes metrics internally with error handling
- [ ] ResultsPanel wraps SingleSessionView with 800px width
- [ ] ResultsPanel shows only close button header
- [ ] Stop & Save panel displays TimeSeriesSegmentationGraph with segmentation
- [ ] Stop & Save panel displays HistogramChart
- [ ] Close button works and is positioned correctly
- [ ] Content scrolls while header stays fixed
- [ ] HistoryPage simplified: only passes `session` to SingleSessionView
- [ ] HistoryPage imports cleaned up (getGlobalSettings, computeSessionMetrics removed)
- [ ] CLAUDE.md line 28 corrected
- [ ] docs/architecture.md updated
- [ ] All builds succeed: `npm run build`
- [ ] No regressions in existing functionality
