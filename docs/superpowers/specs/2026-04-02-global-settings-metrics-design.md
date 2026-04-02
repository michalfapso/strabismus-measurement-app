# Global Settings & Metric Selection Design

**Date:** 2026-04-02
**Status:** Approved
**Scope:** Add dedicated Settings page with global metric/threshold management, integrate Time Series with State Segmentation, preserve History page state across navigation

## Overview

Currently, metric selection and threshold configuration is scattered:
- Metric checkboxes in TimeSeriesGraph (ad-hoc per-view)
- Thresholds in multi-session analysis config (local to that view)
- No persistent Settings page

This design centralizes all metric/threshold decisions to a **dedicated `/settings` page**, making them the single source of truth across the app. All analysis views (single-session, multi-session) become read-only consumers of these global settings, reducing UI complexity and decision fatigue.

Additionally, the Session State Timeline is **integrated into the Time Series graph** (raw + smoothed + segmentation), making the relationship between raw data and computed states immediately visual.

## Goals & Success Criteria

1. **Single source of truth** — Metrics and thresholds set once in Settings; everywhere else just displays them
2. **Reduced UI clutter** — Remove metric checkboxes from TimeSeriesGraph and analysis config panels
3. **Better data interpretation** — State segmentation strip overlaid on Time Series makes raw↔smoothed↔state relationship clear
4. **Seamless navigation** — Users can Settings→History→Measurement and always return to where they left off
5. **Correct routing** — BrowserRouter basename aligns with Vite's base path, browser navigation works reliably

Success criteria:
- Users can select which metrics they care about without leaving Settings
- All views show only selected metrics, stacked vertically with consistent ordering
- History page state (filters, selection) persists when navigating away and back
- Time Series + segmentation view clearly shows why a point was classified as FUSION/APPROACHING/etc.

## Architecture

### Settings Data Model

```typescript
interface GlobalSettings {
  // Metric selection: at least one required
  selectedMetrics: ('deviation' | 'x' | 'y' | 'rotation')[];

  // Thresholds per metric (cm for position, ° for rotation)
  thresholds: {
    deviation?: number;    // default 1.0
    x?: number;           // default 1.0
    y?: number;           // default 1.0
    rotation?: number;    // default 1
  };
}
```

**Storage:** localStorage at key `"strabismus_global_settings"`

**Migration:** Remove old `"strabismus_analysis_settings"` key during Settings page initialization (or provide migration utility)

**Defaults:** `{ selectedMetrics: ['deviation'], thresholds: { deviation: 1.0, rotation: 1 } }`

### State Preservation: History URL

When History page updates (filters applied, sessions selected), save the full URL to localStorage:
```typescript
localStorage.setItem('lastHistoryUrl', window.location.pathname + window.location.search);
```

When user clicks History button from any page (Settings, Measurement), navigate to `lastHistoryUrl` or `/history` if never set.

### BrowserRouter Configuration

Update `src/index.tsx`:
```typescript
<BrowserRouter basename="/strabismus-measurement-app/">
  <App />
</BrowserRouter>
```

This aligns with Vite's `base: '/strabismus-measurement-app/'` config.

## Settings Page (`/settings`)

**Route:** `/settings` (full page, replaces any overlay approach)

**Header:**
- Title: "Settings"
- Back/close affordance: History button in toolbar redirects to last History URL

**Layout:** Single column, scrollable content

### Metric Selection Section

**Title:** "Metrics to Track"

**Subtitle:** "Select which metrics are important for your analysis. At least one must be selected."

**Content:** Four checkboxes (equal styling):
- ☑ Deviation (cm)
- ☐ X Position (cm)
- ☐ Y Position (cm)
- ☐ Rotation (°)

**Behavior:**
- Default on first load: Deviation only
- Prevent unchecking all metrics (disable last checkbox if only one checked)
- Changes apply immediately to all other pages

### Thresholds Section

**Title:** "Thresholds"

**Subtitle:** "Define success criteria for each selected metric."

**Content:** For each selected metric, show input:
- **Deviation threshold (cm):** numeric input, default 1.0, min 0.1, step 0.1
- **X threshold (cm):** numeric input, default 1.0, min 0.1, step 0.1
- **Y threshold (cm):** numeric input, default 1.0, min 0.1, step 0.1
- **Rotation threshold (°):** numeric input, default 1, min 0.1, step 0.1

**Behavior:**
- Only show inputs for currently selected metrics
- Changes apply immediately
- Validation: prevent negative or zero values

**Note at bottom:**
> "Changes to these settings apply globally to all analysis views. No confirmation needed."

## History Page Enhancements

### State Preservation

On mount and whenever filters/selection change:
```typescript
useEffect(() => {
  localStorage.setItem('lastHistoryUrl', window.location.href);
}, [location]);
```

### Metric Settings Banner

In both single-session and multi-session analysis views, add a banner at the top of the right panel:

**Single-session view:**
```
Viewing: Deviation (threshold 0.5 cm) | Change settings →
```

**Multi-session view:**
```
Metrics: Deviation (0.5 cm), Rotation (1°) | Change settings →
```

- Display selected metrics + thresholds (read-only)
- "Change settings →" link navigates to `/settings`
- Banner background: subtle, matches theme (e.g., `rgba(255,255,255,0.05)`)

### History Button Behavior

In top toolbar:
```typescript
import { APP_BASE_URL } from '../config';

function handleHistoryClick() {
  const lastUrl = localStorage.getItem('lastHistoryUrl') || `${APP_BASE_URL}history`;
  navigate(lastUrl);
}
```

## Single Session View

### Layout (Vertical Stack)

1. **Header** — Session date, exercise, duration (unchanged)

2. **Metric Settings Banner** — Read-only: "Viewing: Deviation (0.5 cm) | Change settings →"

3. **Sub-scores Panel** — Session Sub-Scores table (unchanged)

4. **Time Series + Segmentation Stack** — For each selected metric, stacked vertically:
   - Metric name as section title (e.g., "Deviation")
   - Graph showing:
     - Raw data: solid line in metric color
     - Smoothed data: dotted line, same color, slightly lighter
     - Segmentation strip: colored state blocks at bottom (FUSION, NEAR_FUSION, APPROACHING, STABLE_DEVIATION, DRIFTING)
     - X-axis: time (seconds)
     - Y-axis: value (cm or °)
   - Legend below: show state colors + raw/smoothed line styles

5. **Histogram Stack** — For each selected metric, stacked vertically:
   - Metric name as section title
   - Existing HistogramChart component (unchanged visualization)
   - X-axis: value distribution (cm or °)

**Removed:** StateSegmentationTimeline component (integrated into Time Series)

### Time Series + Segmentation Graph Details

**Data preparation:**
- For single metric, compute raw values, smoothed values (via moving average), and state segments
- Plot time on X-axis (0 to sessionDuration seconds)
- Plot metric value on Y-axis

**Multi-metric layout:** When multiple metrics selected (e.g., Deviation + Rotation), stack graphs vertically with **aligned X-axes** (shared time axis). This allows visual correlation across metrics at any given time point.

**Visual elements per graph:**
- **Raw line:** solid, metric color, 1.5px
- **Smoothed line:** dotted (strokeDasharray), metric color at 70% opacity, 1.5px
- **Segmentation strip:**
  - Horizontal bar at bottom of plot area, ~30px tall
  - Each state segment: colored block (FUSION=#4CAF50, NEAR_FUSION=#8BC34A, etc.)
  - Segment width proportional to duration
  - Light text labels for segments >2s duration

**Cross-metric hover behavior (multi-metric only):**
- Hovering over ANY metric's graph shows:
  - **Vertical indicator line** spanning all metric graphs (same time point)
  - **Data popup overlay** showing values for all metrics at that time point
  - Popup displays: time (s), raw value, smoothed value, and current state for each metric
- This allows users to correlate states across metrics (e.g., "When Deviation reached fusion, was Rotation still high?")

**Example layout (two metrics stacked):**
```
[Time Series + Segmentation - Deviation]
Metric value (cm)
12 |
   |     /‾‾‾‾‾
6  |    /
   |___/‾‾‾‾‾‾‾‾‾
0  |________________ time (s)

   [APPROACHING][FUSION    ][APPROACHING][DRIFTING]

[Time Series + Segmentation - Rotation]
Metric value (°)
5  |     \
   |      \____
2  |           \___/‾‾
0  |________________ time (s)

   [APPROACHING][APPROACHING][STABLE][APPROACHING]

← Vertical hover indicator spans both graphs at any time point
```

## Multi-Session Analysis View

### Layout

1. **Header** — "Analysis: N sessions" + date range

2. **Metric Settings Banner** — "Metrics: Deviation (0.5 cm), Rotation (1°) | Change settings →"

3. **Analysis Sections** — Organized by metric

   For each selected metric:

   **Section A: Progress — [Metric]**
   - Fusion streak trend chart
   - Min value trend chart
   - Fusion achievement rate
   - Statistical significance

   **Section B: Exercise Effectiveness — [Metric]**
   - Ranked table of exercises

   **Section C: Session Quality — [Metric]**
   - Outliers
   - Variability

   **Section D: Milestones — [Metric]**
   - Min value progress bar
   - Sustained fusion events (consecutive calendar days with ≥1 fusion-achieving session; no threshold, show all)
   - Readiness indicators

4. **Section E: Recommendations** — Cross-metric (shown once, not per-metric)

**Removed:** Analysis config panel (thresholds now read-only, metrics set in Settings)

## Implementation Details

### Vite Base URL Variable

Create `src/config.ts` to export the Vite base URL:
```typescript
// Imported from Vite at build time
export const APP_BASE_URL = import.meta.env.BASE_URL;

// Use everywhere instead of hardcoded '/strabismus-measurement-app/'
// Example: navigate(`${APP_BASE_URL}settings`)
```

This allows changing the base URL in `vite.config.ts` once, and all navigation links automatically update.

### Global Settings Utility

Create `src/utils/globalSettings.ts`:
```typescript
export interface GlobalSettings {
  selectedMetrics: ('deviation' | 'x' | 'y' | 'rotation')[];
  thresholds: Record<string, number>;
}

export function getGlobalSettings(): GlobalSettings { }
export function setGlobalSettings(settings: GlobalSettings): void { }

// Migration utility to remove old 'strabismus_analysis_settings' key
export function migrateOldSettings(): void {
  const oldKey = 'strabismus_analysis_settings';
  if (localStorage.getItem(oldKey)) {
    localStorage.removeItem(oldKey);
  }
}
```

### Settings Page Component

Create `src/pages/SettingsPage.tsx`:
- Imports globalSettings utility
- Renders form with metric checkboxes and threshold inputs
- Saves on input change
- Navigate to history on back

### History Page Updates

- Add `useEffect` to save URL to localStorage
- Extract metric banner into reusable component
- Update History button handler to use `lastHistoryUrl`

### TimeSeriesGraph Component

- Remove metric checkboxes
- Accept selected metrics from props (read from globalSettings)
- For each metric, generate Time Series + Segmentation graph
- Remove Modal/state for metric selection

### SingleSessionView Component

- Add metric banner component
- For each selected metric, render Time Series + Segmentation graph
- For each selected metric, render Histogram

### MultiSessionAnalysisView Component

- Add metric banner component
- Remove analysis config panel
- Organize insight sections by metric
- Read selected metrics + thresholds from globalSettings

## Testing Strategy

1. **Settings persistence** — Change metrics/thresholds, refresh, verify they're retained
2. **History state** — Navigate History → Settings → History, verify session selection + filters preserved
3. **Metric-dependent views** — Select Deviation only vs Deviation+Rotation, verify correct graphs shown
4. **Threshold impact** — Change threshold, verify segmentation updates correctly
5. **Integration** — Full user flow: Settings → History → single session → back to History with state

## Dependencies & Compatibility

- No new external libraries needed
- Uses existing components: TimeSeriesGraph, HistogramChart, emotion CSS
- Refactors: TimeSeriesGraph (remove checkboxes), SingleSessionView (integrate segmentation), MultiSessionAnalysisView (remove config panel)
- New files: SettingsPage, globalSettings utility
- Backward compatible: existing sessions/reports unaffected

## Future Considerations

- Per-metric color customization in Settings
- Smoothing window size tunable in Settings (currently fixed at 11)
- Alternative smoothing algorithms (revisit ml-savitzky-golay with parameter tuning in Phase 2)
- Export settings to file / import from file
