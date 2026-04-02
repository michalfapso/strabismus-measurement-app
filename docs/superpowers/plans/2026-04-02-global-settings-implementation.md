# Global Settings & Metric Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a centralized Settings page where users select metrics globally, removing ad-hoc selections from views. Merge Session State Timeline into Time Series graphs, add cross-metric hover correlation, and fix routing to use a single Vite base URL variable.

**Architecture:**
- Config module (`src/config.ts`) exports `APP_BASE_URL` for all routing
- GlobalSettings utility (`src/utils/globalSettings.ts`) manages localStorage, provides migration from old settings
- Settings page (`src/components/SettingsPage.tsx`) lets users select metrics and thresholds
- History state preserved via `lastHistoryUrl` localStorage key
- TimeSeriesSegmentationGraph component (`src/components/TimeSeriesSegmentationGraph.tsx`) merges Time Series + state segmentation with aligned axes and cross-metric hover
- Single/multi-session views become metric-driven consumers of global settings
- BrowserRouter in `src/index.tsx` receives basename prop

**Tech Stack:** React 19, TypeScript, emotion, recharts (for aligned multi-chart layout with shared hover)

---

## File Structure Map

**New Files:**
- `src/config.ts` — Vite base URL export
- `src/utils/globalSettings.ts` — Global settings CRUD + migration
- `src/utils/__tests__/globalSettings.test.ts` — Settings utility tests
- `src/components/SettingsPage.tsx` — Settings UI
- `src/components/AnalysisMetricsBanner.tsx` — Reusable read-only metrics + thresholds banner
- `src/components/TimeSeriesSegmentationGraph.tsx` — Merged Time Series + segmentation with cross-metric hover

**Modified Files:**
- `src/index.tsx` — Add BrowserRouter basename
- `src/App.tsx` — Add `/settings` route, import config
- `src/components/HistoryPage.tsx` — History state preservation, integrate banner and lastHistoryUrl logic
- `src/components/TimeSeriesGraph.tsx` — Remove metric checkboxes, delegate to globalSettings
- `src/components/SingleSessionView.tsx` — Remove StateSegmentationTimeline, integrate new TimeSeriesSegmentationGraph, add banner
- `src/components/MultiSessionAnalysisView.tsx` — Remove config panel, add banner, organize sections by metric
- `src/utils/analysisSettings.ts` — Add migration/cleanup for old settings key (optional, for cleanliness)

---

## Phase 1: Foundation (Parallelizable)

### Task 1: Create Vite Base URL Config

**Files:**
- Create: `src/config.ts`
- Modify: `vite.config.ts` (verify base setting)

- [ ] **Step 1: Read current vite.config.ts to confirm base setting**

```bash
cat /workspace/vite.config.ts
```

Expected: See `base: '/strabismus-measurement-app/'`

- [ ] **Step 2: Create src/config.ts with base URL export**

```typescript
/**
 * Application configuration.
 * Import from here for any config that may vary by deployment.
 */

export const APP_BASE_URL = import.meta.env.BASE_URL;

// Example usage:
// import { APP_BASE_URL } from '../config';
// navigate(`${APP_BASE_URL}settings`);
```

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat: add config module with Vite base URL export"
```

---

### Task 2: Create GlobalSettings Utility

**Files:**
- Create: `src/utils/globalSettings.ts`
- Modify: `src/types/analysis.ts` (if GlobalSettings type not already there)

- [ ] **Step 1: Check existing types for GlobalSettings**

```bash
grep -n "GlobalSettings" /workspace/src/types/analysis.ts || echo "Not found"
```

If not found, continue. If found, note the type definition and use it.

- [ ] **Step 2: Create src/utils/globalSettings.ts**

```typescript
/**
 * Global settings management (metrics, thresholds, analysis parameters).
 * Stored in localStorage under 'strabismus_global_settings'.
 */

export interface GlobalSettings {
  // At least one metric must be selected
  selectedMetrics: ('deviation' | 'x' | 'y' | 'rotation')[];

  // Thresholds per metric (cm for position, ° for rotation)
  thresholds: {
    deviation?: number;
    x?: number;
    y?: number;
    rotation?: number;
  };
}

const STORAGE_KEY = 'strabismus_global_settings';

// Defaults: Deviation only, 1.0 cm threshold, 1° for rotation
const DEFAULT_SETTINGS: GlobalSettings = {
  selectedMetrics: ['deviation'],
  thresholds: {
    deviation: 1.0,
    rotation: 1,
  },
};

export function getGlobalSettings(): GlobalSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(stored);

    // Ensure selectedMetrics is always an array with at least one metric
    if (!Array.isArray(parsed.selectedMetrics) || parsed.selectedMetrics.length === 0) {
      parsed.selectedMetrics = DEFAULT_SETTINGS.selectedMetrics;
    }

    // Merge thresholds with defaults (in case some are missing)
    const thresholds = { ...DEFAULT_SETTINGS.thresholds, ...parsed.thresholds };

    return {
      selectedMetrics: parsed.selectedMetrics,
      thresholds,
    };
  } catch (e) {
    console.warn('Failed to parse global settings, using defaults', e);
    return { ...DEFAULT_SETTINGS };
  }
}

export function setGlobalSettings(settings: GlobalSettings): void {
  if (!settings.selectedMetrics || settings.selectedMetrics.length === 0) {
    throw new Error('At least one metric must be selected');
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// Returns the threshold for a specific metric, or undefined if metric not selected
export function getThresholdForMetric(metric: 'deviation' | 'x' | 'y' | 'rotation'): number | undefined {
  const settings = getGlobalSettings();
  return settings.thresholds[metric];
}

// Helper: Get all selected metrics with their thresholds
export function getSelectedMetricsWithThresholds(): Array<{
  metric: 'deviation' | 'x' | 'y' | 'rotation';
  threshold: number;
}> {
  const settings = getGlobalSettings();
  return settings.selectedMetrics
    .map(metric => ({
      metric,
      threshold: settings.thresholds[metric] ?? 1.0,
    }))
    .filter(m => m.threshold !== undefined);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/globalSettings.ts
git commit -m "feat: add globalSettings utility with localStorage persistence"
```

---

### Task 3: Create GlobalSettings Tests

**Files:**
- Create: `src/utils/__tests__/globalSettings.test.ts`

- [ ] **Step 1: Write failing tests for globalSettings**

```typescript
import { getGlobalSettings, setGlobalSettings, getThresholdForMetric, getSelectedMetricsWithThresholds } from '../globalSettings';

describe('GlobalSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getGlobalSettings', () => {
    it('returns defaults when nothing stored', () => {
      const settings = getGlobalSettings();
      expect(settings.selectedMetrics).toEqual(['deviation']);
      expect(settings.thresholds.deviation).toBe(1.0);
      expect(settings.thresholds.rotation).toBe(1);
    });

    it('retrieves stored settings', () => {
      const custom = {
        selectedMetrics: ['deviation', 'rotation'],
        thresholds: { deviation: 1.5, rotation: 2 },
      };
      setGlobalSettings(custom);
      const retrieved = getGlobalSettings();
      expect(retrieved.selectedMetrics).toEqual(['deviation', 'rotation']);
      expect(retrieved.thresholds.deviation).toBe(1.5);
      expect(retrieved.thresholds.rotation).toBe(2);
    });

    it('merges thresholds with defaults', () => {
      const partial = {
        selectedMetrics: ['x', 'y'],
        thresholds: { x: 0.8 },
      };
      setGlobalSettings(partial);
      const settings = getGlobalSettings();
      expect(settings.thresholds.x).toBe(0.8);
      expect(settings.thresholds.y).toBeUndefined(); // Not set in partial
    });

    it('returns defaults if stored data is invalid', () => {
      localStorage.setItem('strabismus_global_settings', 'invalid json');
      const settings = getGlobalSettings();
      expect(settings.selectedMetrics).toEqual(['deviation']);
    });
  });

  describe('setGlobalSettings', () => {
    it('throws if no metrics selected', () => {
      expect(() => {
        setGlobalSettings({
          selectedMetrics: [],
          thresholds: {},
        });
      }).toThrow('At least one metric must be selected');
    });

    it('stores settings to localStorage', () => {
      const settings = {
        selectedMetrics: ['deviation', 'x'],
        thresholds: { deviation: 0.75, x: 0.5 },
      };
      setGlobalSettings(settings);
      const retrieved = getGlobalSettings();
      expect(retrieved.selectedMetrics).toEqual(['deviation', 'x']);
    });
  });

  describe('getThresholdForMetric', () => {
    it('returns threshold for selected metric', () => {
      setGlobalSettings({
        selectedMetrics: ['deviation', 'rotation'],
        thresholds: { deviation: 0.8, rotation: 1.5 },
      });
      expect(getThresholdForMetric('deviation')).toBe(0.8);
      expect(getThresholdForMetric('rotation')).toBe(1.5);
    });

    it('returns undefined for unselected metric', () => {
      setGlobalSettings({
        selectedMetrics: ['deviation'],
        thresholds: { deviation: 1.0 },
      });
      expect(getThresholdForMetric('rotation')).toBeUndefined();
    });
  });

  describe('getSelectedMetricsWithThresholds', () => {
    it('returns array of metric + threshold pairs', () => {
      setGlobalSettings({
        selectedMetrics: ['deviation', 'rotation'],
        thresholds: { deviation: 1.0, rotation: 1.5 },
      });
      const result = getSelectedMetricsWithThresholds();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ metric: 'deviation', threshold: 1.0 });
      expect(result[1]).toEqual({ metric: 'rotation', threshold: 1.5 });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- src/utils/__tests__/globalSettings.test.ts
```

Expected: All tests PASS (implementation was written first, now testing it)

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/globalSettings.test.ts
git commit -m "test: add globalSettings utility tests"
```

---

### Task 4: Fix BrowserRouter Basename

**Files:**
- Modify: `src/index.tsx`

- [ ] **Step 1: Read current src/index.tsx**

```bash
cat /workspace/src/index.tsx
```

- [ ] **Step 2: Update BrowserRouter to include basename**

Replace:
```typescript
<BrowserRouter>
  <App />
</BrowserRouter>
```

With:
```typescript
import { APP_BASE_URL } from './config';

<BrowserRouter basename={APP_BASE_URL}>
  <App />
</BrowserRouter>
```

Full file should look like:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { APP_BASE_URL } from './config';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <BrowserRouter basename={APP_BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 3: Verify app still loads**

```bash
npm run dev
# Visit http://localhost:5173/strabismus-measurement-app/
# Should see app load without router errors
```

- [ ] **Step 4: Commit**

```bash
git add src/index.tsx
git commit -m "fix: add basename to BrowserRouter for correct routing"
```

---

## Phase 2: State Management

### Task 5: Create Settings Page Component

**Files:**
- Create: `src/components/SettingsPage.tsx`

- [ ] **Step 1: Create SettingsPage component skeleton**

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@emotion/react';
import { THEME } from '../theme';
import { getGlobalSettings, setGlobalSettings, GlobalSettings } from '../utils/globalSettings';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettingsLocal] = useState<GlobalSettings>(() => getGlobalSettings());
  const [saved, setSaved] = useState(false);

  const handleMetricToggle = (metric: 'deviation' | 'x' | 'y' | 'rotation') => {
    setSettingsLocal(prev => {
      const newMetrics = prev.selectedMetrics.includes(metric)
        ? prev.selectedMetrics.filter(m => m !== metric)
        : [...prev.selectedMetrics, metric];

      // Prevent unchecking all metrics
      if (newMetrics.length === 0) return prev;

      return { ...prev, selectedMetrics: newMetrics };
    });
  };

  const handleThresholdChange = (metric: 'deviation' | 'x' | 'y' | 'rotation', value: number) => {
    setSettingsLocal(prev => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [metric]: Math.max(0.1, value),
      },
    }));
  };

  const handleSave = () => {
    try {
      setGlobalSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const metricLabels: Record<string, string> = {
    deviation: 'Deviation (cm)',
    x: 'X Position (cm)',
    y: 'Y Position (cm)',
    rotation: 'Rotation (°)',
  };

  return (
    <div css={css`
      position: fixed;
      inset: 0;
      background-color: ${THEME.background};
      border: 1px solid ${THEME.borderPrimary};
      z-index: 100;
      display: flex;
      flex-direction: column;
      padding: 24px;
      overflow-y: auto;
    `}>
      {/* Header */}
      <div css={css`margin-bottom: 32px;`}>
        <h1 css={css`margin: 0 0 8px 0; color: ${THEME.textPrimary}; font-size: 28px;`}>
          Settings
        </h1>
        <p css={css`margin: 0; color: ${THEME.textSecondary}; font-size: 14px;`}>
          Configure metrics and thresholds for analysis
        </p>
      </div>

      {/* Metrics Section */}
      <div css={css`margin-bottom: 32px;`}>
        <h2 css={css`margin: 0 0 12px 0; color: ${THEME.textPrimary}; font-size: 16px;`}>
          Metrics to Track
        </h2>
        <p css={css`margin: 0 0 16px 0; color: ${THEME.textSecondary}; font-size: 13px;`}>
          Select which metrics are important for your analysis. At least one must be selected.
        </p>

        <div css={css`
          display: flex;
          flex-direction: column;
          gap: 12px;
        `}>
          {(['deviation', 'x', 'y', 'rotation'] as const).map(metric => (
            <label key={metric} css={css`
              display: flex;
              align-items: center;
              gap: 8px;
              cursor: pointer;
              color: ${THEME.textPrimary};
            `}>
              <input
                type="checkbox"
                checked={settings.selectedMetrics.includes(metric)}
                onChange={() => handleMetricToggle(metric)}
                disabled={
                  settings.selectedMetrics.length === 1 &&
                  settings.selectedMetrics.includes(metric)
                }
                css={css`cursor: pointer;`}
              />
              <span>{metricLabels[metric]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Thresholds Section */}
      <div css={css`margin-bottom: 32px;`}>
        <h2 css={css`margin: 0 0 12px 0; color: ${THEME.textPrimary}; font-size: 16px;`}>
          Thresholds
        </h2>
        <p css={css`margin: 0 0 16px 0; color: ${THEME.textSecondary}; font-size: 13px;`}>
          Define success criteria for each selected metric.
        </p>

        <div css={css`
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        `}>
          {(['deviation', 'x', 'y', 'rotation'] as const).map(metric => {
            if (!settings.selectedMetrics.includes(metric)) return null;

            return (
              <div key={metric}>
                <label css={css`
                  display: block;
                  margin-bottom: 8px;
                  color: ${THEME.textPrimary};
                  font-size: 13px;
                  font-weight: 500;
                `}>
                  {metricLabels[metric]}
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={settings.thresholds[metric] ?? 1.0}
                  onChange={e => handleThresholdChange(metric, parseFloat(e.target.value))}
                  css={css`
                    width: 100%;
                    padding: 8px;
                    border: 1px solid ${THEME.borderPrimary};
                    border-radius: 4px;
                    background-color: ${THEME.backgroundLight};
                    color: ${THEME.textPrimary};
                    font-size: 14px;

                    &:focus {
                      outline: none;
                      border-color: ${THEME.accentGreen};
                    }
                  `}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Feedback */}
      {saved && (
        <div css={css`
          margin-bottom: 16px;
          padding: 12px;
          background-color: rgba(76, 175, 80, 0.1);
          border: 1px solid #4CAF50;
          border-radius: 4px;
          color: #4CAF50;
          font-size: 13px;
        `}>
          ✓ Settings saved
        </div>
      )}

      {/* Buttons */}
      <div css={css`
        display: flex;
        gap: 12px;
        margin-top: auto;
      `}>
        <button
          onClick={handleSave}
          css={css`
            flex: 1;
            padding: 10px 16px;
            background-color: ${THEME.accentGreen};
            color: black;
            border: none;
            border-radius: 4px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;

            &:hover {
              opacity: 0.9;
            }
          `}
        >
          Save Settings
        </button>
        <button
          onClick={handleBack}
          css={css`
            flex: 1;
            padding: 10px 16px;
            background-color: transparent;
            color: ${THEME.textPrimary};
            border: 1px solid ${THEME.borderPrimary};
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;

            &:hover {
              background-color: ${THEME.backgroundLight};
            }
          `}
        >
          Back (Browser Back Button)
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test SettingsPage by viewing it**

We'll add the route in Task 13, so for now just verify the component syntax is correct:

```bash
npm run build 2>&1 | grep -E "error|warning" | head -20
```

Expected: No errors related to SettingsPage

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsPage.tsx
git commit -m "feat: create Settings page component for metric/threshold configuration"
```

---

### Task 6: Create History lastHistoryUrl Preservation Hook

**Files:**
- Modify: `src/components/HistoryPage.tsx`
- Create: `src/hooks/useHistoryStatePreservation.ts` (optional, for reusability)

- [ ] **Step 1: Create reusable hook for History state preservation**

Create `src/hooks/useHistoryStatePreservation.ts`:

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to preserve History page URL (including filters and selections)
 * for restoration when navigating away and back.
 */
export function useHistoryStatePreservation() {
  const location = useLocation();

  useEffect(() => {
    // Save full URL to localStorage whenever location changes
    const fullUrl = location.pathname + location.search;
    localStorage.setItem('lastHistoryUrl', fullUrl);
  }, [location]);
}
```

- [ ] **Step 2: Integrate into HistoryPage component**

In `src/components/HistoryPage.tsx`, add near the top of the component:

```typescript
import { useHistoryStatePreservation } from '../hooks/useHistoryStatePreservation';

export function HistoryPage() {
  useHistoryStatePreservation(); // Save URL whenever HistoryPage updates

  // ... rest of component
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep -i "history" | head -10
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useHistoryStatePreservation.ts src/components/HistoryPage.tsx
git commit -m "feat: add History URL state preservation via localStorage"
```

---

### Task 7: Create AnalysisMetricsBanner Component

**Files:**
- Create: `src/components/AnalysisMetricsBanner.tsx`

- [ ] **Step 1: Create AnalysisMetricsBanner component**

```typescript
import { useNavigate } from 'react-router-dom';
import { css } from '@emotion/react';
import { THEME } from '../theme';
import { APP_BASE_URL } from '../config';

interface AnalysisMetricsBannerProps {
  selectedMetrics: ('deviation' | 'x' | 'y' | 'rotation')[];
  thresholds: Record<string, number>;
}

const metricLabels: Record<string, string> = {
  deviation: 'Deviation',
  x: 'X',
  y: 'Y',
  rotation: 'Rotation',
};

const metricUnits: Record<string, string> = {
  deviation: 'cm',
  x: 'cm',
  y: 'cm',
  rotation: '°',
};

export default function AnalysisMetricsBanner({ selectedMetrics, thresholds }: AnalysisMetricsBannerProps) {
  const navigate = useNavigate();

  if (selectedMetrics.length === 0) return null;

  const displayParts = selectedMetrics
    .map(metric => `${metricLabels[metric]} (${thresholds[metric]?.toFixed(1) ?? '?'}${metricUnits[metric]})`)
    .join(', ');

  return (
    <div css={css`
      padding: 12px 16px;
      background-color: ${THEME.panelBg};
      border: 1px solid ${THEME.borderPrimary};
      border-radius: 4px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `}>
      <span css={css`color: ${THEME.textSecondary}; font-size: 13px;`}>
        Metrics: <strong css={css`color: ${THEME.textPrimary};`}>{displayParts}</strong>
      </span>
      <button
        onClick={() => navigate(`${APP_BASE_URL}settings`)}
        css={css`
          padding: 6px 12px;
          background-color: transparent;
          color: ${THEME.accentGreen};
          border: none;
          cursor: pointer;
          font-size: 12px;
          text-decoration: underline;

          &:hover {
            opacity: 0.8;
          }
        `}
      >
        Change settings →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

```bash
npm run build 2>&1 | grep -E "AnalysisMetricsBanner.*error" || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AnalysisMetricsBanner.tsx
git commit -m "feat: create AnalysisMetricsBanner component for read-only metric display"
```

---

## Phase 3: Views (Time Series & Segmentation)

### Task 8: Create TimeSeriesSegmentationGraph Component

**Files:**
- Create: `src/components/TimeSeriesSegmentationGraph.tsx`
- Depends on: globalSettings (Task 2), sessionMetrics utilities

- [ ] **Step 1: Read current sessionMetrics structure to understand state segments**

```bash
grep -A 10 "interface StateSegment" /workspace/src/types/analysis.ts
```

Record the StateSegment interface for reference in the component.

- [ ] **Step 2: Create TimeSeriesSegmentationGraph component**

This is a large component. Here's the implementation:

```typescript
import { useMemo } from 'react';
import { css } from '@emotion/react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import { THEME } from '../theme';
import { Session, TimeSeries } from '../types';
import { StateSegment, SessionState } from '../types/analysis';
import { smoothSeries } from '../utils/smoothing';

interface TimeSeriesSegmentationGraphProps {
  session: Session;
  metric: 'deviation' | 'x' | 'y' | 'rotation';
  threshold: number;
  stateSegments: StateSegment[];
  isSingleSession: boolean;
}

const STATE_COLORS: Record<SessionState, string> = {
  FUSION: THEME.stateFusion,
  NEAR_FUSION: THEME.stateNearFusion,
  APPROACHING: THEME.stateApproaching,
  STABLE_DEVIATION: THEME.stateStableDeviation,
  DRIFTING: THEME.stateDrifting,
};

const STATE_LABELS: Record<SessionState, string> = {
  FUSION: 'Fusion',
  NEAR_FUSION: 'Near Fusion',
  APPROACHING: 'Approaching',
  STABLE_DEVIATION: 'Stable',
  DRIFTING: 'Drifting',
};

const METRIC_COLORS: Record<string, string> = {
  deviation: THEME.metricDeviation,
  x: THEME.metricX,
  y: THEME.metricY,
  rotation: THEME.metricRotation,
};

const METRIC_UNITS: Record<string, string> = {
  deviation: 'cm',
  x: 'cm',
  y: 'cm',
  rotation: '°',
};

function getMetricValue(point: TimeSeries, metric: string): number {
  if (metric === 'deviation') {
    return Math.sqrt(point.x * point.x + point.y * point.y);
  } else if (metric === 'x') {
    return point.x;
  } else if (metric === 'y') {
    return point.y;
  } else if (metric === 'rotation') {
    return Math.abs(point.r);
  }
  return 0;
}

export default function TimeSeriesSegmentationGraph({
  session,
  metric,
  threshold,
  stateSegments,
  isSingleSession,
}: TimeSeriesSegmentationGraphProps) {
  const chartData = useMemo(() => {
    if (session.timeSeries.length === 0) return [];

    const rawValues = session.timeSeries.map(ts => ({
      time: (ts.t - session.timeSeries[0].t) / 1000,
      raw: getMetricValue(ts, metric),
    }));

    let smoothedValues: number[];
    try {
      const rawNumbers = rawValues.map(v => v.raw);
      smoothedValues = smoothSeries(rawNumbers, 11);
    } catch {
      smoothedValues = rawValues.map(v => v.raw);
    }

    return rawValues.map((item, i) => ({
      time: item.time,
      raw: item.raw,
      smoothed: smoothedValues[i] ?? item.raw,
    }));
  }, [session, metric]);

  const metricColor = METRIC_COLORS[metric] || THEME.metricDeviation;
  const metricLabel = metric.charAt(0).toUpperCase() + metric.slice(1);
  const unit = METRIC_UNITS[metric];

  return (
    <div css={css`margin-bottom: 32px;`}>
      {/* Section Header */}
      <h3 css={css`
        margin: 0 0 16px 0;
        color: ${THEME.textPrimary};
        font-size: 14px;
        font-weight: 600;
      `}>
        {metricLabel} (threshold: {threshold}{unit})
      </h3>

      {/* Time Series Graph */}
      <div css={css`
        width: 100%;
        height: 300px;
        border: 1px solid ${THEME.borderPrimary};
        border-radius: 4px;
        background-color: ${THEME.panelBg};
        padding: 12px;
        box-sizing: border-box;
        margin-bottom: 12px;
      `}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={THEME.borderSecondary} />
              <XAxis
                dataKey="time"
                label={{ value: 'Time (s)', position: 'insideBottomRight', offset: -30 }}
                stroke={THEME.textSecondary}
              />
              <YAxis
                label={{ value: `${metricLabel} (${unit})`, angle: -90, position: 'insideLeft' }}
                stroke={THEME.textSecondary}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: `rgba(0, 0, 0, 0.8)`,
                  border: `1px solid ${metricColor}`,
                  borderRadius: '4px',
                  color: metricColor,
                }}
                formatter={(value: number) => value.toFixed(2)}
              />

              {/* Raw Line */}
              <Line
                type="monotone"
                dataKey="raw"
                stroke={metricColor}
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="Raw"
              />

              {/* Smoothed Line (dotted) */}
              <Line
                type="monotone"
                dataKey="smoothed"
                stroke={metricColor}
                strokeOpacity={0.7}
                strokeDasharray="5 5"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="Smoothed"
              />

              {/* Threshold Reference Line */}
              <ReferenceDot
                x={chartData[0]?.time ?? 0}
                y={threshold}
                r={0}
                label={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div css={css`color: ${THEME.textSecondary};`}>No data</div>
        )}
      </div>

      {/* State Segmentation Strip */}
      {stateSegments.length > 0 && (
        <div css={css`
          display: flex;
          height: 30px;
          border: 1px solid ${THEME.borderPrimary};
          border-radius: 4px;
          overflow: hidden;
          background-color: ${THEME.panelBg};
          margin-bottom: 12px;
        `}>
          {stateSegments.map((seg, i) => {
            const sessionDuration = chartData[chartData.length - 1]?.time ?? 1;
            const width = (seg.duration / sessionDuration) * 100;
            return (
              <div
                key={i}
                css={css`
                  flex: ${seg.duration / (chartData[chartData.length - 1]?.time ?? 1)};
                  background-color: ${STATE_COLORS[seg.state]};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 11px;
                  font-weight: bold;
                  color: white;
                  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.3);
                `}
                title={`${STATE_LABELS[seg.state]}: ${seg.duration.toFixed(1)}s`}
              >
                {seg.duration > 2 ? `${seg.duration.toFixed(1)}s` : ''}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div css={css`
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        font-size: 12px;
        color: ${THEME.textSecondary};
      `}>
        <div css={css`display: flex; align-items: center; gap: 8px;`}>
          <div css={css`width: 20px; height: 2px; background-color: ${metricColor};`} />
          <span>Raw data</span>
        </div>
        <div css={css`display: flex; align-items: center; gap: 8px;`}>
          <div css={css`width: 20px; height: 2px; background-color: ${metricColor}; opacity: 0.7; border-top: 2px dashed ${metricColor};`} />
          <span>Smoothed</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify component compiles without errors**

```bash
npm run build 2>&1 | grep -E "TimeSeriesSegmentation.*error" || echo "No errors"
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TimeSeriesSegmentationGraph.tsx
git commit -m "feat: create TimeSeriesSegmentationGraph with integrated state visualization"
```

---

### Task 9: Refactor TimeSeriesGraph to Remove Metric Checkboxes

**Files:**
- Modify: `src/components/TimeSeriesGraph.tsx`

- [ ] **Step 1: Read current TimeSeriesGraph to understand its structure**

```bash
wc -l /workspace/src/components/TimeSeriesGraph.tsx
head -100 /workspace/src/components/TimeSeriesGraph.tsx
```

- [ ] **Step 2: Remove metric checkbox logic and state**

In TimeSeriesGraph:
1. Remove any `useState` calls related to metric selection (e.g., `const [selectedMetrics, setSelectedMetrics]` or similar)
2. Remove any checkbox UI elements
3. Accept metrics as a prop from parent instead: `metrics: ('deviation' | 'x' | 'y' | 'rotation')[]`
4. Remove `DisplayMode` and related state if it's not needed by parent
5. Simplify component to only render what's passed in

Updated interface:
```typescript
export interface TimeSeriesGraphProps {
  sessions: Session[];
  metrics: ('deviation' | 'x' | 'y' | 'rotation')[]; // From globalSettings
  isSingleSession: boolean;
  viewState?: ReturnType<typeof useViewState>;
}
```

- [ ] **Step 3: Test that TimeSeriesGraph still compiles**

```bash
npm run build 2>&1 | head -50
```

Expected: No errors about TimeSeriesGraph

- [ ] **Step 4: Commit**

```bash
git add src/components/TimeSeriesGraph.tsx
git commit -m "refactor: remove metric checkboxes from TimeSeriesGraph, accept metrics as prop"
```

---

## Phase 4: Integration & Routing

### Task 10: Update App.tsx with Settings Route

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add import for SettingsPage and APP_BASE_URL**

Add at top of file:
```typescript
import { APP_BASE_URL } from './config';
import SettingsPage from './components/SettingsPage';
```

- [ ] **Step 2: Add /settings route to useRoutes**

Find the `useRoutes` call and add the settings route:

```typescript
const element = useRoutes([
  { path: '/', element: <AssessmentCanvas /> },
  { path: '/history', element: <HistoryPage /> },
  { path: '/settings', element: <SettingsPage /> },
]);
```

- [ ] **Step 3: Update History button handler to use lastHistoryUrl and APP_BASE_URL**

Find the History button click handler and update it:

```typescript
const handleHistoryNavigation = () => {
  const lastUrl = localStorage.getItem('lastHistoryUrl') || `${APP_BASE_URL}history`;
  navigate(lastUrl);
};
```

- [ ] **Step 4: Test routing**

```bash
npm run dev &
# In browser, navigate to:
# http://localhost:5173/strabismus-measurement-app/settings
# Should see Settings page
# Click back or History button, should navigate correctly
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add Settings route to App, update History navigation"
```

---

### Task 11: Update SingleSessionView to Use GlobalSettings and New Components

**Files:**
- Modify: `src/components/SingleSessionView.tsx`

- [ ] **Step 1: Add imports for new utilities and components**

```typescript
import { getGlobalSettings, getThresholdForMetric } from '../utils/globalSettings';
import AnalysisMetricsBanner from './AnalysisMetricsBanner';
import TimeSeriesSegmentationGraph from './TimeSeriesSegmentationGraph';
```

- [ ] **Step 2: Update component to use globalSettings**

At the top of the component function, add:
```typescript
const globalSettings = getGlobalSettings();
const { selectedMetrics, thresholds } = globalSettings;
```

- [ ] **Step 3: Replace StateSegmentationTimeline with TimeSeriesSegmentationGraph calls**

Remove the `<StateSegmentationTimeline ... />` component.

Add the banner at the top of the return:
```typescript
<AnalysisMetricsBanner selectedMetrics={selectedMetrics} thresholds={thresholds} />
```

For each selected metric, render TimeSeriesSegmentationGraph:
```typescript
{selectedMetrics.map(metric => (
  <TimeSeriesSegmentationGraph
    key={metric}
    session={session}
    metric={metric}
    threshold={thresholds[metric] ?? 1.0}
    stateSegments={metrics[metric]?.stateSegments ?? []}
    isSingleSession={true}
  />
))}
```

You'll need to compute metrics for each metric:
```typescript
const metrics: Record<string, SessionMetrics> = useMemo(() => {
  const result: Record<string, SessionMetrics> = {};
  for (const metric of selectedMetrics) {
    const threshold = thresholds[metric] ?? 1.0;
    try {
      result[metric] = computeSessionMetrics(session, { ...thresholds, [metric]: threshold }, metric);
    } catch (e) {
      console.warn(`Failed to compute metrics for ${metric}:`, e);
    }
  }
  return result;
}, [session, selectedMetrics, thresholds]);
```

- [ ] **Step 4: Update HistogramChart to show selected metrics**

For each selected metric, render a histogram:
```typescript
{selectedMetrics.map(metric => (
  <div key={`histogram-${metric}`} css={css`margin-bottom: 24px;`}>
    <h3 css={css`margin: 0 0 12px 0; color: ${THEME.textPrimary};`}>
      {metric.charAt(0).toUpperCase() + metric.slice(1)} Distribution
    </h3>
    <HistogramChart sessions={[session]} isSingleSession={true} metric={metric} />
  </div>
))}
```

- [ ] **Step 5: Test SingleSessionView**

Navigate to History, select a single session, verify:
- Metrics banner shows selected metrics and thresholds
- TimeSeriesSegmentationGraph appears for each selected metric
- Histograms appear for each selected metric

- [ ] **Step 6: Commit**

```bash
git add src/components/SingleSessionView.tsx
git commit -m "feat: integrate global settings and new TimeSeriesSegmentationGraph into single session view"
```

---

### Task 12: Update MultiSessionAnalysisView to Use GlobalSettings

**Files:**
- Modify: `src/components/MultiSessionAnalysisView.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { getGlobalSettings } from '../utils/globalSettings';
import AnalysisMetricsBanner from './AnalysisMetricsBanner';
```

- [ ] **Step 2: Remove analysis config panel**

Delete the entire `<div css={...}>` containing:
- Metric checkboxes
- Threshold inputs
- Sustained days input

- [ ] **Step 3: Read metrics and thresholds from globalSettings**

At top of component:
```typescript
const globalSettings = getGlobalSettings();
const { selectedMetrics, thresholds } = globalSettings;
```

Remove the `analysisConfig` state and `onConfigChange` prop completely.

- [ ] **Step 4: Add AnalysisMetricsBanner**

In the return JSX, add at the top:
```typescript
<AnalysisMetricsBanner selectedMetrics={selectedMetrics} thresholds={thresholds} />
```

- [ ] **Step 5: Organize insights sections by metric**

Refactor the insights rendering to organize by metric. For each selected metric, render all sections (Progress, Exercise, Quality, Milestones):

```typescript
{selectedMetrics.map(metric => (
  <div key={`metric-${metric}`}>
    {/* Progress — [Metric] */}
    <div>
      <h2>{metric === 'deviation' ? 'Deviation' : metric.toUpperCase()} Analysis</h2>
      {/* Progress section content filtered to this metric */}
      {progressInsights.filter(p => p.metric === metric).map(insight => (
        // render progress section
      ))}
    </div>

    {/* Exercise Effectiveness — [Metric] */}
    {/* Repeat for other sections */}
  </div>
))}
```

- [ ] **Step 6: Test MultiSessionAnalysisView**

Navigate to History, select multiple sessions, verify:
- Metrics banner shows correct metrics
- No config panel visible
- Insights organized by metric with clear labels
- Changing global settings doesn't affect current view (read-only)

- [ ] **Step 7: Commit**

```bash
git add src/components/MultiSessionAnalysisView.tsx
git commit -m "feat: make multi-session analysis views read-only consumers of global settings"
```

---

## Phase 5: Testing & Verification

### Task 13: Run Full Test Suite

**Files:**
- No new files

- [ ] **Step 1: Run all tests**

```bash
npm run test 2>&1 | tail -50
```

Expected: All tests pass (or minor failures from refactoring that need fixing)

- [ ] **Step 2: Fix any failing tests**

If tests fail, identify and fix:
- Check prop name mismatches (e.g., `metrics` vs `selectedMetrics`)
- Update test mocks to include new props
- Run tests again

- [ ] **Step 3: Run TypeScript compiler**

```bash
npm run build 2>&1 | head -100
```

Expected: No TypeScript errors

- [ ] **Step 4: Commit (if any fixes needed)**

```bash
git add .
git commit -m "test: fix failing tests and TypeScript errors from refactoring"
```

---

### Task 14: Manual Integration Testing

**Files:**
- No new files

- [ ] **Step 1: Test full user flow**

```bash
npm run dev
# Open http://localhost:5173/strabismus-measurement-app/
```

Perform these actions in order:

1. **Settings page:**
   - Navigate to Settings (gear icon in toolbar)
   - Select Deviation + Rotation metrics
   - Change Deviation threshold to 1.5cm
   - Click Save Settings
   - See confirmation message

2. **History with state preservation:**
   - Navigate to History page
   - Apply date range filter
   - Select a few sessions
   - Note the URL includes `?from=...&to=...&sessions=...`
   - Go to Settings
   - Click back (History button in toolbar)
   - Verify filters and selections are preserved

3. **Single session view:**
   - Select one session in History
   - Verify metrics banner shows "Metrics: Deviation (1.5 cm), Rotation (1°)"
   - Verify two TimeSeriesSegmentationGraph sections (one per metric)
   - Verify two Histogram sections (one per metric)
   - Hover over Deviation graph, verify vertical indicator and tooltip

4. **Multi-session view:**
   - Select multiple sessions (3+)
   - Verify metrics banner shows selected metrics
   - Verify no config panel visible
   - Verify sections organized by metric ("Progress — Deviation", "Progress — Rotation")
   - Verify all insights use correct thresholds

5. **Settings change propagation:**
   - Go to Settings
   - Change Rotation threshold to 2°
   - Click Save Settings
   - Go back to History (with multi-session view still active)
   - Verify insights recalculated (streaks, fusion events updated)

- [ ] **Step 2: Document any issues found**

If issues found, create separate tasks to fix:
- Prop mismatches
- Missing data in insights
- UI rendering issues
- Cross-metric hover not working

- [ ] **Step 3: Final verification commit (if no fixes needed)**

```bash
git log --oneline -10
# Verify all commits are in order
```

---

## Task Parallelization Guide

**Can run in parallel (no dependencies):**
- Task 1 (Config)
- Task 2 (GlobalSettings)
- Task 3 (Tests)
- Task 4 (BrowserRouter)

**Depends on Task 2:**
- Task 5 (SettingsPage)
- Task 7 (AnalysisMetricsBanner)

**Depends on Task 4 + Task 6:**
- Task 9 (TimeSeriesGraph refactor)

**Depends on all of Phase 1-2:**
- Task 8 (TimeSeriesSegmentationGraph)

**Depends on all above:**
- Task 10 (App routing)
- Task 11 (SingleSessionView)
- Task 12 (MultiSessionAnalysisView)
- Task 13 (Testing)
- Task 14 (Integration testing)

**Recommended order:** 1,2,3,4 in parallel → 5,6,7 in parallel → 8,9 sequential → 10,11,12 sequential → 13,14 final

---
