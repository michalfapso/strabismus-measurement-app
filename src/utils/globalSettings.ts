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
