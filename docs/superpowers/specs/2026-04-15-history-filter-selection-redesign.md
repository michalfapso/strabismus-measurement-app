# History Page Filter & Selection Redesign

**Date**: 2026-04-15  
**Scope**: UI reorganization for improved filter consistency and session selection discoverability

## Problem Statement

The History page has two pain points:
1. **Inconsistent filter preset button placement**: DateFilterBar has presets on the right; ExerciseTypeFilterBar has them on the left. This creates a disjointed interaction pattern.
2. **No persistent session selection controls**: The SelectionBar (Export/Delete) only appears after selecting sessions, making "select all" functionality invisible and requiring users to manually select sessions one-by-one.

## Solution Overview

Unify the filter preset button layout and make session selection controls always visible with explicit "All" and "None" buttons.

## Detailed Design

### 1. ExerciseTypeFilterBar Restructure

**Current layout:**
```
[All] [None] | [Checkbox: Ex1] [Checkbox: Ex2] [Checkbox: Ex3] ...
```

**New layout:**
```
[Checkbox: Ex1] [Checkbox: Ex2] [Checkbox: Ex3] ... | [All] [None]
```

**Changes:**
- Move "All" and "None" buttons to the right side of the component
- Keep checkboxes on the left/center
- Maintains existing styling (green accent, border, padding)
- Creates visual parity with DateFilterBar (inputs/controls → presets)

**Rationale:** Users see the same pattern in both filters: actual controls on left, quick presets on right. This reduces cognitive load and creates a predictable UI.

---

### 2. SelectionBar → Persistent Footer

**Current behavior:**
- Only rendered when `selectedCount > 0`
- Located at bottom of left panel
- Content: "N sessions selected | [Export CSV] [Delete]"

**New behavior:**
- Always rendered at bottom of left panel
- Content: `[All] [None] | N session(s) selected | [Export CSV] [Delete]`
- Visible even when no sessions are selected

**Button States & Behavior:**

| Button | Enabled Condition | Disabled Appearance | Behavior |
|--------|-------------------|-------------------|----------|
| **"All"** | Filtered sessions exist AND not all are selected | Grayed out (opacity 0.5) | Selects all sessions in current filtered view (respects date + exercise filters) |
| **"None"** | Any sessions are selected | Grayed out (opacity 0.5) | Clears all selections; sets `selectedSessions` to empty Set |
| **"Export CSV"** | Any sessions selected | Grayed out (opacity 0.5) | Exports selected sessions to CSV |
| **"Delete"** | Any sessions selected | Grayed out (opacity 0.5) | Deletes selected sessions after confirmation |

**Visual Layout:**
```
┌─────────────────────────────────────────┐
│ [All] [None] │ 3 sessions selected │ [📥 Export CSV] [🗑 Delete] │
└─────────────────────────────────────────┘
```

**Rationale:** 
- Persistent visibility makes session selection features always discoverable
- "All" and "None" buttons use the same terminology as exercise filters, reinforcing a learned pattern
- Button grouping (selection controls | count | action buttons) provides clear visual hierarchy

---

### 3. HistoryPage Logic Updates

**Changes to rendering:**
- Remove conditional rendering: `{selectedCount > 0 && <SelectionBar ... />}`
- Always render SelectionBar as a permanent footer in the left panel

**Changes to SelectionBar props:**
- Add `filteredSessionCount: number` (total available sessions after filters)
- Use this to determine "All" button enabled state

**Implementation pattern:**
```typescript
// In HistoryPage:
const selectAll = () => {
  const visibleIds = new Set(filteredSessions.map(s => s.sessionId));
  updateSelectedSessions(visibleIds);
};

const selectNone = () => {
  updateSelectedSessions(new Set());
};
```

**Rationale:**
- "All" operates on filtered results only (not unfiltered sessions), matching user expectations
- Selection state persists across filter changes (existing behavior via `updateSelectionAfterFilter`)

---

## Scope & Exclusions

**In scope:**
- Reordering ExerciseTypeFilterBar elements
- Lifting SelectionBar to always-visible
- Adding "All" and "None" buttons to SelectionBar
- Button state management (enabled/disabled based on selection state)

**Out of scope:**
- Refactoring DateFilterBar and ExerciseTypeFilterBar into a unified component (would be nice but adds complexity without proportional UX benefit)
- Visual redesign or new styling beyond existing patterns
- Changes to filter logic or selection behavior

---

## Testing Considerations

- **Filter button placement**: Verify ExerciseTypeFilterBar renders with checkboxes left, presets right
- **SelectionBar always visible**: Confirm toolbar renders even with zero sessions selected
- **"All" button logic**: 
  - Selects all filtered sessions
  - Disabled when all visible sessions already selected
  - Disabled when zero filtered sessions exist
- **"None" button logic**: Enabled only when selections exist
- **Export/Delete button logic**: Disabled when no selections
- **Selection persistence**: Verify selections persist across filter changes (existing behavior should not break)
- **Edge case**: Applying filters that hide all selected sessions should disable "None" button and clear the count

---

## Files to Modify

- `src/components/ExerciseTypeFilterBar.tsx` — reorder elements
- `src/components/SelectionBar.tsx` — add "All"/"None" buttons, update styling
- `src/components/HistoryPage.tsx` — remove conditional rendering of SelectionBar, add selection handlers

---

## Success Criteria

- [ ] ExerciseTypeFilterBar and DateFilterBar have consistent preset button placement (right side)
- [ ] SelectionBar is always visible in left panel footer
- [ ] "All" button selects all filtered sessions and disables appropriately
- [ ] "None" button clears selections and disables appropriately
- [ ] Export/Delete buttons remain disabled when no selections exist
- [ ] No regressions to existing filter/selection behavior
- [ ] Visual styling matches existing component patterns
