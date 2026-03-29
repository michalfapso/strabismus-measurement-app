# History View Enhancements — Technical Design Specification

**Date:** 2026-03-28
**Status:** Ready for Implementation

---

## Overview

Four enhancements to the History page (planned but not yet built, currently `SessionExplorer`):

1. **Shift+Click range selection** — select a contiguous range of sessions
2. **Aggregate data view** — combined stats + trend + overlay charts for multi-select
3. **Exercise type filter** — multi-select checkboxes to filter sessions by exercise tag
4. **Remove "Deselect All" button** — simplify the SelectionBar

---

## 1. Shift+Click Range Selection

### Interaction Model

| Action | Result |
|--------|--------|
| Plain click | Selects that row, sets it as the **anchor**; clears previous selection |
| Ctrl/Cmd+click | Toggles that row; does **not** move the anchor |
| Shift+click | Selects all rows between the anchor and the clicked row (inclusive); anchor does **not** move |
| Shift+click with no anchor | Behaves like a plain click; sets anchor |

### State (`useMultiSelect` hook)

```typescript
interface MultiSelectState {
  selectedIds: Set<string>;
  anchorIndex: number | null; // index in the current filteredSessions array
}
```

### Range Selection Algorithm

```typescript
function selectRange(
  filteredSessions: Session[],
  anchorIndex: number,
  clickedIndex: number,
  current: Set<string>
): Set<string> {
  const [start, end] = anchorIndex < clickedIndex
    ? [anchorIndex, clickedIndex]
    : [clickedIndex, anchorIndex];
  const rangeIds = filteredSessions.slice(start, end + 1).map(s => s.sessionId);
  return new Set([...current, ...rangeIds]);
}
```

### Edge Cases

- Anchor is updated **only** on plain click or Ctrl+click, never on Shift+click
- When the filter changes (date range or exercise type):
  - Selected items that still match the new filter criteria remain selected
  - Selected items that no longer match are removed from the selection
  - The anchor persists if the anchored item still matches; resets to `null` if it no longer matches
- Shift+click on an already-selected row still keeps it selected (additive only)

---

## 2. Aggregate Data View

When 2 or more sessions are selected, the detail panel switches from single-session view to the aggregate view. Three sections stacked vertically:

### Section 1 — Stat Cards

Four cards showing aggregate statistics across selected sessions:

| Card | Value |
|------|-------|
| Mean Deviation | `mean ± stddev` cm from center |
| Rotation Range | `mean ± stddev` degrees |
| X Range | `mean ± stddev` cm |
| Y Range | `mean ± stddev` cm |

Each card shows the **mean across sessions** of that session's metric, plus the **standard deviation** to communicate consistency.

### Section 2 — Trend Chart

Answers: *"Is the patient improving over time?"*

- **X axis:** Session date (chronological)
- **Y axis:** Selected metric value per session
- **Metric selector:** Segmented control with 4 options — Mean Deviation | Rotation Range | X Range | Y Range. Default: Mean Deviation.
- **Overlay:** A linear regression line to indicate the direction of trend
- **Data points:** One per selected session, labeled with session date on hover

### Section 3 — Overlay Time-Series Chart

Answers: *"How consistent are sessions, and how long does fusion last?"*

- Each selected session is drawn as a thin, semi-transparent colored line
- A bold line shows the **mean** across all sessions at each time position
- **Time axis toggle — Absolute / Relative (default: Absolute)**
  - **Absolute:** All sessions aligned at t=0 (session start), X axis in milliseconds. Sessions of different durations end at different X positions. This is the clinically important view — it shows directly how long fusion was maintained before breaking.
  - **Relative:** Sessions normalized to 0–100% of their duration. Useful for comparing shape/pattern regardless of duration.
- **Series toggles:** A legend with per-session show/hide toggle buttons
- **Metric selector:** Position X | Position Y | Rotation (default: Rotation, as it most directly reflects fusion quality)

---

## 3. Exercise Type Filter

### Placement

A second filter row below the date range bar, labeled "Exercise Types". Displayed as a horizontal wrapping row of labeled checkboxes. The filter row should start with buttons "All" and "None" to check all or none of those checkboxes.

### Dynamic Population

The checkbox list is built from **all distinct `exerciseTag` values found in the loaded sessions** — not from the static `PREDEFINED_EXERCISES` constant. This ensures custom exercise tags appear as first-class filter options alongside built-in ones.

```typescript
function getDistinctExerciseTypes(sessions: Session[]): string[] {
  return Array.from(new Set(sessions.map(s => s.exerciseTag))).sort();
}
```

### Default State

All checkboxes checked by default — no sessions are filtered out on initial load.

### Filter State (`useHistoryFilters` hook)

```typescript
interface HistoryFilters {
  dateRange: { from: Date; to: Date };
  selectedTypes: Set<string>; // initialized to all distinct types on load
}
```

### Combined Filtering

Both conditions apply in real-time:

```typescript
function applyFilters(sessions: Session[], filters: HistoryFilters): Session[] {
  return sessions.filter(s =>
    new Date(s.timestamp) >= filters.dateRange.from &&
    new Date(s.timestamp) <= filters.dateRange.to &&
    filters.selectedTypes.has(s.exerciseTag)
  );
}
```

### Persistence

The exercise type filter selection is persisted to sessionStorage (like the date range filter), allowing users' filter preferences to restore when returning to the history page.

### Re-initialization on Load

When sessions are (re)loaded from IndexedDB, `selectedTypes` is re-initialized to include all distinct tags from the new session list. This prevents a stale filter from hiding newly created custom exercise types.

---

## 4. Remove "Deselect All" Button

The `SelectionBar` shows:
- Session count: "3 sessions selected"
- "Export Selected" button

The "Deselect All" / "Clear Selection" action is **removed entirely**. Users deselect by:
- Plain clicking any row (resets selection to just that row)
- Ctrl/Cmd+clicking individual selected rows to toggle them off

This simplifies the bar and encourages intentional interaction rather than wholesale clearing.

---

## Key Design Decisions

- **Selection persistence across filters:** When filters change, keep selected items that still match the new criteria. This preserves user intent without forcing a full reset on every filter adjustment.
- **Anchor persistence across filters:** If the anchored item still matches new filters, keep it as the anchor. Only reset if it's filtered out.
- **Absolute time as default in overlay chart:** Clinically, prolonging fusion duration is the goal — absolute time directly answers "how long did fusion last?". Relative mode is secondary.
- **Dynamic exercise type list:** Avoids maintenance burden of keeping a hardcoded filter list in sync with session data; custom tags are automatically included.
- **Persisted exercise type filter:** Like the date range filter, exercise type selection is persisted to sessionStorage for consistent UX.
- **No "Select All" / "Deselect All":** Keeps the SelectionBar minimal; Shift+click range select already handles bulk selection efficiently.
- **Std dev on stat cards:** A mean alone is not useful for consistency assessment — pairing it with std dev immediately communicates both average performance and variability.
- **External stats library:** Mean, standard deviation, and linear regression calculations use an established library (e.g., simple-statistics) for accuracy and maintainability.
