# Styling Guide

## Theme

| Role | Value |
|------|-------|
| Background | `rgba(10, 10, 10, 0.98)` |
| Primary accent | `#00ff00` (green) — active states, borders, buttons |
| Header text | `#fff` |
| Secondary text | `#888` |
| Subtle borders | `rgba(255,255,255,0.1)` |

## Metric Colors

| Metric | Color |
|--------|-------|
| Deviation (√x²+y²) | `#00FFFF` cyan |
| X position | `#FF00FF` magenta |
| Y position | `#FF9500` orange |
| Rotation | `#FFC107` gold |

## Data Visualization

### TimeSeriesGraph

| Element | Style |
|---------|-------|
| Individual session lines | `rgba(180,180,180,0.3)` thin grey, 1px |
| Mean line | metric color, 2.5px solid |
| Stddev bounds | metric color, 1.5px dashed, opacity 0.5 |

### HistogramChart

#### Individual Mode (thin lines per session)
| Element | Style |
|---------|-------|
| Session horizontal lines | `rgba(180,180,180,0.3)` thin grey, 1px |

#### Mean & Std Dev Mode (box plot)
Box plot elements are stacked with all median/quartile/whisker/outlier markers at full opacity (1) in metric color:

| Element | Style |
|---------|-------|
| Median line | metric color, bold (2px), opacity 1 |
| Quartile box (Q1–Q3) | metric color, filled background, opacity 1 |
| Whiskers (min/max non-outlier) | metric color, lines extending from box, opacity 1 |
| Outliers | metric color, small dots, opacity 1 |

**Note:** Both modes can be enabled simultaneously to overlay individual lines and box plot on the same chart.

## CSS

- All styles use emotion's `css` function
- Use `&&` prefix for specificity where needed
- Dark theme applied via component inline styles
- Props interfaces named `ComponentNameProps`
