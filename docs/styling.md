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

| Element | Style |
|---------|-------|
| Individual session lines | `rgba(180,180,180,0.3)` thin grey |
| Mean line | metric color, 3px width |
| Stddev bounds | metric color, 1.5px dashed |
| Histogram bars | metric color, full opacity |

## CSS

- All styles use emotion's `css` function
- Use `&&` prefix for specificity where needed
- Dark theme applied via component inline styles
- Props interfaces named `ComponentNameProps`
