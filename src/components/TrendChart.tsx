import { useState } from 'react';
import { Session } from '../types';
import { calculateStats, linearRegression } from '../utils/stats';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { metricButtonStyle } from '../styles/chartControlsStyles';

export interface TrendChartProps {
  sessions: Session[];
}

type TrendMetric = 'meanDeviation' | 'rotationRange' | 'xRange' | 'yRange';

export function TrendChart({ sessions }: TrendChartProps) {
  const [metric, setMetric] = useState<TrendMetric>('meanDeviation');

  // Calculate trend data
  const trendPoints: Array<[number, number]> = sessions
    .map((session, index) => {
      if (session.timeSeries.length === 0) return null;

      let value = 0;
      if (metric === 'meanDeviation') {
        const deviations = session.timeSeries.map((ts) =>
          Math.sqrt(ts.x * ts.x + ts.y * ts.y)
        );
        value = deviations.reduce((a, b) => a + b, 0) / deviations.length;
      } else if (metric === 'rotationRange') {
        const rotations = session.timeSeries.map((ts) => ts.r);
        value =
          rotations.reduce((a, b) => a + b, 0) / rotations.length;
      } else if (metric === 'xRange') {
        const xValues = session.timeSeries.map((ts) => ts.x);
        value = Math.max(...xValues) - Math.min(...xValues);
      } else if (metric === 'yRange') {
        const yValues = session.timeSeries.map((ts) => ts.y);
        value = Math.max(...yValues) - Math.min(...yValues);
      }
      return [index, value];
    })
    .filter((p) => p !== null) as Array<[number, number]>;

  const regression = linearRegression(trendPoints);
  const trend = regression.slope >= 0 ? 'improving' : 'declining';

  return (
    <div style={{ marginBottom: '0' }}>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: '11px', color: '#888' }}>Metric:</div>
        {(['meanDeviation', 'rotationRange', 'xRange', 'yRange'] as TrendMetric[]).map((m) => (
          <button
            key={m}
            css={metricButtonStyle}
            data-active={metric === m}
            onClick={() => setMetric(m)}
          >
            {m === 'meanDeviation'
              ? 'Mean Dev'
              : m === 'rotationRange'
                ? 'Rotation'
                : m === 'xRange'
                  ? 'X Range'
                  : 'Y Range'}
          </button>
        ))}
      </div>

      <div
        style={{
          padding: '12px',
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(0,255,0,0.2)',
          borderRadius: '4px',
          minHeight: '200px',
          width: '100%',
        }}
      >
        {trendPoints.length > 0 ? (
          <>
            <div style={{ fontSize: '11px', marginBottom: '8px', color: '#888' }}>
              Trend: {trend} ({regression.slope.toFixed(3)}/session)
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart
                data={trendPoints.map(([index, value]) => ({ index, value }))}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="index"
                  stroke="#888"
                  style={{ fontSize: '10px' }}
                />
                <YAxis
                  stroke="#888"
                  style={{ fontSize: '10px' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(10, 10, 10, 0.95)',
                    border: '1px solid #0f0',
                    borderRadius: '4px',
                  }}
                  labelStyle={{ color: '#0f0' }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#00ff00"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        ) : (
          <div style={{ color: '#888', fontSize: '10px' }}>No data available</div>
        )}
      </div>
    </div>
  );
}
