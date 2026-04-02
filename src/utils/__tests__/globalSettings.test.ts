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
      expect(settings.thresholds.x).toBe(1.0);
      expect(settings.thresholds.y).toBe(1.0);
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
      expect(settings.thresholds.y).toBe(1.0); // Merged with default
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

    it('returns threshold for unselected metric (from defaults)', () => {
      setGlobalSettings({
        selectedMetrics: ['deviation'],
        thresholds: { deviation: 1.0 },
      });
      // Rotation threshold is still available from defaults, even if not selected
      expect(getThresholdForMetric('rotation')).toBe(1);
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
