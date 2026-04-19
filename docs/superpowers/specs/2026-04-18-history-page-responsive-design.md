# History Page Responsive Redesign — Design Spec

**Date:** 2026-04-18
**Status:** Approved for implementation

---

## Overview

The History page currently has a fixed-width left sidebar (minWidth: 300px) that makes the right panel unusably small on narrow screens. This spec covers the responsive redesign of the History page to support mobile and tablet screens, along with several UX improvements that emerged during the design process.

**Users:** Vision therapy patients tracking their own long-term performance. They use the History page primarily to see trends across many sessions, not to find individual sessions (individual session feedback is shown immediately after recording).

---

## Design Decisions Summary

### 1. Responsive Breakpoint
**768px** — matches the existing convention already used in `ProgressGraphs.tsx`.

---

### 2. Desktop Layout (≥768px) — Unchanged
The current side-by-side layout is kept as-is:
- Left sidebar: filters + sessions list + selection bar
- Right panel: analysis view

---

### 3. Mobile Layout (<768px)

**Default state:**
- Left sidebar is hidden
- Main area fills full width, showing the analysis view
- A floating **funnel button** (fixed position, bottom-left, 48×48px circular) opens the session drawer
- On first load (or when `selectedSessions` is empty), the **last 30 sessions are auto-selected**, so the user sees a meaningful multi-session trend view immediately instead of an empty state

**Session Drawer:**
- Full-screen panel that slides in from the left (CSS `transform: translateX(-100%)` → `translateX(0)`, 300ms transition)
- Triggered by tapping the floating funnel button
- Closed by tapping the X button (top-right of drawer)

**Drawer contents (top to bottom):**
1. Header row: "Sessions" label + X close button
2. DateFilterBar
3. ExerciseTypeFilterBar
4. Sessions list (scrollable, with checkboxes — see Section 5)
5. Status bar (see Section 6)

**Drawer close behavior:**
- X button closes the drawer
- Selection changes are **live** (Option A) — there is no "confirm" step; closing the drawer is the same as confirming
- No "Show Analysis" button needed; the single X button is the only dismiss affordance

---

### 4. Default Selection — Last 30 Sessions

On History page mount, if `selectedSessions` is empty (first-time user, or user previously clicked "None"):
- Sort all sessions by timestamp descending
- Auto-select the most recent 30
- This ensures a meaningful trend view is shown immediately

If `selectedSessions` is non-empty (returning user with saved state from localStorage), their selection is respected.

---

### 5. Filter / Selection Behavior — Option A

**Filters narrow the list; they do not affect the selection.**

- Filtering to "Brock String, last 7 days" shows only those sessions in the list
- Sessions that are selected but fall outside the current filter remain selected
- They continue to contribute to the analysis graphs
- They are called **"hidden"** sessions

**"All" button** selects all currently visible (filtered) sessions and adds them to the existing selection.

**"None" button** deselects ALL sessions, including hidden ones.

This gives users the ability to filter the list as a navigation/search tool without accidentally losing their comparison set.

---

### 6. Hidden Session Count

When selected sessions are not visible under the current filter, show their count:

**In desktop SelectionBar (bottom of left sidebar):**
```
24 sessions selected
6 of them are hidden
```
(Second line only appears when hiddenCount > 0)

**In mobile drawer status bar (bottom of drawer):**
```
24 sessions selected · 6 hidden by filter    [None]
```

---

### 7. Mobile Multi-Select — Checkboxes

On mobile, Ctrl+click and Shift+click are unavailable. The session list in the drawer shows a **checkbox** on each row. Tapping the checkbox (or the row) toggles that session's selection.

On desktop, the sidebar keeps the existing Ctrl+click / Shift+click behavior with no checkboxes.

---

### 8. Unified "View Session" Tooltip Button (Desktop + Mobile)

**Problem with previous behavior:** On desktop, clicking a data point silently redirected to the single-session view (confusing). On mobile, there was no way to drill into a session from graphs at all. Additionally, having a clickable "View Session" button inside a hover tooltip was broken: moving the cursor toward the button would change the hovered point, moving the tooltip away.

**New unified behavior — click-to-lock tooltip:**

**Hover state (desktop only, no locked point):**
- Hovering over a graph point shows the standard recharts tooltip with session data
- No "View Session" button in hover state (can't be clicked without the tooltip disappearing)

**Click-to-lock (desktop):**
- Clicking a data point → tooltip **locks** onto that session
  - Neon green (`#00ff00`) border on the tooltip panel
  - A small **"✕"** button appears in the top-right corner of the tooltip
  - Hover tooltip is disabled while locked (Recharts `<Tooltip active={!isLocked}>`)
  - "View Session →" button appears at the bottom of the locked tooltip
- User can now move the cursor to the tooltip and click "View Session →"
- Clicking "✕" returns to hover state (unlocks)
- Clicking a different data point updates the locked tooltip to that session

**Tap state (mobile / touch):**
- Tapping a data point shows a locked tooltip immediately (no hover state on touch screens)
- Same locked tooltip design: neon green border, "✕" button, "View Session →" button
- Tapping "✕" dismisses the tooltip
- Tapping a different point updates it

**Implementation approach:**
- Add `lockedSession: ProgressGraphsTooltipPayload | null` state to `ProgressGraphs`
- Add `onClick` handler to each `<LineChart>` / `<AreaChart>` that sets `lockedSession`
- **Single `Tooltip` component** used for both states — no code duplication. It accepts an `isLocked` prop:
  - `isLocked={false}`: standard border, no action buttons (hover state)
  - `isLocked={true}`: neon green (`#00ff00`) border, "✕" button top-right, "View Session →" button at bottom
- When **not locked**: recharts `<Tooltip content={(props) => <Tooltip {...props} isLocked={false} ... />} />` positions and shows the tooltip on hover normally
- When **locked**: recharts `<Tooltip active={false}>` is suppressed; `Tooltip` is rendered as an absolutely-positioned overlay inside the chart container, receiving the frozen `lockedSession` data directly (not from recharts props)
- Clicking "✕" sets `lockedSession` to null, re-enabling recharts hover
- Clicking a different point while locked updates `lockedSession` to that point

The drilldown state (`drillDownSessionId`) is managed in `HistoryPage` (lifted from `MultiSessionAnalysisView`).

---

### 9. Back to Analysis Button

When viewing a single session via the "View Session →" drilldown (i.e., `drillDownSessionId` is set):
- A **"← Back to Analysis"** button appears at the top of the single-session view
- Clicking it clears `drillDownSessionId` and returns to the multi-session analysis view
- The scroll position and selection state are preserved (no re-fetching needed)

This button does **not** appear when 1 session is selected from the list (where the single-session view is the natural state, not a drilldown).

---

### 10. Mobile Drawer — Status Bar and Controls

The drawer status bar sits at the bottom of the drawer. It has two rows:

**Row 1 (always visible):**
```
24 sessions selected · 6 hidden by filter    [All] [None]  [⌄]
```
- **"All"** — selects all currently visible (filtered) sessions, adds to existing selection
- **"None"** — deselects all sessions including hidden ones
- **"⌄" (down arrow)** — expands Row 2 with advanced controls; toggles to "⌃" when expanded

**Row 2 (collapsed by default, expanded by tapping ⌄):**
```
[Export CSV]  [Delete]
```
- These are power-user features surfaced via progressive disclosure rather than hidden entirely

---

### 11. Swipe-to-Close Gesture

The drawer supports swipe-left to dismiss (the natural gesture for a left-sliding drawer):
- Track `touchStart.x` on `touchstart`
- On `touchmove`: translate the drawer with the finger (`transform: translateX(deltaX)` where deltaX ≤ 0 only)
- On `touchend`: if displacement > 80px leftward OR swipe velocity is fast → animate close; otherwise spring back to open
- This uses `onTouchStart`/`onTouchMove`/`onTouchEnd` on the drawer `<div>`

---

### 12. What Is NOT in This Spec

- **Hamburger menu** for the top toolbar — separate spec already written at `docs/hamburger-menu-spec.md`

---

## Component-Level Changes

| Component | Change |
|---|---|
| `HistoryPage.tsx` | Add `isMobile`, `isDrawerOpen`, `drillDownSessionId` state; remove deselect-on-filter effect; add `hiddenCount`; auto-select last 30 on mount; responsive layout with Emotion `@media`; add floating funnel button; render `SessionDrawer` |
| `SessionDrawer.tsx` | **New component** — full-screen mobile drawer; reuses `HistoryListView` (with `checkboxMode`) and `DateFilterBar`/`ExerciseTypeFilterBar` directly to avoid code duplication; adds swipe-to-close touch handling |
| `HistoryListView.tsx` | Add `checkboxMode?: boolean` prop; render checkboxes when true |
| `SelectionBar.tsx` | Add `hiddenCount: number` prop; show hidden count below selected count |
| `SingleSessionView.tsx` | Add `onBack?: () => void` prop; render "← Back to Analysis" button when provided |
| `MultiSessionAnalysisView.tsx` | Add `onDrillDown?: (sessionId: string) => void` prop; remove internal drill-down rendering (lifted to parent) |
| `ProgressGraphs.tsx` | Add `lockedSession` state; add `onClick` on charts; rename `SharedTooltip` → `Tooltip`, add `isLocked` prop (single component, two visual states — no duplication); suppress recharts hover when locked; render locked `Tooltip` as absolute overlay |

---

## Interaction Flows

### Mobile — First Visit
1. User navigates to History → last 30 sessions auto-selected → multi-session trend graphs shown full width
2. User taps funnel button → drawer slides in → sees filters + sessions list with checkboxes
3. User taps checkbox to deselect a session → status bar updates live
4. User taps X → drawer closes → graphs update with new selection

### Mobile — View Single Session
1. User taps a graph data point → locked tooltip appears (neon green border) with "View Session →" and "✕" buttons
2. User taps "View Session →" → single-session view replaces graphs
3. User taps "← Back to Analysis" → multi-session graphs restored

### Mobile — Dismiss Drawer via Swipe
1. Drawer is open
2. User swipes left on the drawer with their finger
3. Drawer follows the finger in real-time
4. If finger travels >80px left (or fast swipe): drawer animates closed
5. If finger released too early: drawer springs back to open position

### Desktop — View Single Session via Locked Tooltip
1. User hovers over a graph data point → standard tooltip appears
2. User clicks the data point → tooltip locks (neon green border, "✕" + "View Session →" appear)
3. User moves cursor to tooltip, clicks "View Session →" → single-session view replaces analysis
4. User clicks "← Back to Analysis" → returns to multi-session analysis
5. (Alternatively: user clicks "✕" in tooltip → returns to hover mode without drilling down)

### Desktop — Filter Without Losing Selection
1. User has 24 sessions selected
2. User filters to "last 7 days" → list shows 18 sessions; 6 are selected but hidden
3. SelectionBar shows "24 sessions selected / 6 of them are hidden"
4. Graphs still show all 24 sessions
5. User clicks "None" → all 24 deselected (including the 6 hidden)

---

## Files to Create
- `src/components/SessionDrawer.tsx`
- `docs/superpowers/specs/2026-04-18-history-page-responsive-design.md` (this file)

## Files to Modify
- `src/components/HistoryPage.tsx`
- `src/components/HistoryListView.tsx`
- `src/components/SelectionBar.tsx`
- `src/components/SingleSessionView.tsx`
- `src/components/MultiSessionAnalysisView.tsx`
- `src/components/ProgressGraphs.tsx`
