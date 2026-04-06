import React, { useState, useMemo } from 'react';
import { SessionMetrics } from '../types/analysis';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { css } from '@emotion/react';

interface ProgressGraphsProps {
  sessions: SessionMetrics[];
  onDrillDown?: (sessionId: string) => void;
  exerciseFilter?: string;
}

/**
 * ProgressGraphs: Three stacked graphs showing progression over multiple sessions
 * - Graph 1: bestStableDeviation (cm)
 * - Graph 2: nearBestStableTime (seconds)
 * - Graph 3: qualityPercent + driftingPercent + approachingPercent (%)
 */
export function ProgressGraphs({ sessions, onDrillDown, exerciseFilter }: ProgressGraphsProps) {
  const [zoomStart, setZoomStart] = useState(0);
  const [zoomEnd, setZoomEnd] = useState(sessions.length);

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
          <LineChart data={graphData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sessionIndex" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="bestStableDeviation"
              stroke="#8884d8"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div css={styles.graphContainer}>
        <h3>Near-Best Stable Time (seconds)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={graphData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sessionIndex" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="nearBestStableTime"
              stroke="#82ca9d"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div css={styles.graphContainer}>
        <h3>Session Composition (%)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={graphData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sessionIndex" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="qualityPercent" stackId="1" stroke="#8884d8" fill="#8884d8" />
            <Area type="monotone" dataKey="driftingPercent" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
            <Area type="monotone" dataKey="approachingPercent" stackId="1" stroke="#ffc658" fill="#ffc658" />
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
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 12px;
  `,
};
