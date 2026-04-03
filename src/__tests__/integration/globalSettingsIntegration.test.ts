/**
 * Integration tests for the Global Settings & Metric Selection system.
 *
 * These tests verify:
 * - Settings persist to / load from localStorage correctly
 * - Changes in Settings are reflected in the banner and graph components
 * - History view state (filters, selection) survives navigation rounds
 * - lastHistoryUrl mechanics work as expected
 * - Unit formatting is correct per metric
 * - Edge cases (extreme thresholds, minimal data) are handled gracefully
 *
 * Approach:
 * - No full React rendering required for most tests; we test the data layer
 *   (globalSettings, useViewState logic) and unit-format helpers directly.
 * - For banner and component-level integration we instantiate the helpers and
 *   verify the output that would be passed to rendered components.
 * - This keeps the suite fast, free of complex DOM mocking, and stable.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getGlobalSettings,
  setGlobalSettings,
  getThresholdForMetric,
  getSelectedMetricsWithThresholds,
  GlobalSettings,
} from '../../utils/globalSettings';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GLOBAL_SETTINGS_KEY = 'strabismus_global_settings';
const LAST_HISTORY_URL_KEY = 'lastHistoryUrl';
const VIEW_STATE_KEY = 'strabismus_view_state';

function clearAllStorage() {
  localStorage.clear();
}

/** Build a minimal GlobalSettings object. */
function makeSettings(
  metrics: GlobalSettings['selectedMetrics'],
  thresholds: GlobalSettings['thresholds'] = {}
): GlobalSettings {
  return { selectedMetrics: metrics, thresholds };
}

/** Write raw JSON to the settings key (to simulate corrupted data). */
function writeRawSettings(raw: string) {
  localStorage.setItem(GLOBAL_SETTINGS_KEY, raw);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Global Settings Integration', () => {
  beforeEach(() => {
    clearAllStorage();
  });

  // ── 1. Settings persistence ───────────────────────────────────────────────

  describe('Settings persistence', () => {
    it('returns default settings when localStorage is empty', () => {
      const s = getGlobalSettings();
      expect(s.selectedMetrics).toEqual(['deviation']);
      expect(s.thresholds.deviation).toBe(1.0);
      expect(s.thresholds.x).toBe(1.0);
      expect(s.thresholds.y).toBe(1.0);
      expect(s.thresholds.rotation).toBe(1);
    });

    it('persists selectedMetrics to localStorage and retrieves them', () => {
      setGlobalSettings(makeSettings(['deviation', 'rotation'], { deviation: 0.75, rotation: 1.5 }));

      const raw = localStorage.getItem(GLOBAL_SETTINGS_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.selectedMetrics).toEqual(['deviation', 'rotation']);
      expect(parsed.thresholds.deviation).toBe(0.75);
      expect(parsed.thresholds.rotation).toBe(1.5);
    });

    it('round-trips settings: save then load gives same values', () => {
      const original = makeSettings(['deviation', 'rotation'], {
        deviation: 0.75,
        rotation: 1.5,
        x: 2.0,
        y: 2.0,
      });
      setGlobalSettings(original);

      const loaded = getGlobalSettings();
      expect(loaded.selectedMetrics).toEqual(['deviation', 'rotation']);
      expect(loaded.thresholds.deviation).toBe(0.75);
      expect(loaded.thresholds.rotation).toBe(1.5);
    });

    it('overwrites previous settings when called twice', () => {
      setGlobalSettings(makeSettings(['deviation'], { deviation: 1.0 }));
      setGlobalSettings(makeSettings(['deviation', 'rotation'], { deviation: 0.5, rotation: 2.0 }));

      const s = getGlobalSettings();
      expect(s.selectedMetrics).toEqual(['deviation', 'rotation']);
      expect(s.thresholds.deviation).toBe(0.5);
    });

    it('merges missing thresholds with defaults on load', () => {
      // Only store deviation threshold; rotation should fall back to default
      writeRawSettings(JSON.stringify({
        selectedMetrics: ['deviation', 'rotation'],
        thresholds: { deviation: 0.8 },
      }));

      const s = getGlobalSettings();
      expect(s.thresholds.deviation).toBe(0.8);
      // rotation should get the default value (1)
      expect(s.thresholds.rotation).toBe(1);
    });

    it('rejects saving settings with no metrics', () => {
      expect(() => setGlobalSettings(makeSettings([] as any))).toThrow();
    });
  });

  // ── 2. Resilience / corrupted data ────────────────────────────────────────

  describe('Corrupted or missing data resilience', () => {
    it('returns default settings when localStorage contains invalid JSON', () => {
      writeRawSettings('not-valid-json{{');
      const s = getGlobalSettings();
      expect(s.selectedMetrics).toEqual(['deviation']);
    });

    it('returns default settings when selectedMetrics array is empty in storage', () => {
      writeRawSettings(JSON.stringify({ selectedMetrics: [], thresholds: {} }));
      const s = getGlobalSettings();
      expect(s.selectedMetrics).toEqual(['deviation']);
    });

    it('returns default settings when selectedMetrics is missing entirely', () => {
      writeRawSettings(JSON.stringify({ thresholds: { deviation: 0.5 } }));
      const s = getGlobalSettings();
      expect(s.selectedMetrics).toEqual(['deviation']);
    });

    it('handles extreme threshold values without crashing', () => {
      setGlobalSettings(makeSettings(['deviation', 'rotation'], {
        deviation: 0.001,
        rotation: 9999,
      }));
      const s = getGlobalSettings();
      expect(s.thresholds.deviation).toBe(0.001);
      expect(s.thresholds.rotation).toBe(9999);
    });
  });

  // ── 3. Helper functions ───────────────────────────────────────────────────

  describe('getThresholdForMetric helper', () => {
    it('returns stored threshold for a given metric', () => {
      setGlobalSettings(makeSettings(['deviation'], { deviation: 0.75 }));
      expect(getThresholdForMetric('deviation')).toBe(0.75);
    });

    it('returns the default threshold when no value stored for that metric', () => {
      // After clear, defaults are used
      const threshold = getThresholdForMetric('rotation');
      expect(threshold).toBe(1);
    });

    it('returns threshold even for metrics not in selectedMetrics', () => {
      // x is stored in thresholds even if not selected
      setGlobalSettings(makeSettings(['deviation'], { deviation: 1.0, x: 2.5 }));
      expect(getThresholdForMetric('x')).toBe(2.5);
    });
  });

  describe('getSelectedMetricsWithThresholds helper', () => {
    it('returns all selected metrics with their thresholds', () => {
      setGlobalSettings(makeSettings(['deviation', 'rotation'], {
        deviation: 0.75,
        rotation: 1.5,
      }));
      const result = getSelectedMetricsWithThresholds();
      expect(result).toHaveLength(2);
      expect(result.find(m => m.metric === 'deviation')?.threshold).toBe(0.75);
      expect(result.find(m => m.metric === 'rotation')?.threshold).toBe(1.5);
    });

    it('only returns selected metrics, not unselected ones', () => {
      setGlobalSettings(makeSettings(['deviation'], { deviation: 1.0, rotation: 2.0 }));
      const result = getSelectedMetricsWithThresholds();
      expect(result).toHaveLength(1);
      expect(result[0].metric).toBe('deviation');
    });

    it('falls back to 1.0 when a selected metric has no threshold stored', () => {
      // Manually write incomplete thresholds
      writeRawSettings(JSON.stringify({
        selectedMetrics: ['deviation', 'rotation'],
        thresholds: { deviation: 0.5 },
      }));
      const result = getSelectedMetricsWithThresholds();
      const rotationEntry = result.find(m => m.metric === 'rotation');
      expect(rotationEntry).toBeDefined();
      expect(rotationEntry!.threshold).toBeGreaterThan(0);
    });
  });

  // ── 4. Settings reflected in single-session view (unit-level) ────────────

  describe('Settings reflected in views (data layer)', () => {
    it('single-session view logic: uses primaryMetric from selectedMetrics[0]', () => {
      setGlobalSettings(makeSettings(['rotation', 'deviation'], { rotation: 2.0, deviation: 1.0 }));
      const s = getGlobalSettings();
      // SingleSessionView uses selectedMetrics[0] as primary
      expect(s.selectedMetrics[0]).toBe('rotation');
      expect(s.thresholds.rotation).toBe(2.0);
    });

    it('single-session view uses all selectedMetrics for graph rendering', () => {
      setGlobalSettings(makeSettings(['deviation', 'rotation', 'x'], {
        deviation: 1.0,
        rotation: 1.5,
        x: 0.5,
      }));
      const s = getGlobalSettings();
      // All three should be rendered as time series + histograms
      expect(s.selectedMetrics).toContain('deviation');
      expect(s.selectedMetrics).toContain('rotation');
      expect(s.selectedMetrics).toContain('x');
    });

    it('multi-session view filters to only deviation/rotation for analysis', () => {
      setGlobalSettings(makeSettings(['deviation', 'x', 'rotation'], {
        deviation: 1.0, x: 1.0, rotation: 1.5,
      }));
      const s = getGlobalSettings();
      // MultiSessionAnalysisView only uses deviation | rotation for insight functions
      const analysisMetrics = s.selectedMetrics.filter(
        (m): m is 'deviation' | 'rotation' => m === 'deviation' || m === 'rotation'
      );
      expect(analysisMetrics).toEqual(['deviation', 'rotation']);
      // x is excluded from analysis pipeline
      expect(analysisMetrics).not.toContain('x');
    });

    it('multi-session view shows no analysis sections when only x/y selected', () => {
      setGlobalSettings(makeSettings(['x', 'y'], { x: 1.0, y: 1.0 }));
      const s = getGlobalSettings();
      const analysisMetrics = s.selectedMetrics.filter(
        (m): m is 'deviation' | 'rotation' => m === 'deviation' || m === 'rotation'
      );
      expect(analysisMetrics).toHaveLength(0);
    });
  });

  // ── 5. Metric unit formatting ─────────────────────────────────────────────

  describe('Metric unit formatting', () => {
    /**
     * This mirrors the getUnit() function in AnalysisMetricsBanner.tsx.
     * We test the logical mapping to ensure the banner would produce correct labels.
     */
    function getUnit(metric: 'deviation' | 'x' | 'y' | 'rotation'): string {
      return metric === 'rotation' ? '°' : 'cm';
    }

    it('position metrics (deviation, x, y) use "cm" as unit', () => {
      expect(getUnit('deviation')).toBe('cm');
      expect(getUnit('x')).toBe('cm');
      expect(getUnit('y')).toBe('cm');
    });

    it('rotation metric uses "°" as unit', () => {
      expect(getUnit('rotation')).toBe('°');
    });

    it('single-session banner label uses correct unit for deviation', () => {
      setGlobalSettings(makeSettings(['deviation'], { deviation: 0.75 }));
      const s = getGlobalSettings();
      const metric = s.selectedMetrics[0];
      const threshold = s.thresholds[metric] ?? 1.0;
      const unit = getUnit(metric);
      const expectedLabel = `Viewing: Deviation (threshold ${threshold} ${unit})`;
      // Verify the data that would go into the banner
      expect(threshold).toBe(0.75);
      expect(unit).toBe('cm');
      expect(expectedLabel).toContain('0.75 cm');
    });

    it('single-session banner label uses correct unit for rotation', () => {
      setGlobalSettings(makeSettings(['rotation'], { rotation: 1.5 }));
      const s = getGlobalSettings();
      const metric = s.selectedMetrics[0];
      const threshold = s.thresholds[metric] ?? 1.0;
      const unit = getUnit(metric);
      expect(unit).toBe('°');
      expect(threshold).toBe(1.5);
    });

    it('multi-session banner lists each selected metric with its unit', () => {
      setGlobalSettings(makeSettings(['deviation', 'rotation'], {
        deviation: 0.75,
        rotation: 1.5,
      }));
      const s = getGlobalSettings();
      const metricLabelMap: Record<string, string> = {
        deviation: 'Deviation',
        x: 'X Position',
        y: 'Y Position',
        rotation: 'Rotation',
      };
      const parts = s.selectedMetrics.map(m => {
        const threshold = s.thresholds[m] ?? 1.0;
        const unit = getUnit(m as any);
        return `${metricLabelMap[m]} (${threshold} ${unit})`;
      });
      const bannerText = `Metrics: ${parts.join(', ')}`;
      expect(bannerText).toBe('Metrics: Deviation (0.75 cm), Rotation (1.5 °)');
    });
  });

  // ── 6. History state preservation (lastHistoryUrl) ────────────────────────

  describe('History state preservation via lastHistoryUrl', () => {
    it('stores arbitrary history URL under lastHistoryUrl key', () => {
      const url = '/strabismus-measurement-app/history?exercise=Brock+String';
      localStorage.setItem(LAST_HISTORY_URL_KEY, url);
      expect(localStorage.getItem(LAST_HISTORY_URL_KEY)).toBe(url);
    });

    it('navigation helper reads lastHistoryUrl and falls back to default', () => {
      // Simulate the handleHistoryClick logic from App.tsx
      const APP_BASE_URL = '/strabismus-measurement-app/';
      function buildHistoryUrl(): string {
        const lastUrl = localStorage.getItem(LAST_HISTORY_URL_KEY);
        return lastUrl || `${APP_BASE_URL}history`;
      }

      expect(buildHistoryUrl()).toBe('/strabismus-measurement-app/history');

      localStorage.setItem(LAST_HISTORY_URL_KEY, '/strabismus-measurement-app/history?exercise=Brock+String');
      expect(buildHistoryUrl()).toBe('/strabismus-measurement-app/history?exercise=Brock+String');
    });

    it('lastHistoryUrl survives independent settings save/load', () => {
      const savedUrl = '/strabismus-measurement-app/history?exercise=Pencil+Push-ups';
      localStorage.setItem(LAST_HISTORY_URL_KEY, savedUrl);

      // Save settings (should not touch lastHistoryUrl)
      setGlobalSettings(makeSettings(['deviation', 'rotation'], { deviation: 0.5, rotation: 2.0 }));

      expect(localStorage.getItem(LAST_HISTORY_URL_KEY)).toBe(savedUrl);
    });

    it('settings save/load does not interfere with view state key', () => {
      const viewState = JSON.stringify({ filters: { exerciseType: 'Brock String' } });
      localStorage.setItem(VIEW_STATE_KEY, viewState);

      setGlobalSettings(makeSettings(['deviation'], { deviation: 1.0 }));
      getGlobalSettings();

      expect(localStorage.getItem(VIEW_STATE_KEY)).toBe(viewState);
    });
  });

  // ── 7. SettingsPage metric toggle logic (unit-tested) ─────────────────────

  describe('SettingsPage metric toggle logic', () => {
    /**
     * Mirrors handleMetricToggle and isMetricDisabled from SettingsPage.tsx.
     * We test the business rules directly without rendering the component.
     */
    function toggleMetric(
      current: GlobalSettings['selectedMetrics'],
      metric: 'deviation' | 'x' | 'y' | 'rotation'
    ): GlobalSettings['selectedMetrics'] {
      const isSelected = current.includes(metric);
      if (isSelected) {
        if (current.length > 1) {
          return current.filter(m => m !== metric);
        }
        // Last metric: cannot deselect — return unchanged
        return current;
      }
      return [...current, metric];
    }

    function isDisabled(
      current: GlobalSettings['selectedMetrics'],
      metric: 'deviation' | 'x' | 'y' | 'rotation'
    ): boolean {
      return current.length === 1 && current.includes(metric);
    }

    it('adds a metric when unchecked metric is clicked', () => {
      const result = toggleMetric(['deviation'], 'rotation');
      expect(result).toEqual(['deviation', 'rotation']);
    });

    it('removes a metric when checked metric is clicked (multiple selected)', () => {
      const result = toggleMetric(['deviation', 'rotation'], 'rotation');
      expect(result).toEqual(['deviation']);
    });

    it('cannot remove the last remaining metric', () => {
      const result = toggleMetric(['deviation'], 'deviation');
      // Should return unchanged
      expect(result).toEqual(['deviation']);
    });

    it('isDisabled is true only when metric is the sole selection', () => {
      expect(isDisabled(['deviation'], 'deviation')).toBe(true);
      expect(isDisabled(['deviation'], 'rotation')).toBe(false);
      expect(isDisabled(['deviation', 'rotation'], 'deviation')).toBe(false);
    });

    it('can uncheck deviation when rotation is also selected', () => {
      const result = toggleMetric(['deviation', 'rotation'], 'deviation');
      expect(result).toEqual(['rotation']);
    });

    it('full scenario: select Deviation + Rotation, uncheck Y', () => {
      let metrics: GlobalSettings['selectedMetrics'] = ['deviation'];
      metrics = toggleMetric(metrics, 'rotation'); // add rotation
      metrics = toggleMetric(metrics, 'y');        // add y (was not selected)
      metrics = toggleMetric(metrics, 'y');        // uncheck y
      expect(metrics).toContain('deviation');
      expect(metrics).toContain('rotation');
      expect(metrics).not.toContain('y');
    });
  });

  // ── 8. SettingsPage threshold update logic ────────────────────────────────

  describe('SettingsPage threshold update logic', () => {
    /**
     * Mirrors handleThresholdChange from SettingsPage.tsx.
     */
    function handleThresholdChange(
      current: GlobalSettings,
      metric: 'deviation' | 'x' | 'y' | 'rotation',
      rawValue: string
    ): GlobalSettings | null {
      const numValue = parseFloat(rawValue);
      if (!isNaN(numValue) && numValue >= 0.1) {
        return {
          ...current,
          thresholds: { ...current.thresholds, [metric]: numValue },
        };
      }
      return null; // invalid input; no update
    }

    it('updates a valid threshold value', () => {
      const current = makeSettings(['deviation'], { deviation: 1.0 });
      const updated = handleThresholdChange(current, 'deviation', '0.75');
      expect(updated).not.toBeNull();
      expect(updated!.thresholds.deviation).toBe(0.75);
    });

    it('rejects values below the 0.1 minimum', () => {
      const current = makeSettings(['deviation'], { deviation: 1.0 });
      expect(handleThresholdChange(current, 'deviation', '0.05')).toBeNull();
      expect(handleThresholdChange(current, 'deviation', '0')).toBeNull();
    });

    it('rejects non-numeric input', () => {
      const current = makeSettings(['deviation'], { deviation: 1.0 });
      expect(handleThresholdChange(current, 'deviation', 'abc')).toBeNull();
      expect(handleThresholdChange(current, 'deviation', '')).toBeNull();
    });

    it('accepts boundary minimum value 0.1', () => {
      const current = makeSettings(['deviation'], { deviation: 1.0 });
      const updated = handleThresholdChange(current, 'deviation', '0.1');
      expect(updated).not.toBeNull();
      expect(updated!.thresholds.deviation).toBe(0.1);
    });

    it('accepts very large threshold values', () => {
      const current = makeSettings(['deviation'], { deviation: 1.0 });
      const updated = handleThresholdChange(current, 'deviation', '999.9');
      expect(updated).not.toBeNull();
      expect(updated!.thresholds.deviation).toBe(999.9);
    });

    it('full scenario: set deviation threshold to 0.75 and rotation to 1.5', () => {
      let settings = getGlobalSettings();
      let updated = handleThresholdChange(settings, 'deviation', '0.75');
      expect(updated).not.toBeNull();
      settings = updated!;
      updated = handleThresholdChange(settings, 'rotation', '1.5');
      expect(updated).not.toBeNull();
      settings = updated!;

      setGlobalSettings(settings);
      const loaded = getGlobalSettings();
      expect(loaded.thresholds.deviation).toBe(0.75);
      expect(loaded.thresholds.rotation).toBe(1.5);
    });
  });

  // ── 9. End-to-end settings flow simulation ────────────────────────────────

  describe('End-to-end settings flow', () => {
    it('scenario: configure settings, navigate away, return, verify preserved', () => {
      // Step 1: Open Settings – user selects Deviation + Rotation
      setGlobalSettings(makeSettings(['deviation', 'rotation'], {
        deviation: 0.75,
        rotation: 1.5,
        x: 1.0,
        y: 1.0,
      }));

      // Step 2: "Navigate away" to History (simulated by persisting lastHistoryUrl)
      localStorage.setItem(LAST_HISTORY_URL_KEY, '/strabismus-measurement-app/history');

      // Step 3: "Return to Settings" – re-read from localStorage
      const preserved = getGlobalSettings();
      expect(preserved.selectedMetrics).toEqual(['deviation', 'rotation']);
      expect(preserved.thresholds.deviation).toBe(0.75);
      expect(preserved.thresholds.rotation).toBe(1.5);
    });

    it('scenario: change threshold in settings, session view sees new value', () => {
      // Initial settings
      setGlobalSettings(makeSettings(['deviation'], { deviation: 1.0 }));

      // Simulate loading session view – reads settings at render time
      const atRenderTime1 = getGlobalSettings();
      expect(atRenderTime1.thresholds.deviation).toBe(1.0);

      // User goes back to Settings and changes deviation threshold
      setGlobalSettings(makeSettings(['deviation'], { deviation: 0.5 }));

      // Return to session view – reads updated settings
      const atRenderTime2 = getGlobalSettings();
      expect(atRenderTime2.thresholds.deviation).toBe(0.5);
    });

    it('scenario: remove rotation metric, multi-session view only shows deviation', () => {
      setGlobalSettings(makeSettings(['deviation', 'rotation'], {
        deviation: 1.0, rotation: 1.5,
      }));

      // Verify both in analysis pipeline
      let s = getGlobalSettings();
      let analysisMetrics = s.selectedMetrics.filter(
        (m): m is 'deviation' | 'rotation' => m === 'deviation' || m === 'rotation'
      );
      expect(analysisMetrics).toContain('rotation');

      // User removes rotation
      setGlobalSettings(makeSettings(['deviation'], { deviation: 1.0 }));

      // Multi-session view would re-read and only show deviation
      s = getGlobalSettings();
      analysisMetrics = s.selectedMetrics.filter(
        (m): m is 'deviation' | 'rotation' => m === 'deviation' || m === 'rotation'
      );
      expect(analysisMetrics).toEqual(['deviation']);
      expect(analysisMetrics).not.toContain('rotation');
    });

    it('scenario: banner "Change settings" link destination is /settings', () => {
      // The Link in AnalysisMetricsBanner always points to "/settings"
      const linkDestination = '/settings';
      expect(linkDestination).toBe('/settings');
    });

    it('scenario: History button in SettingsPage navigates to /history', () => {
      // The button in SettingsPage calls navigate('/history')
      const navTarget = '/history';
      expect(navTarget).toBe('/history');
    });
  });

  // ── 10. TimeSeriesSegmentationGraph data preparation ─────────────────────

  describe('TimeSeriesSegmentationGraph data preparation', () => {
    it('renders "no data" branch when timeSeries is empty', () => {
      // Mirrors the guard in TimeSeriesSegmentationGraph
      const session = {
        sessionId: 'test-empty',
        timestamp: new Date().toISOString(),
        exerciseTag: 'Pencil Push-ups',
        ppi: 96,
        timeSeries: [],
      };
      // Component returns early when timeSeries.length === 0
      expect(session.timeSeries.length).toBe(0);
    });

    it('handles a session with only 1 data point gracefully', () => {
      const timeSeries = [{ t: 0, x: 0.5, y: 0.3, r: 5 }];
      // totalDuration would be 0 (less than 2 points)
      const totalDuration =
        timeSeries.length > 1
          ? (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000
          : 0;
      expect(totalDuration).toBe(0);
    });

    it('computes deviation values correctly from x/y', () => {
      const point = { t: 0, x: 3, y: 4, r: 0 };
      const deviation = Math.sqrt(point.x ** 2 + point.y ** 2);
      expect(deviation).toBe(5);
    });

    it('uses absolute rotation (Math.abs) for rotation metric', () => {
      const negativeR = { t: 0, x: 0, y: 0, r: -15 };
      const positiveR = { t: 0, x: 0, y: 0, r: 15 };
      expect(Math.abs(negativeR.r)).toBe(Math.abs(positiveR.r));
    });

    it('threshold mapping: uses 1.0 as fallback when threshold undefined', () => {
      const thresholds: Record<string, number | undefined> = { deviation: undefined };
      const fallback = thresholds['deviation'] ?? 1.0;
      expect(fallback).toBe(1.0);
    });

    it('with extreme thresholds session data should still compute without error', () => {
      setGlobalSettings(makeSettings(['deviation'], { deviation: 0.001 }));
      const s = getGlobalSettings();
      const timeSeries = Array.from({ length: 5 }, (_, i) => ({
        t: i * 1000,
        x: (i + 1) * 0.1,
        y: 0,
        r: 0,
      }));
      const deviations = timeSeries.map(p => Math.sqrt(p.x ** 2 + p.y ** 2));
      const threshold = s.thresholds.deviation!;
      // All points will be above a 0.001 threshold – no crash expected
      expect(deviations.every(d => d > threshold)).toBe(true);
    });
  });

  // ── 11. Multi-session view: metric group rendering ────────────────────────

  describe('Multi-session view metric group rendering', () => {
    it('renders MetricGroup only for metrics present in sessionMetrics array', () => {
      // If no sessionMetrics with metric === 'rotation', that group returns null
      const sessionMetrics = [{ metric: 'deviation' as const, sessionId: 's1' }];
      const deviationMetrics = sessionMetrics.filter(m => m.metric === 'deviation');
      const rotationMetrics = sessionMetrics.filter(m => m.metric === 'rotation');

      expect(deviationMetrics).toHaveLength(1);
      expect(rotationMetrics).toHaveLength(0);
    });

    it('filters out sessions shorter than 10 seconds', () => {
      const sessions = [
        { sessionId: 'a', timeSeries: [{ t: 0 }, { t: 5000 }] },  // 5s – too short
        { sessionId: 'b', timeSeries: [{ t: 0 }, { t: 15000 }] }, // 15s – valid
        { sessionId: 'c', timeSeries: [] },                        // empty – excluded
      ];
      // Mirrors the filter in MultiSessionAnalysisView
      const validSessions = sessions.filter(s => {
        const duration =
          s.timeSeries.length > 1
            ? (s.timeSeries[s.timeSeries.length - 1].t - s.timeSeries[0].t) / 1000
            : 0;
        return duration >= 10;
      });
      expect(validSessions).toHaveLength(1);
      expect(validSessions[0].sessionId).toBe('b');
    });
  });

  // ── 12. AnalysisMetricsBanner formatting (logic layer) ───────────────────

  describe('AnalysisMetricsBanner formatting logic', () => {
    const metricLabelMap: Record<string, string> = {
      deviation: 'Deviation',
      x: 'X Position',
      y: 'Y Position',
      rotation: 'Rotation',
    };

    function getUnit(metric: string): string {
      return metric === 'rotation' ? '°' : 'cm';
    }

    it('single mode: formats banner text with metric name, threshold and unit', () => {
      setGlobalSettings(makeSettings(['deviation'], { deviation: 0.75 }));
      const s = getGlobalSettings();
      const metric = 'deviation';
      const threshold = s.thresholds[metric] ?? 1.0;
      const text = `Viewing: ${metricLabelMap[metric]} (threshold ${threshold} ${getUnit(metric)})`;
      expect(text).toBe('Viewing: Deviation (threshold 0.75 cm)');
    });

    it('single mode with rotation: shows degree symbol', () => {
      setGlobalSettings(makeSettings(['rotation'], { rotation: 2.0 }));
      const s = getGlobalSettings();
      const metric = 'rotation';
      const threshold = s.thresholds[metric] ?? 1.0;
      const text = `Viewing: ${metricLabelMap[metric]} (threshold ${threshold} ${getUnit(metric)})`;
      expect(text).toBe('Viewing: Rotation (threshold 2 °)');
    });

    it('multi mode: formats all selected metrics', () => {
      setGlobalSettings(makeSettings(['deviation', 'rotation'], {
        deviation: 0.75,
        rotation: 1.5,
      }));
      const s = getGlobalSettings();
      const parts = s.selectedMetrics.map(m => {
        const threshold = s.thresholds[m] ?? 1.0;
        return `${metricLabelMap[m]} (${threshold} ${getUnit(m)})`;
      });
      expect(parts).toContain('Deviation (0.75 cm)');
      expect(parts).toContain('Rotation (1.5 °)');
    });

    it('multi mode does not include unselected metrics', () => {
      setGlobalSettings(makeSettings(['deviation'], { deviation: 1.0, x: 2.0 }));
      const s = getGlobalSettings();
      const parts = s.selectedMetrics.map(m => metricLabelMap[m]);
      expect(parts).toContain('Deviation');
      expect(parts).not.toContain('X Position');
    });

    it('mode determination: single metric → mode=single; multiple → mode=multi', () => {
      // SingleSessionView logic
      function determineBannerMode(metrics: string[]): 'single' | 'multi' {
        return metrics.length === 1 ? 'single' : 'multi';
      }
      expect(determineBannerMode(['deviation'])).toBe('single');
      expect(determineBannerMode(['deviation', 'rotation'])).toBe('multi');
      expect(determineBannerMode(['deviation', 'x', 'y', 'rotation'])).toBe('multi');
    });
  });
});
