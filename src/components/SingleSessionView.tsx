import { SessionMetrics } from '../types/analysis';
import SubScoresPanel from './SubScoresPanel';
import { HistogramChart } from './HistogramChart';
import { TimeSeriesSegmentationGraph } from './TimeSeriesSegmentationGraph';
import { AnalysisMetricsBanner } from './AnalysisMetricsBanner';
import { Session } from '../types';
import { css } from '@emotion/react';
import { THEME } from '../theme';
import { getGlobalSettings } from '../utils/globalSettings';
import { computeSessionMetrics } from '../utils/sessionMetrics';
import { useMemo } from 'react';

interface SingleSessionViewProps {
  session: Session;
  onBack?: () => void;
}

const getPrimaryMetric = (settings: ReturnType<typeof getGlobalSettings>): 'deviation' | 'rotation' => {
  return (settings.selectedMetrics.find(
    m => m === 'deviation' || m === 'rotation'
  ) ?? 'deviation') as 'deviation' | 'rotation';
};

const sectionTitleStyle = css`
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: ${THEME.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const sectionCardStyle = css`
  border: 1px solid ${THEME.borderPrimary};
  border-radius: 4px;
  padding: 12px;
  background-color: ${THEME.panelBg};
`;

export default function SingleSessionView({ session, onBack }: SingleSessionViewProps) {
  const settings = getGlobalSettings();
  const { selectedMetrics, thresholds } = settings;

  const metrics = useMemo(() => {
    try {
      const freshSettings = getGlobalSettings();
      const primaryMetric = getPrimaryMetric(freshSettings);
      const thresholds = {
        deviation: freshSettings.thresholds.deviation ?? 1.0,
        rotation: freshSettings.thresholds.rotation ?? 1.0,
      };
      return computeSessionMetrics(session, thresholds, primaryMetric);
    } catch (error) {
      console.error('Failed to compute session metrics:', error);
      return null;
    }
  }, [session]);

  if (metrics === null) {
    return (
      <div css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
        color: ${THEME.textSecondary};
        padding: 16px;
        text-align: center;
      `}>
        Unable to compute metrics (session may be too short)
      </div>
    );
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    `}>
      {/* Back Button */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '4px',
            padding: '8px 12px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            marginBottom: '12px',
          }}
        >
          ← Back to Analysis
        </button>
      )}

      {/* Header */}
      <div css={css`
        padding-bottom: 12px;
        border-bottom: 2px solid ${THEME.borderPrimary};
      `}>
        <h2 css={css`margin: 0; font-size: 18px; color: ${THEME.textPrimary};`}>
          {metrics.date} — {metrics.exerciseTag}
        </h2>
        <p css={css`margin: 4px 0 0 0; color: ${THEME.textSecondary}; font-size: 13px;`}>
          Duration: {metrics.sessionDuration.toFixed(0)} seconds
        </p>
      </div>

      {/* Metric Settings Banner */}
      <AnalysisMetricsBanner
        mode={selectedMetrics.length === 1 ? 'single' : 'multi'}
        metric={selectedMetrics.length === 1 ? getPrimaryMetric(settings) : undefined}
      />

      {/* Sub-scores */}
      <SubScoresPanel metrics={metrics} />

      {/* Time Series + Segmentation Stack — one graph per selected metric */}
      <div css={sectionCardStyle}>
        <h3 css={css`margin-top: 0; margin-bottom: 12px; color: ${THEME.textPrimary};`}>
          Time Series &amp; Segmentation
        </h3>
        <div css={css`display: flex; flex-direction: column; gap: 24px;`}>
          {selectedMetrics.map((metric) => (
            <div key={metric}>
              <p css={sectionTitleStyle}>{metricLabel(metric)}</p>
              <TimeSeriesSegmentationGraph
                session={session}
                metrics={[metric]}
                thresholds={thresholds}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Histogram Stack — one histogram per selected metric */}
      <div css={sectionCardStyle}>
        <h3 css={css`margin-top: 0; margin-bottom: 12px; color: ${THEME.textPrimary};`}>
          Distribution
        </h3>
        <div css={css`display: flex; flex-direction: column; gap: 16px;`}>
          {selectedMetrics.map((metric) => (
            <div key={metric}>
              <p css={sectionTitleStyle}>{metricLabel(metric)}</p>
              <HistogramChart
                sessions={[session]}
                isSingleSession={true}
                metric={metric}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function metricLabel(metric: 'deviation' | 'x' | 'y' | 'rotation'): string {
  switch (metric) {
    case 'deviation': return 'Deviation';
    case 'x': return 'X Position';
    case 'y': return 'Y Position';
    case 'rotation': return 'Rotation';
  }
}
