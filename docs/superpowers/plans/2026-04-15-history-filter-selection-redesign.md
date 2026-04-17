# History Page Filter & Selection Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify filter preset button placement and add persistent session selection controls with "All" and "None" buttons.

**Architecture:** 
- Reorder ExerciseTypeFilterBar JSX to match DateFilterBar layout (checkboxes left, presets right)
- Extend SelectionBar with All/None buttons and new props
- Lift SelectionBar out of conditional rendering in HistoryPage; always render as persistent footer

**Tech Stack:** React, TypeScript, emotion (existing styles)

---

## File Structure

**Modified files:**
- `src/components/ExerciseTypeFilterBar.tsx` — reorder JSX layout
- `src/components/SelectionBar.tsx` — add All/None buttons, new props
- `src/components/HistoryPage.tsx` — remove conditional render, add handlers, update layout

---

## Tasks

### Task 1: Reorder ExerciseTypeFilterBar Layout

**Files:**
- Modify: `src/components/ExerciseTypeFilterBar.tsx`

- [ ] **Step 1: Read the current component**

Current ExerciseTypeFilterBar has All/None buttons on the left, checkboxes after. Verify the structure:
```bash
head -50 src/components/ExerciseTypeFilterBar.tsx
```

- [ ] **Step 2: Update JSX to move buttons to right**

Replace lines 37-119 in ExerciseTypeFilterBar.tsx:

```typescript
return (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'center',
      padding: '12px',
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      borderBottom: '1px solid rgba(0, 255, 0, 0.2)',
      marginBottom: '12px',
    }}
  >
    {/* Checkboxes first (left) */}
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
      }}
    >
      {distinctTypes.map((type) => (
        <label
          key={type}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#0f0',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={selectedTypes.has(type)}
            onChange={() => handleToggleType(type)}
            style={{
              cursor: 'pointer',
              accentColor: '#0f0',
            }}
          />
          {type}
        </label>
      ))}
    </div>

    {/* Spacer to push buttons to right */}
    <div style={{ flex: 1 }} />

    {/* All/None buttons (right) */}
    <div style={{ display: 'flex', gap: '6px' }}>
      <button
        onClick={handleSelectAll}
        disabled={allSelected}
        style={{
          padding: '6px 10px',
          fontSize: '12px',
          backgroundColor: 'rgba(0, 255, 0, 0.1)',
          border: '1px solid #0a0',
          borderRadius: '3px',
          color: '#0f0',
          cursor: allSelected ? 'not-allowed' : 'pointer',
          opacity: allSelected ? 0.5 : 1,
        }}
      >
        All
      </button>

      <button
        onClick={handleSelectNone}
        disabled={noneSelected}
        style={{
          padding: '6px 10px',
          fontSize: '12px',
          backgroundColor: 'rgba(0, 255, 0, 0.1)',
          border: '1px solid #0a0',
          borderRadius: '3px',
          color: '#0f0',
          cursor: noneSelected ? 'not-allowed' : 'pointer',
          opacity: noneSelected ? 0.5 : 1,
        }}
      >
        None
      </button>
    </div>
  </div>
);
```

- [ ] **Step 3: Verify syntax is correct**

Run TypeScript check:
```bash
npx tsc --noEmit
```

Expected: No errors in ExerciseTypeFilterBar.tsx

- [ ] **Step 4: Commit**

```bash
git add src/components/ExerciseTypeFilterBar.tsx
git commit -m "refactor: move exercise filter presets to right side for consistency"
```

---

### Task 2: Update SelectionBar with All/None Buttons and Persistent State

**Files:**
- Modify: `src/components/SelectionBar.tsx`

- [ ] **Step 1: Update interface and add new props**

Replace lines 1-7 in SelectionBar.tsx with:

```typescript
export interface SelectionBarProps {
  selectedCount: number;
  filteredSessionCount: number;  // Total available sessions after filters
  onSelectAll: () => void;
  onSelectNone: () => void;
  onExport: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function SelectionBar({
  selectedCount,
  filteredSessionCount,
  onSelectAll,
  onSelectNone,
  onExport,
  onDelete,
  disabled = false,
}: SelectionBarProps) {
```

- [ ] **Step 2: Add button state logic**

After the props declaration, add state conditions:

```typescript
  const allSelected = selectedCount === filteredSessionCount && filteredSessionCount > 0;
  const noneSelected = selectedCount === 0;
  const selectAllEnabled = filteredSessionCount > 0 && !allSelected;
  const selectNoneEnabled = selectedCount > 0;
```

- [ ] **Step 3: Remove early return for zero selections**

Delete the early return:
```typescript
  if (selectedCount === 0) {
    return null;
  }
```

We want to always render the toolbar now.

- [ ] **Step 4: Update JSX to include All/None buttons and always render**

Replace the return statement (lines 13-63) with:

```typescript
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      backgroundColor: 'rgba(0,255,0,0.1)',
      border: '1px solid rgba(0,255,0,0.2)',
      borderRadius: '4px',
      padding: '12px 16px',
      color: '#fff',
      minHeight: '48px',
    }}>
      {/* Selection control buttons (left) */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={onSelectAll}
          disabled={!selectAllEnabled || disabled}
          style={{
            padding: '6px 10px',
            fontSize: '12px',
            color: '#00ff00',
            backgroundColor: 'rgba(0, 255, 0, 0.1)',
            border: '1px solid #00ff00',
            borderRadius: '3px',
            cursor: selectAllEnabled && !disabled ? 'pointer' : 'not-allowed',
            opacity: selectAllEnabled && !disabled ? 1 : 0.5,
          }}
        >
          All
        </button>

        <button
          onClick={onSelectNone}
          disabled={!selectNoneEnabled || disabled}
          style={{
            padding: '6px 10px',
            fontSize: '12px',
            color: '#00ff00',
            backgroundColor: 'rgba(0, 255, 0, 0.1)',
            border: '1px solid #00ff00',
            borderRadius: '3px',
            cursor: selectNoneEnabled && !disabled ? 'pointer' : 'not-allowed',
            opacity: selectNoneEnabled && !disabled ? 1 : 0.5,
          }}
        >
          None
        </button>
      </div>

      {/* Selection count (center) */}
      <div style={{ flex: 1 }}>
        <strong>{selectedCount}</strong> {selectedCount === 1 ? 'session' : 'sessions'} selected
      </div>

      {/* Action buttons (right) */}
      <button
        onClick={onExport}
        disabled={selectedCount === 0 || disabled}
        style={{
          padding: '6px 12px',
          fontSize: '12px',
          color: '#00ff00',
          backgroundColor: 'transparent',
          border: '1px solid #00ff00',
          borderRadius: '3px',
          cursor: selectedCount > 0 && !disabled ? 'pointer' : 'default',
          opacity: selectedCount > 0 && !disabled ? 1 : 0.5,
        }}
      >
        📥 Export CSV
      </button>

      <button
        onClick={onDelete}
        disabled={selectedCount === 0 || disabled}
        style={{
          padding: '6px 12px',
          fontSize: '12px',
          color: '#ff6b6b',
          backgroundColor: 'transparent',
          border: '1px solid #ff6b6b',
          borderRadius: '3px',
          cursor: selectedCount > 0 && !disabled ? 'pointer' : 'default',
          opacity: selectedCount > 0 && !disabled ? 1 : 0.5,
        }}
      >
        🗑 Delete
      </button>
    </div>
  );
```

- [ ] **Step 5: Verify syntax**

```bash
npx tsc --noEmit
```

Expected: No errors in SelectionBar.tsx

- [ ] **Step 6: Commit**

```bash
git add src/components/SelectionBar.tsx
git commit -m "feat: add persistent All/None selection buttons to toolbar"
```

---

### Task 3: Update HistoryPage to Always Render SelectionBar and Add Handlers

**Files:**
- Modify: `src/components/HistoryPage.tsx`

- [ ] **Step 1: Add selection handlers**

After the `handleRowClick` function (around line 173), add two new handlers:

```typescript
  const handleSelectAll = () => {
    const visibleIds = new Set(filteredSessions.map(s => s.sessionId));
    updateSelectedSessions(visibleIds);
  };

  const handleSelectNone = () => {
    updateSelectedSessions(new Set());
  };
```

- [ ] **Step 2: Update the left panel JSX to always render SelectionBar**

Find the conditional rendering of SelectionBar (around lines 243-251):
```typescript
              {selectedCount > 0 && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <SelectionBar
                    selectedCount={selectedCount}
                    onExport={handleExport}
                    onDelete={handleDelete}
                  />
                </div>
              )}
```

Replace it with:

```typescript
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                <SelectionBar
                  selectedCount={selectedCount}
                  filteredSessionCount={filteredSessions.length}
                  onSelectAll={handleSelectAll}
                  onSelectNone={handleSelectNone}
                  onExport={handleExport}
                  onDelete={handleDelete}
                />
              </div>
```

Note: Added `flexShrink: 0` to prevent toolbar from shrinking.

- [ ] **Step 3: Verify syntax**

```bash
npx tsc --noEmit
```

Expected: No errors in HistoryPage.tsx

- [ ] **Step 4: Commit**

```bash
git add src/components/HistoryPage.tsx
git commit -m "feat: always render SelectionBar and wire up All/None handlers"
```

---

### Task 4: Manual Testing in Browser

**Files:**
- Test: browser testing only

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected: App loads at http://localhost:5173 (or similar)

- [ ] **Step 2: Navigate to History page**

Click or navigate to the History page. Verify:
- DateFilterBar displays with inputs on left, presets (7d, 30d, All) on right
- ExerciseTypeFilterBar displays with checkboxes on left, presets (All, None) on right

- [ ] **Step 3: Test SelectionBar always visible**

Verify the toolbar is visible at the bottom of the left panel with:
- [All] [None] buttons on the left (disabled initially)
- "0 sessions selected" in the center
- [📥 Export CSV] [🗑 Delete] buttons on the right (disabled)

- [ ] **Step 4: Test "All" button**

Click the [All] button. Verify:
- All sessions in the filtered view become selected (green left border)
- "N sessions selected" count updates correctly
- [All] button becomes disabled
- [None] button becomes enabled
- [Export CSV] and [Delete] buttons become enabled

- [ ] **Step 5: Test "None" button**

Click the [None] button. Verify:
- All selections clear
- "0 sessions selected" displays
- [All] button becomes enabled
- [None] button becomes disabled
- [Export CSV] and [Delete] buttons become disabled

- [ ] **Step 6: Test filtering with selections**

Select a few sessions manually. Apply a date filter that hides some selected sessions. Verify:
- Selection persists (hidden sessions remain in `selectedSessions` set)
- Selection count shows only visible selected sessions
- Export/Delete buttons remain enabled

- [ ] **Step 7: Test filter combination**

Change exercise type filter. Apply [All] button. Verify:
- Only sessions matching both date AND exercise filters are selected
- Button states remain consistent

- [ ] **Step 8: No regressions**

Verify existing functionality still works:
- Single session selection shows analysis on right panel
- Multiple session selection shows multi-session view
- Export CSV downloads correct file
- Delete removes sessions and clears selection

---

## Self-Review Against Spec

✅ **Spec coverage:**
- ✅ ExerciseTypeFilterBar reordered (checkboxes left, All/None right)
- ✅ SelectionBar always visible 
- ✅ All/None buttons added with correct enabled/disabled states
- ✅ "All" selects filtered sessions only
- ✅ "None" clears selections
- ✅ Export/Delete disabled when no selections
- ✅ HistoryPage logic updated to always render toolbar

✅ **Placeholder scan:** No TBDs, all code is concrete

✅ **Type consistency:** 
- SelectionBar props match across all usages
- Handler signatures consistent (`() => void`)
- No undefined types or methods

✅ **Complete & testable:** Each task produces working, testable results
