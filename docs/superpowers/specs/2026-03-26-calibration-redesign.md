# Calibration Screen Redesign

**Date:** 2026-03-26
**Status:** Design approved, ready for implementation

## Overview

Redesign the calibration screen to improve visual consistency, user experience, and state management. Primary changes:
1. Switch from ppmm (pixels per millimeter) to ppi (pixels per inch) for calibration units
2. Remove green container border; all calibration objects render on black background
3. Unify color scheme: all calibration objects green with consistent handles
4. Implement symmetric expansion for A4 paper lines (expand from center)
5. Track last-used calibration method to skip mode selection on recalibrate
6. Restore previous calibration on recalibrate (editable, but skips calculation step)

## State Structure

### CalibrationState (types/index.ts)

```typescript
interface CalibrationState {
  ppi: number | null;           // pixels per inch (replaces ppmm)
  timestamp: string;             // ISO8601, when last calibrated
  previousPpi?: number;          // Store previous PPI for recalibration pre-fill
  lastMode?: CalibrationMode;    // Track last-used calibration method
}

type CalibrationMode = 'a4-short' | 'a4-long' | 'credit-card';
```

**Rationale:**
- `ppi` is more universally understood than `ppmm` and easier to communicate
- `lastMode` enables skipping mode selection on recalibrate
- `previousPpi` allows pre-filling dimensions without storing `lastRectState`/`lastLineState` (computed on-demand)

## Visual Design

### Container & Background
- **Remove:** Green 400×300px container border (`canvasContainerStyle`)
- **Replace with:** Full-screen black background (#000)
- **Result:** Calibration objects float on black, minimal visual clutter

### Calibration Objects (all 3 modes)
- **Credit card:** Solid green border rectangle (changed from red dashed)
  - Entire rect is draggable (drag from any point to resize from center)
  - Visual green circular handles at 4 corners (10px diameter) to indicate affordance
  - Cursor changes to nwse-resize to show drag capability
- **A4 short edge:** Horizontal green line with green handles at endpoints
- **A4 long edge:** Horizontal green line with green handles at endpoints

### Handle Styling
- Green circles (#00ff00) at all draggable points
- 10px diameter, centered on endpoint/corner
- Lighten on hover (e.g., #00cc00) to indicate affordance
- Cursor changes to indicate resize direction (ew-resize for line endpoints)

### Typography & Results
- Keep existing instruction text, "Calculate PPI" button, result display
- "Calculate PPI" button only shown when not recalibrating (on recalibrate, show "Confirm & Continue" directly)

## Behavior Changes

### A4 Paper Symmetric Expansion
**Current behavior:** Each endpoint moves independently
**New behavior:** Both endpoints expand symmetrically from screen center

**Implementation:**
- Fix center X at viewport center: `screenCenter = window.innerWidth / 2` (or parent container center)
- When dragging left endpoint to position `x1`:
  - Calculate distance from center: `distance = screenCenter - x1`
  - Set right endpoint: `x2 = screenCenter + distance`
- When dragging right endpoint to position `x2`:
  - Calculate distance from center: `distance = x2 - screenCenter`
  - Set left endpoint: `x1 = screenCenter - distance`

**Result:** User drags one endpoint; both expand equally in opposite directions from center

### Recalibration Flow
1. User clicks "Recalibrate" button in measurement phase
2. App saves `lastMode` to CalibrationState
3. CalibrationScreen receives props:
   - `recalibrating={true}` (or inferred from `calibration.lastMode`)
   - `recalibrating === true` → Skip mode selection
   - Load last-used mode directly with restored dimensions
4. Pre-fill dimensions from stored `ppi`:
   - **Credit card:** `pixelWidth = (85.60 / 25.4) * ppi` (3.37 inches)
   - **A4 short:** `pixelWidth = (210 / 25.4) * ppi` (8.27 inches)
   - **A4 long:** `pixelWidth = (297 / 25.4) * ppi` (11.69 inches)
5. User can:
   - Adjust dimensions by dragging (optional)
   - Click "Confirm & Continue" directly (accepts previous `ppi`)
6. If adjusted, clicking "Calculate PPI" computes new calibration
7. "Confirm & Continue" saves and returns to measurement

### First-Time Calibration
- No `lastMode` in CalibrationState
- Show mode selection screen
- Normal flow: select mode → calibrate → Calculate PPI → Confirm & Continue

## State Management Changes

### CalibrationContext (CalibrationContext.tsx)
- Rename `setPpmm` → `setPpi` for consistency
- Update function to:
  - Accept `ppi` and `mode` parameters
  - Store `lastMode` in CalibrationState
  - Save `previousPpi` from current `ppi`
  - Persist to IndexedDB

### App.tsx
- When "Recalibrate" clicked:
  - Save current `lastMode` to context
  - Check `calibration.lastMode` to decide: skip mode selection or show it
  - Pass recalibration flag to CalibrationScreen

### CalibrationScreen.tsx
- **Remove:** `canvasContainerStyle` (green border)
- **Update:** `resizableRectStyle` to use solid green border (not red dashed)
- **Update:** `lineHandleStyle` (already green, no change needed)
- **Implement:** Symmetric expansion logic for A4 modes
- **Implement:** Recalibration detection:
  - If `recalibrating === true`, skip mode selection
  - Pre-fill dimensions from `calibration.ppi`
- **Update:** Button flow:
  - If recalibrating, show "Confirm & Continue" directly
  - If first-time, show "Calculate PPI" then "Confirm & Continue"

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Change `ppmm` → `ppi` in CalibrationState; add `lastMode?: CalibrationMode` |
| `src/context/CalibrationContext.tsx` | Rename `setPpmm` → `setPpi`; update to store `lastMode` |
| `src/components/CalibrationScreen.tsx` | Remove green border; update rect color; implement symmetric expansion; add recalibration flow |
| `src/App.tsx` | Save `lastMode` when recalibrate clicked; pass recalibration flag to CalibrationScreen |
| `src/components/AssessmentCanvas.tsx` | Update `ppmm` → `ppi` throughout |
| `src/hooks/useCalibration.ts` | Update to use `ppi` instead of `ppmm` |

## Testing Checklist

- [ ] First-time calibration shows mode selection
- [ ] Each mode calculates correct PPI
- [ ] Recalibrate skips mode selection and loads last-used mode
- [ ] Recalibrate pre-fills with previous dimensions
- [ ] Credit card rect resizes from center (green color, solid border)
- [ ] A4 lines expand symmetrically from center
- [ ] Line can expand to full screen width without limits
- [ ] Handles are green circles, brighten on hover
- [ ] Confirm without adjusting keeps same PPI
- [ ] Confirm with adjustments recalculates PPI
- [ ] No green container border visible
- [ ] All text references updated from ppmm → ppi

## Success Criteria

✓ Visual consistency: same color, handle style, line style across all 3 calibration methods
✓ User can recalibrate without re-selecting method
✓ A4 lines expand symmetrically from center without container limits
✓ Handles are obvious and interactive (green, hover feedback)
✓ Recalibrate flow is fast: skip mode selection, show Confirm directly
✓ All calibration units in ppi (pixels per inch)
