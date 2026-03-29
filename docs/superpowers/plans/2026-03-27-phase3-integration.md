# Phase 3: Integration & Testing Plan

> **Goal:** Wire Phase 2 components into App.tsx, implement export functionality, and verify E2E flow.

**Scope:**
- App.tsx routing between measurement canvas and history page
- ResultsPanel mounting on session completion
- CSV export implementation
- E2E workflow testing (measure → results → history)

---

## Tasks Overview

### Task 17: Update App.tsx - Add HistoryPage Routing

**File:** `src/App.tsx` (MODIFY)

**Changes Required:**
1. Import HistoryPage component
2. Add state: `const [showHistory, setShowHistory] = useState(false)`
3. Add HistoryButton to OverlayControls
4. Conditional rendering:
   - If showHistory: render HistoryPage with onNavigateBack callback
   - Else: render measurement canvas + controls

**Integration Points:**
- HistoryButton: onClick={() => setShowHistory(true)}
- HistoryPage.onNavigateBack: () => setShowHistory(false)
- SessionContext: use sessions and loadHistoricalSessions

**Acceptance Criteria:**
- [ ] Clicking History button opens full-screen history view
- [ ] Back button returns to measurement canvas
- [ ] History persists across navigation
- [ ] No broken imports or TypeScript errors

---

### Task 18: Update App.tsx - Mount ResultsPanel

**File:** `src/App.tsx` (MODIFY, same file as Task 17)

**Changes Required:**
1. Import ResultsPanel component
2. Get `showResults` and `setShowResults` from SessionContext
3. Get currentSession from SessionContext
4. Add ResultsPanel below OverlayControls:
   ```tsx
   <ResultsPanel
     session={currentSession}
     visible={showResults}
     onDismiss={() => setShowResults(false)}
   />
   ```

**Integration Points:**
- SessionContext: showResults, currentSession, setShowResults
- SessionContext.endSession(): already triggers setShowResults(true)
- ResultsPanel.onDismiss: calls setShowResults(false)

**Acceptance Criteria:**
- [ ] ResultsPanel appears after Stop & Save
- [ ] Shows correct session stats and graphs
- [ ] Dismiss button works
- [ ] "View in History" button navigates to history page
- [ ] "Start New Session" button clears results panel

---

### Task 19: Implement CSV Export Function

**Files:**
- Modify: `src/services/export.ts`

**Purpose:** Export single or multiple sessions as CSV with proper formatting.

**Function Signature:**
```typescript
export function downloadSessionsAsCSV(
  sessions: Session[],
  filename: string = 'sessions.csv'
): void
```

**CSV Format:**
```
sessionId,timestamp,exerciseTag,duration_ms,x_cm,y_cm,rotation_deg,timepoint_ms
SESSION_ID_1,ISO_DATE,Exercise,10000,0.5,0.3,0,0
SESSION_ID_1,ISO_DATE,Exercise,10000,0.7,0.5,2,100
...
```

**Implementation Notes:**
- Header row with column names
- One row per time-series point per session
- Include metadata (sessionId, timestamp, exerciseTag, duration)
- Proper CSV escaping for special characters
- Trigger browser download

**Acceptance Criteria:**
- [ ] Single session exports correctly
- [ ] Multiple sessions export as one CSV with all sessions
- [ ] CSV opens correctly in Excel/Sheets
- [ ] All columns present and data accurate
- [ ] Download triggered with correct filename

---

### Task 20: E2E Test - Measure → Results → History Flow

**File:** Create `src/__tests__/e2e/measurement-flow.test.ts` (optional, for documentation)

**Manual Test Checklist:**

1. **Measurement Session**
   - [ ] Start session with "Pencil Push-ups" exercise
   - [ ] Capture 10+ data points (move canvas around)
   - [ ] Click "Stop & Save"
   - [ ] Verify session saved to IndexedDB

2. **Results Panel**
   - [ ] Results panel appears on right (desktop) or as modal (mobile)
   - [ ] Shows correct exercise tag and timestamp
   - [ ] StatCards display all 4 metrics
   - [ ] PositionGraph shows both X and Y lines
   - [ ] RotationGraph shows rotation line
   - [ ] Dismiss button closes panel

3. **History Page Navigation**
   - [ ] Click "View in History" from results panel
   - [ ] Full-screen history page opens
   - [ ] Current session appears in list
   - [ ] DateFilterBar visible with presets
   - [ ] Back button returns to measurement canvas

4. **History Page Filtering**
   - [ ] Set date range filters sessions
   - [ ] "Last 7 days" preset works
   - [ ] List updates in real-time
   - [ ] Empty state shows when no sessions match

5. **History Page Selection**
   - [ ] Click session row: detail panel shows (SessionDetailPanel)
   - [ ] Ctrl+Click: toggle selection checkbox
   - [ ] Shift+Click: select range
   - [ ] SelectionBar appears with export button

6. **CSV Export**
   - [ ] Click Export CSV from SelectionBar
   - [ ] File downloads with correct filename
   - [ ] Open in Excel/Sheets: all data present
   - [ ] Multiple sessions exported correctly

7. **Responsive Design**
   - [ ] Desktop (1920×1080): side panels, two-column layout
   - [ ] Tablet (768px): stacked layout, modals work
   - [ ] Mobile (375px): full-screen panels, no horizontal scroll

8. **Start New Session**
   - [ ] Click "Start New Session" from results panel
   - [ ] Canvas clears, ready for new measurement
   - [ ] Results panel closes

---

## Implementation Order

**Sequential (dependent):**
1. **Task 17 & 18:** App.tsx integration (can do together)
2. **Task 19:** CSV export (needed for SelectionBar button)
3. **Task 20:** Manual testing (validates everything)

---

## Success Criteria

- [ ] App.tsx successfully imports and mounts all components
- [ ] HistoryPage routing works (show/hide toggle)
- [ ] ResultsPanel appears after session completion
- [ ] CSV export downloads correctly formatted file
- [ ] All E2E flows work without errors
- [ ] Responsive design verified on desktop/mobile
- [ ] TypeScript compilation clean
- [ ] No console errors in browser DevTools

---

## Rollback Plan

If App.tsx integration breaks:
1. Check imports (verify component paths)
2. Verify SessionContext API (showResults, setShowResults, etc.)
3. Check state initialization in SessionProvider
4. Look for CSS conflicts or z-index issues
5. Test with `npm run dev` and check network/console tabs

---

## Document Control

- **Version:** 1.0
- **Date:** 2026-03-27
- **Phase:** 3 (Integration & Testing)
- **Total Tasks:** 4 (Tasks 17-20)
- **Estimated Time:** 45 minutes

---
