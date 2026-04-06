import React, { useMemo } from 'react';
import { SessionMetrics } from '../types/analysis';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { css } from '@emotion/react';
import { THEME } from '../theme';

interface ProgressGraphsProps {
  sessions: SessionMetrics[];
  onDrillDown?: (sessionId: string) => void;
  exerciseFilter?: string;
}

interface ProgressGraphsTooltipPayload {
  sessionIndex: number;
  sessionId: string;
  date: string;
  exerciseTag: string;
  bestStableDeviation: number;
  nearBestStableTime: number;
  qualityPercent: number;
  driftingPercent: number;
  approachingPercent: number;
}

interface SharedTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ProgressGraphsTooltipPayload;
  }>;
  label?: any;
}

function SharedTooltip({ active, payload }: SharedTooltipProps) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div css={styles.tooltip}>
        <p><strong>{data.date}</strong></p>
        <p>Exercise: {data.exerciseTag}</p>
        <p>Session #{data.sessionIndex + 1}</p>
        <hr />
        <p>Best Stable Deviation: {data.bestStableDeviation.toFixed(2)} cm</p>
        <p>Near-Best Stable Time: {data.nearBestStableTime.toFixed(1)}s</p>
        <p>Quality: {data.qualityPercent.toFixed(1)}%</p>
        <p>Drifting: {data.driftingPercent.toFixed(1)}%</p>
        <p>Approaching: {data.approachingPercent.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
}

/**
 * ProgressGraphs: Three stacked graphs showing progression over multiple sessions
 * - Graph 1: bestStableDeviation (cm)
 * - Graph 2: nearBestStableTime (seconds)
 * - Graph 3: qualityPercent + driftingPercent + approachingPercent (%)
 */
export function ProgressGraphs({ sessions, onDrillDown, exerciseFilter }: ProgressGraphsProps) {
  // Filter sessions by exercise if needed
  const filteredSessions = useMemo(() => {
    if (!exerciseFilter) return sessions;
    return sessions.filter(s => s.exerciseTag === exerciseFilter);
  }, [sessions, exerciseFilter]);

  // Prepare data for graphs: sort by date, add session indices, prepare for recharts
  const graphData = useMemo(() => {
    const sorted = [...filteredSessions].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return sorted.map((session, index) => ({
      sessionIndex: index,
      sessionId: session.sessionId,
      date: session.date,
      exerciseTag: session.exerciseTag,
      bestStableDeviation: session.bestStableDeviation,
      nearBestStableTime: session.nearBestStableTime,
      qualityPercent: session.qualityPercent,
      driftingPercent: session.driftingPercent,
      approachingPercent: session.approachingPercent,
    }));
  }, [filteredSessions]);

  if (graphData.length === 0) {
    return <div>No sessions to display</div>;
  }

  return (
    <div css={styles.container}>
      <div css={styles.graphContainer}>
        <h3>Best Stable Deviation (cm)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={graphData} margin={{ right: 30, left: 0, bottom: 60, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="sessionIndex"
              label={{ value: 'Session Index', position: 'insideBottomRight', offset: -10, fill: THEME.textSecondary }}
            />
            <YAxis label={{ value: 'Deviation (cm)', angle: -90, position: 'insideLeft', fill: THEME.textSecondary }} />
            <Tooltip content={<SharedTooltip />} />
            <Legend wrapperStyle={{ color: THEME.textPrimary }} />
            <Line
              type="monotone"
              dataKey="bestStableDeviation"
              stroke={THEME.metricDeviation}
              name="Best Stable Deviation"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div css={styles.graphContainer}>
        <h3>Near-Best Stable Time (seconds)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={graphData} margin={{ right: 30, left: 0, bottom: 60, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="sessionIndex"
              label={{ value: 'Session Index', position: 'insideBottomRight', offset: -10, fill: THEME.textSecondary }}
            />
            <YAxis label={{ value: 'Time (seconds)', angle: -90, position: 'insideLeft', fill: THEME.textSecondary }} />
            <Tooltip content={<SharedTooltip />} />
            <Legend wrapperStyle={{ color: THEME.textPrimary }} />
            <Line
              type="monotone"
              dataKey="nearBestStableTime"
              stroke={THEME.stateNearFusion}
              name="Near-Best Stable Time"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div css={styles.graphContainer}>
        <h3>Session Composition (%)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={graphData} margin={{ right: 30, left: 0, bottom: 60, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="sessionIndex"
              label={{ value: 'Session Index', position: 'insideBottomRight', offset: -10, fill: THEME.textSecondary }}
            />
            <YAxis label={{ value: 'Percent (%)', angle: -90, position: 'insideLeft', fill: THEME.textSecondary }} />
            <Tooltip content={<SharedTooltip />} />
            <Legend wrapperStyle={{ color: THEME.textPrimary }} />
            <Area type="monotone" dataKey="qualityPercent" stackId="1" stroke={THEME.stateFusion} fill={THEME.stateFusion} name="Quality" />
            <Area type="monotone" dataKey="driftingPercent" stackId="1" stroke={THEME.stateDrifting} fill={THEME.stateDrifting} name="Drifting" />
            <Area type="monotone" dataKey="approachingPercent" stackId="1" stroke={THEME.stateApproaching} fill={THEME.stateApproaching} name="Approaching" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const styles = {
  container: css`
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  `,
  graphContainer: css`
    border: 1px solid ${THEME.borderPrimary};
    border-radius: 4px;
    padding: 12px;
  `,
  tooltip: css`
    background: rgba(0, 0, 0, 1);
    border: 1px solid ${THEME.borderPrimary};
    border-radius: 4px;
    padding: 8px;
    font-size: 12px;
    color: ${THEME.textPrimary};

    p {
      margin: 4px 0;
    }

    hr {
      margin: 4px 0;
      border: none;
      border-top: 1px solid ${THEME.borderSecondary || '#444'};
    }
  `,
};
