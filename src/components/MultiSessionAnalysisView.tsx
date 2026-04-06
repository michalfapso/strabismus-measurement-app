import { Session } from '../types';
import { SessionMetrics, ProgressInsight, ExerciseInsight, SessionQualityInsight, MilestoneInsight } from '../types/analysis';
import { computeSessionMetrics } from '../utils/sessionMetrics';
import { calculateProgressInsight, calculateExerciseInsights, calculateSessionQualityInsight, calculateMilestoneInsight, calculateRecommendationInsight } from '../utils/analysisInsights';
import { getGlobalSettings } from '../utils/globalSettings';
import { AnalysisMetricsBanner } from './AnalysisMetricsBanner';
import { css } from '@emotion/react';
import { THEME } from '../theme';

// Analysis only supports deviation and rotation metrics
type AnalysisMetric = 'deviation' | 'rotation';

interface MultiSessionAnalysisViewProps {
  sessions: Session[];
}

const SUSTAINED_FUSION_DAYS = 7;

const panelStyle = css`
  border: 1px solid ${THEME.borderPrimary};
  border-radius: 4px;
  padding: 16px;
  background-color: ${THEME.panelBg};
`;

const sectionTitleStyle = css`
  margin-top: 0;
  margin-bottom: 12px;
  color: ${THEME.textPrimary};
  font-size: 15px;
`;

const metricGroupStyle = css`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const metricGroupHeaderStyle = css`
  padding: 8px 12px;
  background-color: rgba(255, 255, 255, 0.04);
  border-left: 3px solid ${THEME.accentGreen};
  border-radius: 0 4px 4px 0;
  font-size: 13px;
  font-weight: 600;
  color: ${THEME.textPrimary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const subSectionStyle = css`
  border: 1px solid ${THEME.borderSecondary};
  border-radius: 4px;
  padding: 14px;
  background-color: ${THEME.panelBg};
`;

const subSectionTitleStyle = css`
  margin-top: 0;
  margin-bottom: 10px;
  color: ${THEME.textSecondary};
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

const labelStyle = css`
  font-size: 13px;
  color: ${THEME.textSecondary};
  margin: 0;
  line-height: 1.6;
`;

const tableStyle = css`
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;

  th, td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid ${THEME.borderSecondary};
    color: ${THEME.textSecondary};
  }

  th {
    font-weight: 600;
    background-color: ${THEME.backgroundLight};
    color: ${THEME.textPrimary};
  }
`;

const progressBarContainerStyle = css`
  margin-top: 8px;
  background-color: ${THEME.backgroundLight};
  border-radius: 4px;
  height: 8px;
  overflow: hidden;
`;

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div css={progressBarContainerStyle}>
      <div css={css`
        height: 100%;
        width: ${clamped}%;
        background-color: ${THEME.accentGreen};
        border-radius: 4px;
        transition: width 0.3s ease;
      `} />
    </div>
  );
}

function ProgressSection({ insight }: { insight: ProgressInsight }) {
  return (
    <div css={subSectionStyle}>
      <h4 css={subSectionTitleStyle}>A — Progress</h4>
      <p css={labelStyle}>
        Best stable deviation trend:{' '}
        <strong css={css`color: ${THEME.textPrimary};`}>{insight.bestStableDeviationTrend.direction}</strong>{' '}
        (slope: {insight.bestStableDeviationTrend.slope.toFixed(3)}/week,{' '}
        p={insight.bestStableDeviationTrend.significance.p.toFixed(3)}
        {insight.bestStableDeviationTrend.significance.significant ? ' *' : ''})
        <br />
        Near best stable time trend:{' '}
        <strong css={css`color: ${THEME.textPrimary};`}>{insight.nearBestStableTimeTrend.direction}</strong>{' '}
        (slope: {insight.nearBestStableTimeTrend.slope.toFixed(2)} s/week,{' '}
        p={insight.nearBestStableTimeTrend.significance.p.toFixed(3)}
        {insight.nearBestStableTimeTrend.significance.significant ? ' *' : ''})
        <br />
        Quality percent trend:{' '}
        <strong css={css`color: ${THEME.textPrimary};`}>{insight.qualityPercentTrend.direction}</strong>{' '}
        (slope: {insight.qualityPercentTrend.slope.toFixed(2)}%/week,{' '}
        p={insight.qualityPercentTrend.significance.p.toFixed(3)}
        {insight.qualityPercentTrend.significance.significant ? ' *' : ''})
        <br />
        Fusion achieved in{' '}
        <strong css={css`color: ${THEME.textPrimary};`}>
          {insight.fusionAchievedCount}/{insight.totalSessions}
        </strong>{' '}
        sessions ({insight.fusionAchievedRate.toFixed(0)}%)
        {insight.fusionStreakTrend && (
          <>
            <br />
            Fusion streak trend:{' '}
            <strong css={css`color: ${THEME.textPrimary};`}>{insight.fusionStreakTrend.direction}</strong>{' '}
            (slope: {insight.fusionStreakTrend.slope.toFixed(2)} s/week,{' '}
            p={insight.fusionStreakTrend.significance.p.toFixed(3)}
            {insight.fusionStreakTrend.significance.significant ? ' *' : ''})
          </>
        )}
      </p>
    </div>
  );
}

function ExerciseEffectivenessSection({ insights }: { insights: ExerciseInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <div css={subSectionStyle}>
      <h4 css={subSectionTitleStyle}>B — Exercise Effectiveness</h4>
      <table css={tableStyle}>
        <thead>
          <tr>
            <th>Exercise</th>
            <th>Sessions</th>
            <th>Fusion Rate</th>
            <th>Median Streak</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          {insights
            .slice()
            .sort((a, b) => b.fusionAchievedRate - a.fusionAchievedRate)
            .map((insight, i) => (
              <tr key={i}>
                <td>{insight.exerciseTag}</td>
                <td>{insight.sessionCount}</td>
                <td>{insight.fusionAchievedRate.toFixed(0)}%</td>
                <td>{insight.medianLongestStreak.toFixed(1)}s</td>
                <td>{insight.trendDirection}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionQualitySection({ insight }: { insight: SessionQualityInsight }) {
  return (
    <div css={subSectionStyle}>
      <h4 css={subSectionTitleStyle}>C — Session Quality</h4>
      <p css={labelStyle}>
        Variability:{' '}
        <strong css={css`color: ${THEME.textPrimary};`}>{insight.variability.level}</strong>{' '}
        (streak range: {insight.variability.streakRange.min.toFixed(1)}s –{' '}
        {insight.variability.streakRange.max.toFixed(1)}s)
      </p>
      {insight.outliers.length > 0 ? (
        <>
          <p css={css`${labelStyle}; margin-top: 8px; margin-bottom: 6px;`}>
            Outlier sessions ({insight.outliers.length}):
          </p>
          <table css={tableStyle}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Exercise</th>
                <th>Direction</th>
                <th>Z-Score</th>
              </tr>
            </thead>
            <tbody>
              {insight.outliers.map((o, i) => (
                <tr key={i}>
                  <td>{o.date}</td>
                  <td>{o.exerciseTag}</td>
                  <td>{o.direction === 'unusually_good' ? 'Unusually good' : 'Unusually poor'}</td>
                  <td>{o.zScore.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p css={labelStyle}>No significant outliers detected.</p>
      )}
    </div>
  );
}

function MilestonesSection({ insight, metricUnit }: { insight: MilestoneInsight; metricUnit: string }) {
  return (
    <div css={subSectionStyle}>
      <h4 css={subSectionTitleStyle}>D — Milestones</h4>

      {/* Min value progress bar */}
      <p css={labelStyle}>
        Min value progress toward threshold ({insight.minValueProgress.targetThreshold} {metricUnit}):
      </p>
      <ProgressBar percent={insight.minValueProgress.progressPercent} />
      <p css={css`${labelStyle}; margin-top: 6px;`}>
        {insight.minValueProgress.progressPercent.toFixed(0)}% —{' '}
        {insight.minValueProgress.currentValue.toFixed(2)} {metricUnit}{' '}
        (started at {insight.minValueProgress.startValue.toFixed(2)} {metricUnit})
      </p>

      {/* Sustained fusion events */}
      <p css={css`${labelStyle}; margin-top: 10px;`}>
        Sustained fusion events (≥{SUSTAINED_FUSION_DAYS} consecutive days with fusion):{' '}
        <strong css={css`color: ${THEME.textPrimary};`}>{insight.sustainedFusionEvents.length}</strong>
      </p>
      {insight.sustainedFusionEvents.length > 0 && (
        <ul css={css`margin: 4px 0 0 0; padding-left: 18px; font-size: 13px; color: ${THEME.textSecondary};`}>
          {insight.sustainedFusionEvents.map((e, i) => (
            <li key={i}>{e.startDate} → {e.endDate} ({e.durationDays} days)</li>
          ))}
        </ul>
      )}

      {/* Readiness indicators */}
      <p css={css`${labelStyle}; margin-top: 10px; margin-bottom: 6px;`}>Readiness indicators:</p>
      <ul css={css`margin: 0; padding-left: 18px; font-size: 13px; color: ${THEME.textSecondary};`}>
        {insight.readinessIndicators.map((r, i) => (
          <li key={i} css={css`color: ${r.met ? THEME.accentGreen : THEME.textSecondary};`}>
            {r.type === 'sustained_fusion' && `Sustained fusion: ${r.value} event(s)`}
            {r.type === 'min_value_approaching_threshold' && `Min value progress: ${r.value.toFixed(0)}%`}
            {r.type === 'high_fusion_rate' && `High fusion rate: ${r.value.toFixed(0)}%`}
            {r.met ? ' ✓' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricGroup({
  metric,
  sessionMetrics,
  thresholds,
}: {
  metric: AnalysisMetric;
  sessionMetrics: SessionMetrics[];
  thresholds: { deviation: number; rotation: number };
}) {
  const metricSessionMetrics = sessionMetrics.filter(m => m.metric === metric);
  if (metricSessionMetrics.length === 0) return null;

  const progressInsight = calculateProgressInsight(metricSessionMetrics, thresholds);
  const exerciseInsights = calculateExerciseInsights(metricSessionMetrics);
  const qualityInsight = calculateSessionQualityInsight(metricSessionMetrics);
  const milestoneInsight = calculateMilestoneInsight(metricSessionMetrics, thresholds, SUSTAINED_FUSION_DAYS);

  const metricLabel = metric === 'deviation' ? 'Deviation' : 'Rotation';
  const metricUnit = metric === 'rotation' ? '°' : 'cm';

  return (
    <div css={panelStyle}>
      <div css={metricGroupHeaderStyle}>{metricLabel}</div>
      <div css={css`${metricGroupStyle}; margin-top: 12px;`}>
        <ProgressSection insight={progressInsight} />
        <ExerciseEffectivenessSection insights={exerciseInsights} />
        <SessionQualitySection insight={qualityInsight} />
        <MilestonesSection insight={milestoneInsight} metricUnit={metricUnit} />
      </div>
    </div>
  );
}

export default function MultiSessionAnalysisView({ sessions }: MultiSessionAnalysisViewProps) {
  const settings = getGlobalSettings();
  const { selectedMetrics, thresholds } = settings;

  // Filter to only metrics supported by the analysis pipeline
  const analysisMetrics = selectedMetrics.filter(
    (m): m is AnalysisMetric => m === 'deviation' || m === 'rotation'
  );

  // Normalize thresholds for insight functions (which expect deviation + rotation)
  const normalizedThresholds = {
    deviation: thresholds.deviation ?? 1.0,
    rotation: thresholds.rotation ?? 1.0,
  };

  // Compute session metrics for all sessions × all selected analysis metrics
  const sessionMetrics = sessions
    .filter(s => {
      const duration =
        s.timeSeries.length > 1
          ? (s.timeSeries[s.timeSeries.length - 1].t - s.timeSeries[0].t) / 1000
          : 0;
      return duration >= 10;
    })
    .flatMap(session =>
      analysisMetrics.map(metric => {
        try {
          return computeSessionMetrics(session, normalizedThresholds, metric);
        } catch {
          return null;
        }
      })
    )
    .filter((m): m is SessionMetrics => m !== null);

  // Date range for header (use timestamp, format as YYYY-MM-DD)
  const dates = sessions
    .map(s => s.timestamp.slice(0, 10))
    .sort();
  const dateFrom = dates[0] ?? '';
  const dateTo = dates[dates.length - 1] ?? '';
  const dateRange = dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`;

  // Cross-metric recommendations (based on all exercise insights combined)
  const allExerciseInsights = calculateExerciseInsights(sessionMetrics);
  const recommendations = calculateRecommendationInsight(allExerciseInsights);

  if (sessionMetrics.length === 0) {
    return (
      <div css={css`
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
        overflow-y: auto;
        flex: 1;
      `}>
        <AnalysisMetricsBanner mode="multi" />
        <div css={css`padding: 16px; color: ${THEME.textSecondary};`}>
          No valid sessions for analysis (minimum 10 seconds each).
        </div>
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
      {/* Header */}
      <div>
        <h2 css={css`margin: 0 0 4px 0; color: ${THEME.textPrimary}; font-size: 18px;`}>
          Analysis: {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </h2>
        {dateRange && (
          <p css={css`margin: 0; font-size: 13px; color: ${THEME.textSecondary};`}>{dateRange}</p>
        )}
      </div>

      {/* Metric Settings Banner */}
      <AnalysisMetricsBanner mode="multi" />

      {/* Metric sections (A–D per metric) */}
      {analysisMetrics.length === 0 ? (
        <div css={css`padding: 12px; color: ${THEME.textSecondary}; font-size: 13px;`}>
          No supported analysis metrics selected. Go to Settings and select Deviation or Rotation.
        </div>
      ) : (
        analysisMetrics.map(metric => (
          <MetricGroup
            key={metric}
            metric={metric}
            sessionMetrics={sessionMetrics}
            thresholds={normalizedThresholds}
          />
        ))
      )}

      {/* Section E: Recommendations (cross-metric, shown once) */}
      {recommendations.generalNotes.length > 0 && (
        <div css={panelStyle}>
          <h3 css={sectionTitleStyle}>E — Recommendations</h3>
          {recommendations.prioritize.length > 0 && (
            <div css={css`margin-bottom: 10px;`}>
              <p css={css`margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: ${THEME.textPrimary};`}>
                Prioritize:
              </p>
              <ul css={css`margin: 0; padding-left: 18px; font-size: 13px; color: ${THEME.textSecondary};`}>
                {recommendations.prioritize.map((r, i) => (
                  <li key={i}><strong>{r.exerciseTag}</strong> — {r.reason}</li>
                ))}
              </ul>
            </div>
          )}
          {recommendations.reduce.length > 0 && (
            <div css={css`margin-bottom: 10px;`}>
              <p css={css`margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: ${THEME.textPrimary};`}>
                Consider reducing:
              </p>
              <ul css={css`margin: 0; padding-left: 18px; font-size: 13px; color: ${THEME.textSecondary};`}>
                {recommendations.reduce.map((r, i) => (
                  <li key={i}><strong>{r.exerciseTag}</strong> — {r.reason}</li>
                ))}
              </ul>
            </div>
          )}
          <ul css={css`margin: 0; padding-left: 18px; font-size: 13px; color: ${THEME.textSecondary};`}>
            {recommendations.generalNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
