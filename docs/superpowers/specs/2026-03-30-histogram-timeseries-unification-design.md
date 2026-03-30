# HistogramChart & TimeSeriesGraph Unification Design

**Date:** 2026-03-30
**Scope:** Refactor HistogramChart and TimeSeriesGraph to use unified view state, add box plot visualization, improve controls, and fix layout issues.

---

## Problem Statement

Currently, HistoryPage state is scattered across multiple hooks:
- `useHistoryFilters` (localStorage for filters)
- `useMultiSelect` (session selection, separate logic)
- HistogramChart (local state, no persistence)
- TimeSeriesGraph (local state, no persistence)

This creates:
1. **Code duplication**: Multiple persistence patterns
2. **Inconsistent controls**: HistogramChart has radio buttons (single metric), TimeSeriesGraph has checkboxes (multiple metrics)
3. **Inconsistent display modes**: TimeSeriesGraph has separate "Mean" and "Std Dev" toggles; HistogramChart only has "Individual" vs "Mean"
4. **Lost user preferences**: HistogramChart and TimeSeriesGraph state resets on navigation
5. **Layout waste**: HistogramChart has ~100px of empty space below x-axis

---

## Design Overview

### Architecture: Unified View State Hook

Create `useViewState` hook to centralize all HistoryPage persistent state:

```typescript
// hooks/useViewState.ts
interface ViewState {
  filters: {
    dateRange: [number, number]; // timestamps
    exerciseType: string | null;
  };
  selectedSessions: Set<string>;
  histogramMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>;
  histogramDisplayModes: Set<'individual' | 'meanStddev'>;
  timeSeriesMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>;
  timeSeriesDisplayModes: Set<'individual' | 'meanStddev'>;
  timeSeriesTimeMode: 'absolute' | 'relative';
}

export function useViewState(): {
  state: ViewState;
  updateFilters(...): void;
  updateSelectedSessions(...): void;
  toggleHistogramMetric(metric): void;
  toggleHistogramDisplayMode(mode): void;
  // ... similar for TimeSeriesGraph
}
```

**Key principles:**
- Single localStorage key: `"strabismus_view_state"`
- Hydrate on mount (localStorage → state)
- Auto-persist on state change (debounced)
- Backward compatible (graceful handling of missing keys)

**Migration path:**
- Keep `useHistoryFilters` and `useMultiSelect` as thin wrappers around `useViewState` during transition
- Update HistoryPage and UnifiedSessionPanel to use `useViewState` directly
- Remove old hooks once all callers migrated

---

## Component Changes

### HistogramChart

#### Current State
- Radio buttons for metric selection (single selection)
- Display mode toggle: "Individual" vs "Mean" (aggregate view only)
- Single session: no toggles

#### New State

**Single session view:**
- No controls or toggles
- Always shows bar chart for the selected metric
- Default metric: "Deviation"

**Aggregate view:**
- **Metric checkboxes**: Select any subset of `[deviation, x, y, rotation]`
  - Each selected metric displays its own histogram
  - Histograms stack **vertically**
  - Each histogram uses metric's color (cyan, magenta, orange, gold)
- **Display mode checkboxes** (independent toggles):
  - **Individual**: Shows thin grey horizontal lines per session per bin
    - Each line represents one session's duration value in that bin range
  - **Mean & Std Dev**: Shows box plot visualization
    - Median line, quartile box, whiskers, outliers
    - Uses metric color
  - Both can be enabled simultaneously (overlaid)

#### Visualization Details

**Individual mode:**
- For each bin range (e.g., 1-2cm), plot horizontal lines at each session's duration value
- Line style: thin, grey, 0.3 opacity
- Similar to TimeSeriesGraph's individual session lines

**Mean & Std Dev mode:**
- Box plot per bin range showing:
  - Median (line or bold section of box)
  - 25th/75th percentile (box)
  - Whiskers (1.5 × IQR, capped at min/max)
  - Outliers (plotted as dots)
- Uses metric color, full opacity
- Library: `recharts-box-plot` or custom renderer (TBD)

**Layout fix:**
- Diagnose and fix the ~100px empty space below x-axis labels
- Target: No visible empty space; chart height should match content
- Likely adjustments:
  - Reduce `BarChart` bottom margin from 50px
  - Adjust `ResponsiveContainer` height
  - May need custom recharts wrapper for tighter SVG layout

#### State Integration
- Metrics and display modes read from / write to `useViewState`
- State persists across navigation
- Defaults: metrics = `['deviation']`, displayModes = `['individual']` (single session)

---

### TimeSeriesGraph

#### Current State
- Metric checkboxes (multiple selection) ✓
- Display mode toggles: separate "Mean", "Std Dev", "Individual" ✓
- Time mode: "Absolute" vs "Relative" ✓

#### New State

**Display mode changes:**
- Merge "Mean" and "Std Dev" into single **"Mean & Std Dev"** checkbox
- When enabled, shows mean line **AND** stddev bounds (dashed) together
- Keep **"Individual"** checkbox (thin grey lines per session)
- Both toggles independent (can enable both, just one, or neither)

**Everything else unchanged:**
- Metric checkboxes work as today
- Time mode toggle unchanged
- Single vs aggregate view logic unchanged

#### Rationale
- Consistency: Both HistogramChart and TimeSeriesGraph now have identical control structure
- Aligned display: Mean and stddev are visually related (mean ± bounds); toggling separately was unintuitive
- User preference: Rarely want mean without bounds or vice versa

#### State Integration
- Display modes read from / write to `useViewState`
- State persists across navigation

---

## Data Flow

```
HistoryPage
  ├─ useViewState() → state + setters
  │
  ├─ SessionExplorer (filters, selection)
  │  └─ reads/writes: filters, selectedSessions
  │
  └─ UnifiedSessionPanel
     ├─ TimeSeriesGraph
     │  └─ reads/writes: timeSeriesMetrics, timeSeriesDisplayModes, timeSeriesTimeMode
     ├─ HistogramChart
     │  └─ reads/writes: histogramMetrics, histogramDisplayModes
     └─ TrendChart
        └─ no state changes (unaffected)
```

All state persisted to localStorage via `useViewState`.

---

## Implementation Scope

### Phase 1: Unified State
1. Create `useViewState` hook
2. Migrate HistoryPage and UnifiedSessionPanel to use it
3. Wrap old hooks for backward compatibility during transition
4. Testing: state hydration, persistence, migrations

### Phase 2: HistogramChart Refactor
1. Add metric checkboxes (replace radio buttons)
2. Refactor single vs aggregate view logic
3. Implement display mode toggles
4. Add individual mode visualization (horizontal lines)
5. Add box plot visualization (Mean & Std Dev mode)
6. Fix layout issue (SVG empty space)
7. Integrate with useViewState
8. Testing: all metric combinations, display mode toggles, persistence

### Phase 3: TimeSeriesGraph Updates
1. Merge "Mean" and "Std Dev" into "Mean & Std Dev" checkbox
2. Update visualization logic
3. Integrate with useViewState
4. Testing: display mode toggles, persistence

### Phase 4: Polish & Cleanup
1. Remove old `useHistoryFilters` and `useMultiSelect` if no longer needed
2. Update docs (architecture.md, data-types.md)
3. E2E testing: multi-metric, display modes, persistence across sessions

---

## Technical Decisions

### Box Plot Library
- **Option A**: Use community library (e.g., `recharts-box-plot`)
- **Option B**: Custom box plot renderer (recharts `Line` + `Area`)
- **Decision**: TBD after spike (libraries evaluated for API, bundle size, maintenance)

### Storage Strategy
- **localStorage** (not sessionStorage): User preferences should survive browser restart
- **Single key**: `"strabismus_view_state"` (not scattered keys)
- **Debounced writes**: Avoid thrashing localStorage on rapid state changes
- **Migration**: Version the state schema for future compatibility

### Backward Compatibility
- Old hooks (`useHistoryFilters`, `useMultiSelect`) kept as wrappers temporarily
- Gracefully handle missing localStorage keys (fall back to defaults)
- No breaking changes to component props

---

## Testing Strategy

### Unit Tests
- `useViewState`: hydration, persistence, debounce, edge cases
- HistogramChart: metric/mode toggles, visualization logic
- TimeSeriesGraph: merged display mode toggle

### Integration Tests
- Multi-metric selections persist across navigation
- Display modes persist across filter changes
- Selection persists across filter/metric changes

### Manual Testing
- Single session: no controls shown, correct metric colors
- Aggregate: individual mode shows grey lines, mean/stddev shows box plot
- Both modes enabled simultaneously
- Metrics + modes + filters combined
- localStorage inspection (verify format)

---

## Acceptance Criteria

- [ ] `useViewState` hook created, tested, and documented
- [ ] HistogramChart metrics: radio buttons → checkboxes
- [ ] HistogramChart aggregate: "Individual" + "Mean & Std Dev" independent toggles
- [ ] Individual mode: thin grey horizontal lines per session per bin
- [ ] Mean & Std Dev mode: box plot visualization
- [ ] HistogramChart layout: no visible empty space below x-axis
- [ ] TimeSeriesGraph: "Mean" + "Std Dev" → "Mean & Std Dev" merged checkbox
- [ ] All state persisted to unified localStorage key
- [ ] All tests pass (unit, integration, manual)
- [ ] docs/architecture.md and docs/styling.md updated
- [ ] No breaking changes to public component APIs

---

## Known Unknowns

- **Box plot library choice**: Pending spike evaluation
- **Exact margin/height adjustments**: Pending diagnosis of SVG layout
- **Performance**: Large number of sessions + multiple metrics → recharts rendering; may need optimization

