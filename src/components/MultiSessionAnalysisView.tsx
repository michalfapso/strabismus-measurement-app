import { Session } from '../types';
import { SessionMetrics } from '../types/analysis';
import { computeSessionMetrics } from '../utils/sessionMetrics';
import { calculateProgressInsight, calculateExerciseInsights, calculateSessionQualityInsight, calculateMilestoneInsight, calculateRecommendationInsight } from '../utils/analysisInsights';
import { css } from '@emotion/react';
import { useState } from 'react';

interface AnalysisConfig {
  metrics: ('deviation' | 'rotation')[];
  thresholds: { deviation: number; rotation: number };
  sustainedDays: number;
}

interface MultiSessionAnalysisViewProps {
  sessions: Session[];
  config: AnalysisConfig;
  onConfigChange: (config: AnalysisConfig) => void;
}

export default function MultiSessionAnalysisView({
  sessions,
  config,
  onConfigChange,
}: MultiSessionAnalysisViewProps) {
  // Compute session metrics for all sessions
  const sessionMetrics = sessions
    .filter(s => {
      const duration = s.timeSeries.length > 1 ? (s.timeSeries[s.timeSeries.length - 1].t - s.timeSeries[0].t) / 1000 : 0;
      return duration >= 10;
    })
    .flatMap(session =>
      config.metrics.map(metric => {
        try {
          return computeSessionMetrics(session, config.thresholds, metric);
        } catch {
          return null;
        }
      })
    )
    .filter((m): m is SessionMetrics => m !== null);

  if (sessionMetrics.length === 0) {
    return (
      <div css={css`padding: 16px; color: #999;`}>
        No valid sessions for analysis (minimum 10 seconds each).
      </div>
    );
  }

  // Calculate insights
  const progressInsights = config.metrics.map(metric =>
    calculateProgressInsight(
      sessionMetrics.filter(m => m.metric === metric),
      config.thresholds
    )
  );

  const exerciseInsights = calculateExerciseInsights(sessionMetrics);
  const qualityInsights = config.metrics.map(metric =>
    calculateSessionQualityInsight(sessionMetrics.filter(m => m.metric === metric))
  );
  const milestoneInsights = config.metrics.map(metric =>
    calculateMilestoneInsight(
      sessionMetrics.filter(m => m.metric === metric),
      config.thresholds,
      config.sustainedDays
    )
  );
  const recommendations = calculateRecommendationInsight(exerciseInsights);

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    `}>
      {/* Config Panel */}
      <div css={css`
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 16px;
        background-color: #f9f9f9;
      `}>
        <h3 css={css`margin-top: 0; margin-bottom: 12px;`}>Analysis Configuration</h3>

        <div css={css`margin-bottom: 12px;`}>
          <label css={css`display: block; margin-bottom: 8px; font-weight: 500;`}>
            Metrics:
          </label>
          <div css={css`display: flex; gap: 12px;`}>
            {['deviation', 'rotation'].map(metric => (
              <label key={metric} css={css`display: flex; align-items: center; gap: 6px;`}>
                <input
                  type="checkbox"
                  checked={config.metrics.includes(metric as any)}
                  onChange={e => {
                    const newMetrics = e.target.checked
                      ? [...config.metrics, metric as any]
                      : config.metrics.filter(m => m !== metric);
                    onConfigChange({ ...config, metrics: newMetrics });
                  }}
                />
                {metric === 'deviation' ? 'Deviation' : 'Rotation'}
              </label>
            ))}
          </div>
        </div>

        <div css={css`display: grid; grid-template-columns: 1fr 1fr; gap: 12px;`}>
          <div>
            <label css={css`display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;`}>
              Deviation threshold (cm)
            </label>
            <input
              type="number"
              step="0.1"
              value={config.thresholds.deviation}
              onChange={e =>
                onConfigChange({
                  ...config,
                  thresholds: { ...config.thresholds, deviation: parseFloat(e.target.value) || 0.5 },
                })
              }
              css={css`width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;`}
            />
          </div>

          <div>
            <label css={css`display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;`}>
              Rotation threshold (°)
            </label>
            <input
              type="number"
              step="0.1"
              value={config.thresholds.rotation}
              onChange={e =>
                onConfigChange({
                  ...config,
                  thresholds: { ...config.thresholds, rotation: parseFloat(e.target.value) || 1 },
                })
              }
              css={css`width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;`}
            />
          </div>

          <div>
            <label css={css`display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;`}>
              Sustained days
            </label>
            <input
              type="number"
              value={config.sustainedDays}
              onChange={e =>
                onConfigChange({
                  ...config,
                  sustainedDays: parseInt(e.target.value, 10) || 7,
                })
              }
              css={css`width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;`}
            />
          </div>
        </div>
      </div>

      {/* Progress Section */}
      {progressInsights.map((insight, i) => (
        <div
          key={`progress-${i}`}
          css={css`
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 16px;
          `}
        >
          <h3 css={css`margin-top: 0; margin-bottom: 12px;`}>Progress ({insight.metric})</h3>
          <p css={css`margin: 0; font-size: 13px; color: #666;`}>
            Fusion streak trend: {insight.fusionStreakTrend.direction} (slope: {insight.fusionStreakTrend.slope.toFixed(2)} s/week, p={insight.fusionStreakTrend.significance.p.toFixed(3)})<br />
            Fusion achieved in {insight.fusionAchievedCount}/{insight.totalSessions} sessions ({insight.fusionAchievedRate.toFixed(0)}%)
          </p>
        </div>
      ))}

      {/* Exercise Effectiveness */}
      {exerciseInsights.length > 0 && (
        <div css={css`border: 1px solid #ddd; border-radius: 4px; padding: 16px;`}>
          <h3 css={css`margin-top: 0; margin-bottom: 12px;`}>Exercise Effectiveness</h3>
          <table css={css`
            width: 100%;
            font-size: 13px;
            border-collapse: collapse;

            th, td {
              padding: 8px;
              text-align: left;
              border-bottom: 1px solid #eee;
            }

            th {
              font-weight: 600;
              background-color: #f5f5f5;
            }
          `}>
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Sessions</th>
                <th>Fusion Rate</th>
                <th>Median Streak</th>
              </tr>
            </thead>
            <tbody>
              {exerciseInsights.map((insight, i) => (
                <tr key={i}>
                  <td>{insight.exerciseTag}</td>
                  <td>{insight.sessionCount}</td>
                  <td>{insight.fusionAchievedRate.toFixed(0)}%</td>
                  <td>{insight.medianLongestStreak.toFixed(1)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.generalNotes.length > 0 && (
        <div css={css`border: 1px solid #ddd; border-radius: 4px; padding: 16px;`}>
          <h3 css={css`margin-top: 0; margin-bottom: 12px;`}>Recommendations</h3>
          <ul css={css`margin: 0; padding-left: 20px; font-size: 13px;`}>
            {recommendations.generalNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
