import { AnalysisSettings } from '../types/analysis';

export type { AnalysisSettings };

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  goal: {
    thresholds: {
      deviation: 0.5,
      rotation: 1,
    },
    sustainedDays: 7,
  },
};

const STORAGE_KEY = 'strabismus_analysis_settings';

export function getAnalysisSettings(): AnalysisSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_ANALYSIS_SETTINGS;
    const parsed = JSON.parse(stored);
    return {
      goal: {
        thresholds: {
          deviation: parsed.goal?.thresholds?.deviation ?? DEFAULT_ANALYSIS_SETTINGS.goal.thresholds.deviation,
          rotation: parsed.goal?.thresholds?.rotation ?? DEFAULT_ANALYSIS_SETTINGS.goal.thresholds.rotation,
        },
        sustainedDays: parsed.goal?.sustainedDays ?? DEFAULT_ANALYSIS_SETTINGS.goal.sustainedDays,
      },
    };
  } catch (e) {
    console.warn('Failed to parse AnalysisSettings, using defaults', e);
    return DEFAULT_ANALYSIS_SETTINGS;
  }
}

export function setAnalysisSettings(settings: AnalysisSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
