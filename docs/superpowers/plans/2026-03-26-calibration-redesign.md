# Calibration Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign calibration screen with visual consistency, symmetric A4 expansion, ppi units, and smart recalibration flow that remembers last method.

**Architecture:** Update CalibrationState to track `lastMode` and switch units from `ppmm` to `ppi`. Remove visual container border, unify all objects to green color. Implement symmetric expansion for A4 lines. Add recalibration detection to skip mode selection when returning from measurement phase.

**Tech Stack:** React 18, TypeScript, @emotion/react, Konva (for canvas), IndexedDB (via fake-indexeddb)

---

## File Structure

- **`src/types/index.ts`** — CalibrationState interface (add `lastMode`, change `ppmm` → `ppi`)
- **`src/context/CalibrationContext.tsx`** — CalibrationContext provider (rename `setPpmm` → `setPpi`, store `lastMode`)
- **`src/components/CalibrationScreen.tsx`** — Calibration UI (remove border, green rect, symmetric expansion, recalibration flow)
- **`src/App.tsx`** — Application state (detect recalibration, pass flag to CalibrationScreen)
- **`src/components/AssessmentCanvas.tsx`** — Measurement canvas (update `ppmm` → `ppi`)
- **`src/hooks/useCalibration.ts`** — Hook that wraps CalibrationContext (update to use `ppi`)

---

## Task 1: Update CalibrationState types

**Files:**
- Modify: `src/types/index.ts:28-32`

- [ ] **Step 1: Update CalibrationState interface**

Open `src/types/index.ts` and replace the CalibrationState interface:

```typescript
export interface CalibrationState {
  ppi: number | null;           // pixels per inch (replaces ppmm)
  timestamp: string;             // ISO8601, when last calibrated
  previousPpi?: number;          // Store previous PPI for recalibration pre-fill
  lastMode?: CalibrationMode;    // Track last-used calibration method
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "types: update CalibrationState with ppi and lastMode fields"
```

---

## Task 2: Update CalibrationContext to store lastMode and use ppi

**Files:**
- Modify: `src/context/CalibrationContext.tsx:1-48`

- [ ] **Step 1: Update CalibrationContext type definition**

Open `src/context/CalibrationContext.tsx` and update the context value type:

Replace:
```typescript
export const CalibrationContext = createContext<{
  calibration: CalibrationState | null;
  setPpmm: (ppmm: number) => Promise<void>;
  isLoading: boolean;
}>({
  calibration: null,
  setPpmm: async () => {},
  isLoading: true,
});
```

With:
```typescript
export const CalibrationContext = createContext<{
  calibration: CalibrationState | null;
  setPpi: (ppi: number, mode: CalibrationMode) => Promise<void>;
  isLoading: boolean;
}>({
  calibration: null,
  setPpi: async () => {},
  isLoading: true,
});
```

- [ ] **Step 2: Add CalibrationMode import**

At the top of `src/context/CalibrationContext.tsx`, update the import:

```typescript
import { CalibrationState, CalibrationMode } from '../types';
```

- [ ] **Step 3: Update setPpi function**

Replace the `setPpmm` function in the provider:

```typescript
const setPpi = async (ppi: number, mode: CalibrationMode) => {
  const newCalibration: CalibrationState = {
    ppi,
    timestamp: new Date().toISOString(),
    previousPpi: calibration?.ppi ?? undefined,
    lastMode: mode,
  };
  await saveCalibration(newCalibration);
  setCalibration(newCalibration);
};
```

- [ ] **Step 4: Update context provider**

Update the return statement:

```typescript
return (
  <CalibrationContext.Provider value={{ calibration, setPpi, isLoading }}>
    {children}
  </CalibrationContext.Provider>
);
```

- [ ] **Step 5: Verify no type errors**

Run: `npx tsc --noEmit`

Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/context/CalibrationContext.tsx
git commit -m "refactor: rename setPpmm to setPpi, store lastMode in context"
```

---

## Task 3: Update useCalibration hook to use setPpi

**Files:**
- Modify: `src/hooks/useCalibration.ts`

- [ ] **Step 1: Read current hook**

Run: `cat src/hooks/useCalibration.ts`

Expected: Current hook should have `setPpmm` function

- [ ] **Step 2: Update hook to expose setPpi**

Open `src/hooks/useCalibration.ts` and update to match the context:

```typescript
import { useContext } from 'react';
import { CalibrationContext } from '../context/CalibrationContext';
import { CalibrationMode } from '../types';

export function useCalibration() {
  const { calibration, setPpi, isLoading } = useContext(CalibrationContext);

  return {
    calibration,
    setPpi: (ppi: number, mode: CalibrationMode) => setPpi(ppi, mode),
    isLoading,
  };
}
```

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit`

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCalibration.ts
git commit -m "refactor: update useCalibration hook to use setPpi with mode parameter"
```

---

## Task 4: Update CalibrationScreen - Part A (Types, Constants, Props)

**Files:**
- Modify: `src/components/CalibrationScreen.tsx:1-160`

- [ ] **Step 1: Update component props**

Open `src/components/CalibrationScreen.tsx` and update the CalibrationScreenProps interface:

```typescript
interface CalibrationScreenProps {
  onComplete: () => void;
  restoredCanvasState?: CanvasState;
  recalibrating?: boolean;  // Add this prop
}
```

- [ ] **Step 2: Update component function signature**

Update the function declaration:

```typescript
export function CalibrationScreen({
  onComplete,
  restoredCanvasState,
  recalibrating = false,  // Add this with default
}: CalibrationScreenProps) {
```

- [ ] **Step 3: Verify props are used correctly**

Check that no TypeScript errors appear. Run: `npx tsc --noEmit`

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/CalibrationScreen.tsx
git commit -m "refactor: add recalibrating prop to CalibrationScreen"
```

---

## Task 5: Update CalibrationScreen - Part B (Remove green container border, update rect style)

**Files:**
- Modify: `src/components/CalibrationScreen.tsx:57-77`

- [ ] **Step 1: Remove canvasContainerStyle CSS**

Delete the entire `canvasContainerStyle` definition (lines 57-67):

```typescript
// DELETE THIS ENTIRE STYLE:
const canvasContainerStyle = css`
  border: 2px solid #00ff00;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 400px;
  height: 300px;
  position: relative;
  margin-bottom: 30px;
`;
```

- [ ] **Step 2: Add new containerStyle for calibration area**

Add a new style after containerStyle (around line 22):

```typescript
const calibrationAreaStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  position: relative;
  margin-bottom: 30px;
  min-height: 400px;
  width: 100%;
`;
```

- [ ] **Step 3: Update resizableRectStyle to use green instead of red**

Replace the `resizableRectStyle` definition:

Old:
```typescript
const resizableRectStyle = css`
  background: rgba(255, 0, 0, 0.2);
  border: 3px dashed #ff0000;
  cursor: nwse-resize;
  position: absolute;
  min-width: 50px;
  min-height: 30px;
`;
```

New:
```typescript
const resizableRectStyle = css`
  background: rgba(0, 255, 0, 0.1);
  border: 3px solid #00ff00;
  cursor: nwse-resize;
  position: absolute;
  min-width: 50px;
  min-height: 30px;

  &:hover {
    background: rgba(0, 255, 0, 0.2);
  }
`;
```

- [ ] **Step 4: Add corner handles style for credit card**

Add a new style for corner handles:

```typescript
const cornerHandleStyle = css`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #00ff00;
  position: absolute;
  cursor: nwse-resize;

  &:hover {
    background: #00cc00;
  }
`;
```

- [ ] **Step 5: Update lineHandleStyle hover color**

Update the existing `lineHandleStyle` to ensure consistent hover:

```typescript
const lineHandleStyle = css`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #00ff00;
  position: absolute;
  cursor: ew-resize;
  top: 50%;
  transform: translateY(-50%);

  &:hover {
    background: #00cc00;
  }
`;
```

- [ ] **Step 6: Verify no TypeScript errors**

Run: `npx tsc --noEmit`

Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add src/components/CalibrationScreen.tsx
git commit -m "style: remove green container border, change rect to green solid, add corner handles"
```

---

## Task 6: Update CalibrationScreen - Part C (Update canvasContainerStyle usages)

**Files:**
- Modify: `src/components/CalibrationScreen.tsx:294-408`

- [ ] **Step 1: Replace canvasContainerStyle with calibrationAreaStyle in credit card mode**

Find the credit card mode render section (around line 294) and replace:

```typescript
// FROM:
<div css={canvasContainerStyle} ref={containerRef}>

// TO:
<div css={calibrationAreaStyle} ref={containerRef}>
```

Do this for both the credit card mode and A4 modes.

- [ ] **Step 2: Add corner handles to credit card rect**

In the credit card mode render, add handles after the main rect div. Find the rect div (around line 309-318) and add:

```typescript
{/* Corner handles */}
<div
  css={cornerHandleStyle}
  style={{
    left: `${rect.x - 5}px`,
    top: `${rect.y - 5}px`,
  }}
/>
<div
  css={cornerHandleStyle}
  style={{
    right: `${rect.width - 5}px`,
    top: `${rect.y - 5}px`,
  }}
/>
<div
  css={cornerHandleStyle}
  style={{
    left: `${rect.x - 5}px`,
    bottom: `${rect.height - 5}px`,
  }}
/>
<div
  css={cornerHandleStyle}
  style={{
    right: `${rect.width - 5}px`,
    bottom: `${rect.height - 5}px`,
  }}
/>
```

Actually, corner handles positioning is complex with absolute positioning. Simplify: just make the handles more obvious. Update to show them at fixed positions on the rect:

```typescript
{/* Visual corner handles */}
{[0, 0, 1, 0, 0, 1, 1, 1].map((_, i) => (
  <div
    key={`corner-${i}`}
    css={cornerHandleStyle}
    style={{
      left: i % 2 === 0 ? `${rect.x - 5}px` : `${rect.x + rect.width - 5}px`,
      top: i < 2 ? `${rect.y - 5}px` : `${rect.y + rect.height - 5}px`,
    }}
  />
))}
```

- [ ] **Step 3: Verify render looks correct**

Run: `npm run dev` and test credit card mode visually

Expected: Green solid rect with green corner handles visible

- [ ] **Step 4: Commit**

```bash
git add src/components/CalibrationScreen.tsx
git commit -m "ui: add corner handles to credit card rect"
```

---

## Task 7: Update CalibrationScreen - Part D (Implement symmetric A4 expansion)

**Files:**
- Modify: `src/components/CalibrationScreen.tsx:165-237`

- [ ] **Step 1: Calculate screen center dynamically**

Add a reference to get the container center. In the component, calculate the center when container is available:

```typescript
const getContainerCenter = () => {
  if (!containerRef.current) return 200; // fallback
  return containerRef.current.getBoundingClientRect().width / 2;
};
```

Actually, let's simplify: use a fixed center value initially, then calculate from container. Update the line state initialization:

```typescript
const [line, setLine] = useState<LineState>({
  x1: 100,
  x2: 300,
});
```

The current container is 400px wide, so center is 200. When we remove the container, we need to calculate center relative to viewport or parent. For now, keep using container dimensions and let the container be full-width.

- [ ] **Step 2: Update handleLineMouseMove to implement symmetric expansion**

Replace the entire `handleLineMouseMove` function:

```typescript
const handleLineMouseMove = (e: React.MouseEvent) => {
  if (!isDragging || !draggingEndpoint || !containerRef.current) return;
  if (mode !== 'a4-short' && mode !== 'a4-long') return;

  const containerRect = containerRef.current.getBoundingClientRect();
  const containerWidth = containerRef.current.clientWidth;
  const screenCenter = containerWidth / 2;
  const mouseX = e.clientX - containerRect.left;

  if (draggingEndpoint === 'left') {
    // When dragging left endpoint, expand both from center
    const distance = screenCenter - mouseX;
    const newX1 = Math.max(10, screenCenter - Math.abs(distance));
    const newX2 = screenCenter + Math.abs(distance);

    setLine({
      x1: newX1,
      x2: newX2,
    });
  } else {
    // When dragging right endpoint, expand both from center
    const distance = mouseX - screenCenter;
    const newX2 = Math.min(containerWidth - 10, screenCenter + Math.abs(distance));
    const newX1 = screenCenter - Math.abs(distance);

    setLine({
      x1: newX1,
      x2: newX2,
    });
  }
};
```

- [ ] **Step 3: Test symmetric expansion**

Run: `npm run dev`

Expected: Dragging either A4 line endpoint expands symmetrically from center

- [ ] **Step 4: Commit**

```bash
git add src/components/CalibrationScreen.tsx
git commit -m "feat: implement symmetric expansion for A4 lines from center"
```

---

## Task 8: Update CalibrationScreen - Part E (Add recalibration flow)

**Files:**
- Modify: `src/components/CalibrationScreen.tsx:156-290`

- [ ] **Step 1: Update effect to handle recalibrating prop**

Update the useEffect that handles credit card pre-fill (around line 175-186):

```typescript
React.useEffect(() => {
  if (recalibrating && calibration?.lastMode) {
    // Skip mode selection on recalibration, load last mode
    setMode(calibration.lastMode);

    if (calibration.lastMode === 'credit-card' && calibration?.ppi) {
      const CARD_WIDTH_MM = 85.60;
      const CARD_HEIGHT_MM = 53.98;
      const previousPixelWidth = CARD_WIDTH_MM * calibration.ppi;
      const newHeight = previousPixelWidth * (CARD_HEIGHT_MM / CARD_WIDTH_MM);

      setRect({
        width: previousPixelWidth,
        height: newHeight,
        x: CONTAINER_CENTER_X - previousPixelWidth / 2,
        y: CONTAINER_CENTER_Y - newHeight / 2,
      });
    }
  }
}, [recalibrating, calibration]);
```

- [ ] **Step 2: Add effect to pre-fill A4 lines on recalibration**

Add a new useEffect after the credit card effect:

```typescript
React.useEffect(() => {
  if (recalibrating && calibration?.lastMode && calibration?.ppi) {
    if (calibration.lastMode === 'a4-short' || calibration.lastMode === 'a4-long') {
      const targetMm = calibration.lastMode === 'a4-short' ? 210 : 297;
      const pixelWidth = targetMm * calibration.ppi;
      const containerWidth = containerRef.current?.clientWidth || 400;
      const centerX = containerWidth / 2;

      setLine({
        x1: centerX - pixelWidth / 2,
        x2: centerX + pixelWidth / 2,
      });
    }
  }
}, [recalibrating, calibration, mode]);
```

- [ ] **Step 3: Update mode selection rendering to skip on recalibration**

Update the mode selection view (around line 268-290):

```typescript
// Mode selection view - SKIP if recalibrating
if (mode === null && !recalibrating) {
  return (
    <div css={containerStyle}>
      <div css={instructionStyle}>
        <h1>Choose Calibration Method</h1>
        <p>Select the reference object you'll use to calibrate the measurement system.</p>
      </div>

      <div css={modeSelectionStyle}>
        <button css={modeButtonStyle} onClick={() => setMode('a4-short')}>
          A4 Paper Short Edge (210 mm)
        </button>
        <button css={modeButtonStyle} onClick={() => setMode('a4-long')}>
          A4 Paper Long Edge (297 mm)
        </button>
        <button css={modeButtonStyle} onClick={() => setMode('credit-card')}>
          Credit Card (85.60 mm × 53.98 mm)
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update handleConfirm to pass mode to setPpi**

Update the `handleConfirm` function:

```typescript
const handleConfirm = async () => {
  if (ppmm && mode) {
    await setPpi(ppmm, mode);  // Now pass mode as second argument
    onComplete();
  }
};
```

Wait, we need to import the function properly. Update the destructuring from useCalibration:

```typescript
const { calibration, setPpi } = useCalibration();  // Changed from setPpmm to setPpi
```

- [ ] **Step 5: Update button visibility for recalibration**

In the button group sections for credit card and A4 modes, update the button display logic:

For credit card mode (around line 321-337), change:

```typescript
{ppmm && (
  <div css={resultStyle}>
    <p>PPMM: {ppmm.toFixed(2)} pixels/mm</p>
    <button css={buttonStyle} onClick={handleConfirm} style={{ marginTop: '20px' }}>
      Confirm & Continue
    </button>
  </div>
)}
```

To:

```typescript
{ppmm || recalibrating ? (
  <div css={resultStyle}>
    {ppmm && <p>PPI: {ppmm.toFixed(2)} pixels/inch</p>}
    {recalibrating && calibration?.ppi && !ppmm && <p>PPI: {calibration.ppi.toFixed(2)} pixels/inch</p>}
    <button css={buttonStyle} onClick={handleConfirm} style={{ marginTop: '20px' }}>
      Confirm & Continue
    </button>
  </div>
) : (
  <button css={buttonStyle} onClick={calculateCreditCardPPMM}>
    Calculate PPI
  </button>
)}
```

Do the same for A4 modes.

- [ ] **Step 6: Update calculateCreditCardPPMM and calculateA4PPMM to use PPI**

Update function names and values:

```typescript
const calculateCreditCardPPI = () => {
  const CARD_WIDTH_MM = 85.60;
  const ppiValue = rect.width / CARD_WIDTH_MM;
  setPpmmLocal(ppiValue);
};

const calculateA4PPI = () => {
  const targetMm = mode === 'a4-short' ? 210 : 297;
  const pixelWidth = line.x2 - line.x1;
  const ppiValue = pixelWidth / targetMm;
  setPpmmLocal(ppiValue);
};
```

- [ ] **Step 7: Test recalibration flow**

Run: `npm run dev`

Expected: Clicking recalibrate skips mode selection (if lastMode exists)

- [ ] **Step 8: Commit**

```bash
git add src/components/CalibrationScreen.tsx
git commit -m "feat: implement recalibration flow, skip mode selection when lastMode exists"
```

---

## Task 9: Update CalibrationScreen - Part F (Rename all ppmm references to ppi)

**Files:**
- Modify: `src/components/CalibrationScreen.tsx`

- [ ] **Step 1: Replace all text references from ppmm to ppi**

In CalibrationScreen, find all instances of:
- "PPMM" → "PPI"
- "ppmm" → "ppi"
- "pixels/mm" → "pixels/inch"

In the result display sections:

Old:
```typescript
<p>PPMM: {ppmm.toFixed(2)} pixels/mm</p>
```

New:
```typescript
<p>PPI: {ppmm.toFixed(2)} pixels/inch</p>
```

Update in both credit card and A4 result sections.

- [ ] **Step 2: Update instruction text**

Change instruction text that mentions "ppmm" to "ppi":

Old:
```typescript
<p>... The green line shows the current measurement.</p>
```

New (already correct, but verify):
```typescript
<p>Drag the line endpoints to match the length of the A4 paper edge ({a4TargetMm} mm).</p>
```

- [ ] **Step 3: Verify all changes compile**

Run: `npx tsc --noEmit`

Expected: No type errors

- [ ] **Step 4: Test UI displays correctly**

Run: `npm run dev` and visually verify all labels show "PPI" instead of "PPMM"

Expected: All references updated

- [ ] **Step 5: Commit**

```bash
git add src/components/CalibrationScreen.tsx
git commit -m "refactor: rename all ppmm references to ppi in CalibrationScreen"
```

---

## Task 10: Update App.tsx to handle recalibration

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Find the Recalibrate button handler**

Open `src/App.tsx` and find the code that handles the "Recalibrate" button click.

- [ ] **Step 2: Update button handler to detect recalibration**

Update the Recalibrate button to pass `recalibrating={true}` to CalibrationScreen:

Current (approximate):
```typescript
<button onClick={() => setShowCalibration(true)}>Recalibrate</button>
```

Should become:
```typescript
<button
  onClick={() => {
    setShowCalibration(true);
    // Recalibration mode will be detected in CalibrationScreen via lastMode
  }}
>
  Recalibrate
</button>
```

Actually, we don't need to pass a flag explicitly since CalibrationScreen can check `calibration.lastMode`. The logic is:
- If `calibration.lastMode` exists, skip mode selection
- Otherwise show mode selection

So the current code should work. Let's verify CalibrationScreen is being called with the right props.

- [ ] **Step 3: Check CalibrationScreen props in render**

Find where CalibrationScreen is rendered and verify the props:

```typescript
{showCalibration && (
  <CalibrationScreen
    onComplete={() => setShowCalibration(false)}
    restoredCanvasState={restoredCanvasState}
    // recalibrating prop is inferred from calibration.lastMode in CalibrationScreen
  />
)}
```

If `recalibrating` prop isn't being passed, we can either:
- Add it explicitly: `recalibrating={someFlag}`
- Or let CalibrationScreen infer it from `calibration.lastMode`

For simplicity, let CalibrationScreen infer it.

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit`

Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: ensure CalibrationScreen receives proper props for recalibration"
```

---

## Task 11: Update AssessmentCanvas.tsx to use ppi

**Files:**
- Modify: `src/components/AssessmentCanvas.tsx`

- [ ] **Step 1: Find all ppmm references**

Run: `grep -n "ppmm" src/components/AssessmentCanvas.tsx`

Expected: Lines showing ppmm usage

- [ ] **Step 2: Replace ppmm with ppi throughout**

Open `src/components/AssessmentCanvas.tsx` and replace:
- Variable names: `ppmm` → `ppi`
- Comments: `pixels per millimeter` → `pixels per inch`
- Calculations remain the same, just renamed

Example:
```typescript
// OLD:
const ppmm = calibration?.ppmm;
const cmToPx = (ppmm || DEFAULT_PPMM) / 2.54;

// NEW:
const ppi = calibration?.ppi;
const inchesToPx = (ppi || DEFAULT_PPI);
const cmToPx = (inchesToPx * 0.3937); // inches/cm
```

Wait, let me recalculate. PPI is pixels per inch. To convert cm to pixels:
- 1 inch = 2.54 cm
- pixels = cm * (ppi / 2.54)

So keep `cmToPx` calculation but rename the constant:

```typescript
const DEFAULT_PPI = 3.78 * 25.4; // assuming previous ppmm was 3.78, convert to ppi
```

Actually, let me check what DEFAULT_PPMM was... let me search for it first.

- [ ] **Step 3: Update DEFAULT_PPMM to DEFAULT_PPI**

Find the constant and update:

```typescript
// OLD:
const DEFAULT_PPMM = 3.78;

// NEW:
const DEFAULT_PPI = 3.78 * 25.4; // ppmm 3.78 = ppi ~96
```

Actually wait, let me recalculate: 3.78 pixels/mm = 3.78 * 25.4 = 96 pixels/inch. That's reasonable (96 dpi/ppi is close to screen standard).

- [ ] **Step 4: Update all variable references**

Replace throughout the file:
- `ppmm` → `ppi`
- `DEFAULT_PPMM` → `DEFAULT_PPI`
- Update comments

Keep the calculations the same:

```typescript
const cmToPx = (ppi || DEFAULT_PPI) / 25.4;
```

This converts cm to pixels using ppi.

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit`

Expected: No type errors

- [ ] **Step 6: Test visually**

Run: `npm run dev` and perform a calibration to verify the canvas still renders correctly

Expected: Green cross and rect display with same scale as before

- [ ] **Step 7: Commit**

```bash
git add src/components/AssessmentCanvas.tsx
git commit -m "refactor: rename ppmm to ppi in AssessmentCanvas, update calculations"
```

---

## Task 12: Run tests and verify integration

**Files:**
- Test: `src/**/*.test.ts` (existing tests)

- [ ] **Step 1: Run full test suite**

Run: `npm run test`

Expected: All tests pass (or identify which ones fail due to ppi/ppmm changes)

- [ ] **Step 2: Fix any failing tests**

If tests fail due to `ppmm` → `ppi` changes:

Update test files to use `ppi` instead of `ppmm`. Example:

```typescript
// OLD:
expect(calibration.ppmm).toBeDefined();

// NEW:
expect(calibration.ppi).toBeDefined();
```

- [ ] **Step 3: Update mock calibration data in tests**

Any test fixtures or mocks that use CalibrationState need updating:

```typescript
// OLD:
const mockCalibration: CalibrationState = { ppmm: 3.78, timestamp: '...' };

// NEW:
const mockCalibration: CalibrationState = { ppi: 96, timestamp: '...', lastMode: 'credit-card' };
```

- [ ] **Step 4: Verify all tests pass**

Run: `npm run test`

Expected: All tests pass

- [ ] **Step 5: Run dev server and manual testing**

Run: `npm run dev`

Manual test cases:
- [ ] First-time calibration shows mode selection
- [ ] Credit card mode: rect is green (solid), resizes from center, has corner handles
- [ ] A4 modes: line is green, endpoints expand symmetrically from center
- [ ] Calculate PPI button shows result with "PPI" units
- [ ] Confirm & Continue saves calibration
- [ ] Recalibrate button skips mode selection (if lastMode exists)
- [ ] Recalibrate shows "Confirm & Continue" directly with previous PPI value
- [ ] Adjust and re-calibrate changes PPI value
- [ ] No green container border visible in any mode

- [ ] **Step 6: Commit test changes**

```bash
git add src/**/*.test.ts
git commit -m "test: update tests to use ppi instead of ppmm"
```

---

## Task 13: Visual regression testing and polish

**Files:**
- Test: Manual testing in browser

- [ ] **Step 1: Verify visual consistency across modes**

Run: `npm run dev`

Visual checklist:
- [ ] Credit card rect: green solid border, corner handles green, hover feedback visible
- [ ] A4 short line: green line, green circle handles at endpoints
- [ ] A4 long line: green line, green circle handles at endpoints
- [ ] All handles: 10px diameter, lighten on hover to #00cc00
- [ ] Black background in all modes
- [ ] No green container border visible anywhere
- [ ] Instructions text is clear and visible

- [ ] **Step 2: Test recalibration flow**

Manual test:
1. Start app, calibrate credit card
2. Go to measurement
3. Click Recalibrate
4. Verify mode selection is skipped
5. Verify credit card rect pre-filled
6. Verify PPI value displayed
7. Click Confirm & Continue
8. Verify return to measurement

- [ ] **Step 3: Test A4 symmetric expansion**

Manual test:
1. Calibrate A4 short edge
2. Drag left endpoint right (should expand right endpoint equally)
3. Drag right endpoint left (should expand left endpoint equally)
4. Verify symmetry is maintained
5. Verify line can extend full screen width

- [ ] **Step 4: Test edge cases**

- Calibrate, recalibrate, recalibrate again (verify lastMode updated)
- Switch between modes via back button
- Adjust rect/line after recalibration and recalculate PPI

- [ ] **Step 5: No additional commits needed**

If everything looks correct, the feature is complete. If polish fixes are needed, commit them:

```bash
git commit -m "style: minor visual polish and refinements"
```

---

## Success Verification Checklist

After all tasks complete, verify:

- [ ] `npx tsc --noEmit` — No TypeScript errors
- [ ] `npm run test` — All tests pass
- [ ] `npm run build` — Production build succeeds
- [ ] First-time calibration: mode selection shows, can select any of 3 modes
- [ ] Credit card mode: green solid rect, resizable from center, corner handles visible
- [ ] A4 modes: green line, endpoints expand symmetrically from center
- [ ] All units show "PPI" (pixels per inch) instead of "PPMM"
- [ ] Recalibrate: skips mode selection, shows last method, pre-fills previous dimensions
- [ ] Confirm without adjusting: keeps same PPI, returns to measurement
- [ ] Confirm with adjustments: recalculates PPI, saves new value
- [ ] No green container border visible
- [ ] All handles are green circles (#00ff00), lighten to #00cc00 on hover
- [ ] Cursor feedback correct (nwse-resize for rect, ew-resize for line endpoints)

---

## Notes

- **PPI Conversion:** 1 ppi = 1/25.4 ppmm. If previous DEFAULT_PPMM was 3.78, DEFAULT_PPI = 96.
- **Symmetric Expansion Formula:** When dragging endpoint to position X, distance from center = |X - centerX|, then set opposite endpoint to centerX ± distance
- **Recalibration Detection:** Check `calibration.lastMode` — if it exists, skip mode selection
- **State Persistence:** CalibrationState now includes `lastMode`, persisted to IndexedDB automatically via context
