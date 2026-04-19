import { useState } from 'react';
import { css } from '@emotion/react';
import { THEME } from '../theme';
import { GlobalSettings, getGlobalSettings, setGlobalSettings } from '../utils/globalSettings';

const containerStyle = css`
  position: fixed;
  inset: 0;
  background-color: ${THEME.background};
  border: 1px solid ${THEME.borderPrimary};
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
`;

const headerStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const titleStyle = css`
  font-size: 32px;
  font-weight: 600;
  color: ${THEME.textPrimary};
  margin: 0;
`;


const sectionStyle = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const sectionTitleStyle = css`
  font-size: 18px;
  font-weight: 600;
  color: ${THEME.textPrimary};
  margin: 0;
`;

const sectionSubtitleStyle = css`
  font-size: 14px;
  color: #ddd;
  margin: 0;
`;

const metricsGridStyle = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 8px;
`;

const checkboxContainerStyle = css`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid ${THEME.borderPrimary};
  border-radius: 6px;
  background-color: rgba(20, 20, 20, 0.4);
  transition: all 0.2s ease;

  &:hover {
    border-color: ${THEME.borderSecondary};
    background-color: rgba(20, 20, 20, 0.6);
  }
`;

const checkboxInputStyle = css`
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: ${THEME.accentCyan};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const checkboxLabelStyle = css`
  font-size: 14px;
  color: ${THEME.textPrimary};
  cursor: pointer;
  user-select: none;
  flex: 1;
`;

const thresholdsGridStyle = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-top: 8px;
`;

const thresholdInputGroupStyle = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const thresholdLabelStyle = css`
  font-size: 13px;
  color: #ddd;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const thresholdInputStyle = css`
  max-width: 120px;
  padding: 8px 10px;
  font-size: 14px;
  border: 1px solid ${THEME.borderPrimary};
  background: rgba(20, 20, 20, 0.6);
  color: ${THEME.textPrimary};
  border-radius: 4px;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${THEME.accentCyan};
    background: rgba(20, 20, 20, 0.8);
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.2);
  }

  &:hover:not(:focus) {
    border-color: ${THEME.borderSecondary};
  }
`;

const noteStyle = css`
  margin-top: 16px;
  padding: 12px 16px;
  font-size: 13px;
  color: #ddd;
  background-color: rgba(20, 20, 20, 0.4);
  border-left: 2px solid ${THEME.borderPrimary};
  border-radius: 4px;
`;

const metricLabelMap: Record<'deviation' | 'x' | 'y' | 'rotation', string> = {
  deviation: 'Deviation',
  x: 'X Position',
  y: 'Y Position',
  rotation: 'Rotation',
};

const metricUnitMap: Record<'deviation' | 'x' | 'y' | 'rotation', string> = {
  deviation: 'cm',
  x: 'cm',
  y: 'cm',
  rotation: '°',
};

const metricDefaultMap: Record<'deviation' | 'x' | 'y' | 'rotation', number> = {
  deviation: 1.0,
  x: 1.0,
  y: 1.0,
  rotation: 1.0,
};

export function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings>(() => getGlobalSettings());

  const handleMetricToggle = (metric: 'deviation' | 'x' | 'y' | 'rotation') => {
    const isCurrentlySelected = settings.selectedMetrics.includes(metric);
    let newSelectedMetrics: Array<'deviation' | 'x' | 'y' | 'rotation'>;

    if (isCurrentlySelected) {
      // Only allow unchecking if more than one metric is selected
      if (settings.selectedMetrics.length > 1) {
        newSelectedMetrics = settings.selectedMetrics.filter(m => m !== metric);
      } else {
        // Cannot uncheck the last metric
        return;
      }
    } else {
      // Add metric to selection
      newSelectedMetrics = [...settings.selectedMetrics, metric];
    }

    const newSettings: GlobalSettings = {
      selectedMetrics: newSelectedMetrics,
      thresholds: settings.thresholds,
    };

    setSettings(newSettings);
    setGlobalSettings(newSettings);
  };

  const handleThresholdChange = (metric: 'deviation' | 'x' | 'y' | 'rotation', value: string) => {
    const numValue = parseFloat(value);

    // Only update if value is valid and non-negative
    if (!isNaN(numValue) && numValue >= 0.1) {
      const newSettings: GlobalSettings = {
        selectedMetrics: settings.selectedMetrics,
        thresholds: {
          ...settings.thresholds,
          [metric]: numValue,
        },
      };

      setSettings(newSettings);
      setGlobalSettings(newSettings);
    }
  };

  const isMetricDisabled = (metric: 'deviation' | 'x' | 'y' | 'rotation') => {
    // Disable the metric checkbox if it's the only one selected
    return settings.selectedMetrics.length === 1 && settings.selectedMetrics.includes(metric);
  };

  const allMetrics: Array<'deviation' | 'x' | 'y' | 'rotation'> = ['deviation', 'x', 'y', 'rotation'];

  return (
    <div css={containerStyle} data-component="SettingsPage">
      <div css={headerStyle}>
        <h1 css={titleStyle}>Settings</h1>
      </div>

      {/* Metric Selection Section */}
      <section css={sectionStyle}>
        <div>
          <h2 css={sectionTitleStyle}>Metrics to Track</h2>
          <p css={sectionSubtitleStyle}>
            Select which metrics you want to monitor in your analysis views
          </p>
        </div>
        <div css={metricsGridStyle}>
          {allMetrics.map(metric => (
            <label key={metric} htmlFor={`metric-${metric}`} css={checkboxContainerStyle}>
              <input
                id={`metric-${metric}`}
                type="checkbox"
                css={checkboxInputStyle}
                checked={settings.selectedMetrics.includes(metric)}
                onChange={() => handleMetricToggle(metric)}
                disabled={isMetricDisabled(metric)}
              />
              <span css={checkboxLabelStyle}>{metricLabelMap[metric]}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Thresholds Section */}
      <section css={sectionStyle}>
        <div>
          <h2 css={sectionTitleStyle}>Thresholds</h2>
          <p css={sectionSubtitleStyle}>
            Set threshold values for each selected metric to define what counts as "good" performance
          </p>
        </div>
        {settings.selectedMetrics.length > 0 && (
          <div css={thresholdsGridStyle}>
            {settings.selectedMetrics.map(metric => (
              <div key={metric} css={thresholdInputGroupStyle}>
                <label htmlFor={`threshold-${metric}`} css={thresholdLabelStyle}>
                  {metricLabelMap[metric]} ({metricUnitMap[metric]})
                </label>
                <input
                  id={`threshold-${metric}`}
                  type="number"
                  css={thresholdInputStyle}
                  value={settings.thresholds[metric] ?? metricDefaultMap[metric]}
                  onChange={(e) => handleThresholdChange(metric, e.target.value)}
                  min="0.1"
                  step="0.1"
                  placeholder={String(metricDefaultMap[metric])}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Note */}
      <div css={noteStyle}>
        Changes to these settings apply globally to all analysis views. No confirmation needed.
      </div>
    </div>
  );
}
