import { useNavigate } from 'react-router-dom';
import { css } from '@emotion/react';
import { THEME } from '../theme';
import { getGlobalSettings } from '../utils/globalSettings';

interface AnalysisMetricsBannerProps {
  mode: 'single' | 'multi'; // 'single' for single session, 'multi' for multi-session
  metric?: 'deviation' | 'x' | 'y' | 'rotation'; // Only for single mode
}

const bannerStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid ${THEME.borderSecondary};
  border-radius: 4px;
  font-size: 14px;
  color: ${THEME.textSecondary};
  gap: 12px;
  flex-wrap: wrap;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const linkStyle = css`
  color: ${THEME.accentGreen};
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.2s ease;

  &:hover {
    color: ${THEME.accentCyan};
    text-decoration: underline;
  }

  &:active {
    transform: scale(0.98);
  }
`;

const metricLabelMap: Record<'deviation' | 'x' | 'y' | 'rotation', string> = {
  deviation: 'Deviation',
  x: 'X Position',
  y: 'Y Position',
  rotation: 'Rotation',
};

function getUnit(metric: 'deviation' | 'x' | 'y' | 'rotation'): string {
  return metric === 'rotation' ? '°' : 'cm';
}

function formatMetricName(metric: 'deviation' | 'x' | 'y' | 'rotation'): string {
  return metricLabelMap[metric] || metric;
}

export function AnalysisMetricsBanner({ mode, metric }: AnalysisMetricsBannerProps) {
  const navigate = useNavigate();
  const settings = getGlobalSettings();

  if (mode === 'single' && metric) {
    const threshold = settings.thresholds[metric] ?? 1.0;
    const unit = getUnit(metric);
    return (
      <div css={bannerStyle}>
        <span>
          Viewing: <strong>{formatMetricName(metric)}</strong> (threshold {threshold} {unit})
        </span>
        <a
          css={linkStyle}
          onClick={() => navigate('/settings')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              navigate('/settings');
            }
          }}
        >
          Change settings →
        </a>
      </div>
    );
  }

  // Multi-session mode
  const metricsList = settings.selectedMetrics
    .map((m) => {
      const threshold = settings.thresholds[m] ?? 1.0;
      const unit = getUnit(m);
      return `${formatMetricName(m)} (${threshold} ${unit})`;
    })
    .join(', ');

  return (
    <div css={bannerStyle}>
      <span>
        Metrics: <strong>{metricsList}</strong>
      </span>
      <a
        css={linkStyle}
        onClick={() => navigate('/settings')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            navigate('/settings');
          }
        }}
      >
        Change settings →
      </a>
    </div>
  );
}
