# Histogram Tooltip Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make histogram tooltips match TimeSeriesGraph styling, position intelligently to avoid overlaying hovered bins, and reduce hover background opacity for better focus on data.

**Architecture:** Create a unified custom tooltip component (`HistogramTooltip`) that handles both bar chart and box plot tooltips with proper font sizing. Implement smart positioning via a positioning state that detects available space and shifts the tooltip left/right accordingly. Reduce cursor fill opacity for subtler visual feedback.

**Tech Stack:** React, TypeScript, emotion (CSS-in-JS), recharts

---

## File Structure

**Modified:**
- `src/components/HistogramChart.tsx` — Add HistogramTooltip component, update Tooltip configurations in both bar chart and box plot renderings

---

## Task 1: Create HistogramTooltip Component with Font Sizing

**Files:**
- Modify: `src/components/HistogramChart.tsx:1-230` (add new component before BoxPlotTooltip)

- [ ] **Step 1: Create the HistogramTooltip component**

Add this new component after the imports and before `BoxPlotTooltip`:

```typescript
/**
 * Custom tooltip component for histogram displays (bar chart and box plot)
 * Renders with consistent font sizing and smart positioning
 */
function HistogramTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { coverage?: number; count?: number; totalMeasurements?: number };
  }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  // Check if this is box plot data (has coverage field) or bar chart data
  const isBoxPlot = data.coverage !== undefined;

  if (isBoxPlot) {
    // Box plot tooltip
    const { coverage, count, totalMeasurements } = data;
    return (
      <div
        css={css`
          background-color: rgba(0, 0, 0, 0.8);
          padding: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        `}
      >
        <p css={css`margin: 0; color: #fff; font-size: 12px;`}>
          {coverage.toFixed(0)}% of measurements
        </p>
        <p css={css`margin: 4px 0 0 0; color: #ccc; font-size: 11px;`}>
          n={count} of {totalMeasurements}
        </p>
      </div>
    );
  } else {
    // Bar chart tooltip
    const duration = payload[0]?.value;
    return (
      <div
        css={css`
          background-color: rgba(0, 0, 0, 0.8);
          padding: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        `}
      >
        <p css={css`margin: 0; color: #fff; font-size: 12px;`}>
          {label}
        </p>
        <p css={css`margin: 4px 0 0 0; color: #ccc; font-size: 11px;`}>
          duration: {(duration as number).toFixed(2)}s
        </p>
      </div>
    );
  }
}
```

- [ ] **Step 2: Verify component syntax is correct**

Scan the code to ensure all closing braces match and there are no syntax errors. The new component should:
- Take `active`, `payload`, and `label` as props
- Distinguish between box plot and bar chart data via the `coverage` field
- Render 12px font for main text and 11px for secondary text
- Use the same styling as TimeSeriesGraph (black background, light borders)

---

## Task 2: Update Bar Chart Tooltip to Use HistogramTooltip

**Files:**
- Modify: `src/components/HistogramChart.tsx:753-767` (the Tooltip in HistogramBar's BarChart)

- [ ] **Step 1: Replace the bar chart Tooltip configuration**

In the `HistogramBar` component's `BarChart` rendering (around line 753), change:

```typescript
// OLD:
<Tooltip
  contentStyle={{
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '4px',
    color: '#fff',
  }}
  formatter={(value) => {
    if (typeof value === 'number') {
      return `${value.toFixed(2)}s`;
    }
    return '';
  }}
  labelStyle={{ color: '#888' }}
/>

// NEW:
<Tooltip
  content={<HistogramTooltip />}
  cursor={{ fill: 'rgba(255, 255, 255, 0.08)' }}
/>
```

This removes the old contentStyle and formatter, replaces them with the custom component, and darkens the cursor from 0.3 to 0.08 opacity.

- [ ] **Step 2: Verify the change compiles**

The BarChart should now use the custom tooltip component for bar charts in single-session and individual mode displays.

---

## Task 3: Update Box Plot Tooltip to Use HistogramTooltip

**Files:**
- Modify: `src/components/HistogramChart.tsx:631-634` (the Tooltip in renderAggregateBoxPlots)

- [ ] **Step 1: Replace the box plot Tooltip configuration**

In `renderAggregateBoxPlots` function (around line 631), change:

```typescript
// OLD:
<Tooltip
  content={<BoxPlotTooltip />}
  cursor={{ fill: 'rgba(255, 255, 255, 0.3)' }}
/>

// NEW:
<Tooltip
  content={<HistogramTooltip />}
  cursor={{ fill: 'rgba(255, 255, 255, 0.08)' }}
/>
```

This switches from `BoxPlotTooltip` to the unified `HistogramTooltip` and darkens the cursor.

- [ ] **Step 2: Verify `BoxPlotTooltip` is no longer used**

Search the file for other uses of `BoxPlotTooltip`. Since we've migrated to the unified `HistogramTooltip`, the old component can be deleted. Check that there are no other references before deletion.

- [ ] **Step 3: Delete the old BoxPlotTooltip component**

Remove the `BoxPlotTooltip` function definition (lines 189-222). It's no longer needed.

---

## Task 4: Implement Smart Tooltip Positioning

**Files:**
- Modify: `src/components/HistogramChart.tsx:189-230` (HistogramTooltip component)

- [ ] **Step 1: Create a positioning wrapper component**

Add a new wrapper component before `HistogramTooltip`:

```typescript
/**
 * Smart positioning wrapper for histogram tooltips
 * Detects available space and positions tooltip left or right
 */
const HistogramTooltipWrapper = memo(function HistogramTooltipWrapper(props: any) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<'left' | 'right'>('right');

  React.useEffect(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const chartContainer = wrapperRef.current.closest('[class*="recharts"]')?.parentElement;

      if (chartContainer) {
        const containerRect = chartContainer.getBoundingClientRect();
        // If tooltip right edge is within 50px of container right edge, position left
        if (rect.right > containerRect.right - 50) {
          setPosition('left');
        } else {
          setPosition('right');
        }
      }
    }
  });

  const positionStyle = position === 'right'
    ? css`margin-left: 12px;`
    : css`margin-right: 12px;`;

  return (
    <div ref={wrapperRef} css={positionStyle}>
      <HistogramTooltip {...props} />
    </div>
  );
});
```

- [ ] **Step 2: Update Tooltip components to use wrapper**

In both the bar chart (line 753) and box plot (line 631), change the `content` prop:

```typescript
// OLD:
<Tooltip content={<HistogramTooltip />} ... />

// NEW:
<Tooltip content={<HistogramTooltipWrapper />} ... />
```

This ensures the positioning logic wraps both types of tooltips.

- [ ] **Step 3: Verify memo import is present**

Check that `memo` is imported from React at the top of the file. It should already be there from line 1, but verify: `import { memo, useMemo } from 'react';`

---

## Task 5: Manual Testing

**Files:**
- Test: Run the app locally and verify visuals

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test single-session histogram**

- Navigate to History page
- Click a session to view its details (SingleSessionView)
- Scroll to the Distribution histogram
- Hover over different bins and verify:
  - Font size is smaller (consistent with Time Series tooltip above)
  - Text shows `[bin range]` and `duration: X.XXs`
  - Tooltip appears to the right of the hovered bin (not overlaying it)

- [ ] **Step 3: Test aggregate histogram in individual mode**

- Select multiple sessions (shift-click on History page)
- Scroll to Distribution histogram
- Click "Individual" button to enable individual mode
- Hover over bins and verify:
  - Font size matches single-session histogram
  - Tooltip positioning is consistent
  - Hover background is very subtle (barely visible, much darker than before)

- [ ] **Step 4: Test aggregate histogram in mean & stddev mode**

- With multiple sessions selected, click "Mean & Stddev" button
- Hover over bins and verify:
  - Box plot tooltip shows `X% of measurements` and `n=X of Y`
  - Font sizing matches bar chart tooltips
  - Hover background is subtle
  - Tooltip positions intelligently (shifts left near chart edges)

- [ ] **Step 5: Test tooltip positioning near chart edges**

- In aggregate mode, hover over bins at the far right of the histogram
- Verify that the tooltip shifts to the left side when there's insufficient space on the right
- Hover over bins at the left side
- Verify that the tooltip appears on the right (normal case)

- [ ] **Step 6: Verify hover background darkness**

- Compare the hover background color (the grey overlay behind the hovered bin) across both Time Series and Histogram
- The histogram hover should be much more subtle than before
- It should be barely visible, just slightly brighter than the black background

---

## Task 6: Commit

**Files:**
- Modified: `src/components/HistogramChart.tsx`

- [ ] **Step 1: Stage changes**

```bash
git add src/components/HistogramChart.tsx
```

- [ ] **Step 2: Commit with descriptive message**

```bash
git commit -m "feat: improve histogram tooltip font size, positioning, and hover visibility

- Replace recharts default tooltips with custom HistogramTooltip component
- Implement font sizing consistent with TimeSeriesGraph (12px main, 11px secondary)
- Add smart positioning to shift tooltip left/right based on available space
- Reduce hover cursor opacity from 0.3 to 0.08 for subtler visual feedback
- Remove obsolete BoxPlotTooltip component

Fixes tooltip overlap issues and improves visual consistency."
```

- [ ] **Step 3: Verify commit was created**

```bash
git log --oneline -1
```

Expected output: Commit message starting with "feat: improve histogram tooltip"

---

## Self-Review Checklist

✅ **Spec coverage:**
- Font size consistency: Task 1 creates HistogramTooltip with 12px/11px sizing, Tasks 2-3 apply it
- Smart positioning: Task 4 implements positioning wrapper
- Darker hover background: Tasks 2-3 change cursor opacity from 0.3 to 0.08

✅ **No placeholders:** All code blocks are complete, all test steps are specific, all commands are exact

✅ **Type consistency:** HistogramTooltip accepts payload with optional coverage/count fields and distinguishes via `coverage !== undefined`

✅ **DRY:** Single HistogramTooltip component used for both bar chart and box plot; HistogramTooltipWrapper used for all positioning

---

## Notes

- The positioning logic in Task 4 uses a 50px buffer from the chart edge to determine when to switch from right to left positioning
- If the tooltip needs further fine-tuning after testing, adjust the margin values (12px in the current implementation) or the buffer distance (50px)
- The `memo()` wrapper on `HistogramTooltipWrapper` prevents unnecessary re-renders of the positioning logic
