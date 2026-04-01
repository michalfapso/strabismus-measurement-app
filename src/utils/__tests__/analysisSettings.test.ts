import { getAnalysisSettings, setAnalysisSettings, DEFAULT_ANALYSIS_SETTINGS } from '../analysisSettings';

describe('AnalysisSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing stored', () => {
    const settings = getAnalysisSettings();
    expect(settings.goal.thresholds.deviation).toBe(0.5);
    expect(settings.goal.thresholds.rotation).toBe(1);
    expect(settings.goal.sustainedDays).toBe(7);
  });

  it('saves and retrieves custom settings', () => {
    const custom: import('../analysisSettings').AnalysisSettings = {
      goal: {
        thresholds: { deviation: 0.75, rotation: 1.5 },
        sustainedDays: 10,
      },
    };
    setAnalysisSettings(custom);
    const retrieved = getAnalysisSettings();
    expect(retrieved.goal.thresholds.deviation).toBe(0.75);
    expect(retrieved.goal.sustainedDays).toBe(10);
  });

  it('falls back to defaults for missing fields', () => {
    localStorage.setItem('strabismus_analysis_settings', JSON.stringify({ goal: { thresholds: { deviation: 0.6 }, sustainedDays: 14 } }));
    const retrieved = getAnalysisSettings();
    expect(retrieved.goal.thresholds.rotation).toBe(1); // from default
  });
});
