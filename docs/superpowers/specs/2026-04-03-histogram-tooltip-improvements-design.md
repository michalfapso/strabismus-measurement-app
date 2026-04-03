# Histogram Tooltip Improvements Design

## Overview
Refine the Distribution histogram's tooltip behavior to match the visual polish and usability of the Time Series graph. Three specific improvements: consistent font sizing, smart positioning to avoid occluding the hovered bin, and a subtler hover background overlay.

## Current State
- **Tooltip font size**: Uses recharts default `<Tooltip>` which renders larger text than desired
- **Tooltip positioning**: Centered on the hovered bin, causing overlap and obscuring the data you're looking at
- **Hover background**: Uses `rgba(255, 255, 255, 0.3)` (30% opacity grey), too bright and distracting

## Target State
1. Histogram tooltips render with the same font sizes as Time Series graph tooltips (12px main, 11px secondary)
2. Tooltip intelligently positions itself to avoid the hovered bin (right by default, left if insufficient right-side space)
3. Hover background is nearly invisible—just 8% opacity grey, only slightly brighter than the black background

## Implementation Approach

### 1. Custom Tooltip Component
Create a new tooltip component in `HistogramChart.tsx` that mirrors the `CustomTooltip` pattern from `TimeSeriesGraph.tsx`:
- Receives `active`, `payload`, and positioning context
- Renders with explicit font sizes: `12px` for primary content, `11px` for secondary
- Uses the same styling pattern: `backgroundColor: rgba(0, 0, 0, 0.8)`, padding 8px, border 1px solid rgba(255, 255, 255, 0.2)

### 2. Smart Positioning Logic
Implement positioning detection within or alongside the custom tooltip:
- Measure available horizontal space in the chart container at render time
- If the tooltip's right edge would exceed the chart boundary, position left instead
- Offset both left and right positions to create visual separation from the hovered bin
- Use CSS or inline styles to position the tooltip absolutely or adjust recharts' tooltip positioning

### 3. Reduced Hover Background Opacity
Update the `<Tooltip>` element's `cursor` prop:
- Change from: `cursor={{ fill: 'rgba(255, 255, 255, 0.3)' }}`
- Change to: `cursor={{ fill: 'rgba(255, 255, 255, 0.08)' }}`

This applies to all histogram charts (single session bar charts and aggregate box plot charts).

## Affected Components
- `HistogramChart.tsx` — the `BoxPlotTooltip` component and `renderAggregateBoxPlots()` function
- Single-session bar chart (within `HistogramBar` component)
- Aggregate box plot rendering

## Testing
- Verify font sizes match Time Series tooltip in both single-session and aggregate views
- Test tooltip positioning near left and right chart edges
- Confirm hover background is subtle but still visible for usability

## Notes
- The custom tooltip will handle both `BoxPlotTooltip` (aggregate mode) and regular bar chart tooltips
- Positioning logic should gracefully handle edge cases (very narrow charts, tooltips larger than available space)
- Color and border styling should remain consistent with existing chart aesthetic
