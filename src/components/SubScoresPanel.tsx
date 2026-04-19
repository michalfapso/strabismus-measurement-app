import { SessionMetrics } from '../types/analysis';
import { css } from '@emotion/react';
import { THEME } from '../theme';

function getTrajectoryLabel(ratio: number | null): string {
  if (ratio === null) return '—';
  if (ratio > 0.1) return 'Improving';
  if (ratio < -0.1) return 'Declining';
  return 'Stable';
}

interface SubScoresPanelProps {
  metrics: SessionMetrics;
}

export default function SubScoresPanel({ metrics }: SubScoresPanelProps) {
  return (
    <div css={css`
      padding: 16px;
      border: 1px solid ${THEME.borderPrimary};
      border-radius: 4px;
      background-color: ${THEME.panelBg};
    `} data-component="SubScoresPanel">
      <h3 css={css`margin-top: 0; margin-bottom: 12px; color: ${THEME.textPrimary};`}>Session Sub-Scores</h3>
      <table css={css`
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;

        td {
          padding: 8px 0;
          border-bottom: 1px solid ${THEME.borderSecondary};
          color: ${THEME.textSecondary};

          &:first-child {
            font-weight: 500;
            color: ${THEME.textPrimary};
          }
        }

        tr:last-child td {
          border-bottom: none;
        }
      `}>
        <tbody>
          <tr>
            <td>Fusion achieved</td>
            <td>
              {metrics.fusionAchieved
                ? `Yes (${metrics.fusionEventCount} episode${metrics.fusionEventCount !== 1 ? 's' : ''})`
                : 'No'}
            </td>
          </tr>
          {metrics.fusionAchieved && metrics.longestFusionStreak > 0 && (
            <>
              <tr>
                <td>Longest fusion streak</td>
                <td>{metrics.longestFusionStreak.toFixed(1)}s</td>
              </tr>
              {metrics.timeToFirstFusion !== null && (
                <tr>
                  <td>Time to first fusion</td>
                  <td>{metrics.timeToFirstFusion.toFixed(1)}s</td>
                </tr>
              )}
            </>
          )}
          {!metrics.fusionAchieved && metrics.longestQualityStreak > 0 && (
            <tr>
              <td>Longest quality streak</td>
              <td>{metrics.longestQualityStreak.toFixed(1)}s</td>
            </tr>
          )}
          <tr>
            <td>Near-best stable time</td>
            <td>{metrics.nearBestStableTime.toFixed(1)}s</td>
          </tr>
          <tr>
            <td>Best stable {metrics.metric}</td>
            <td>
              {metrics.metric === 'deviation'
                ? `${metrics.bestStableDeviation.toFixed(2)}cm`
                : `${metrics.bestStableDeviation.toFixed(1)}°`}
            </td>
          </tr>
          <tr>
            <td>Large {metrics.metric} time</td>
            <td>{metrics.largeDeviationTimePercent.toFixed(1)}%</td>
          </tr>
          <tr>
            <td>Session trajectory</td>
            <td>{getTrajectoryLabel(metrics.trajectoryRatio)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
