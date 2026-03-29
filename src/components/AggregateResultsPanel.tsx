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
  Legend,
  ComposedChart,
  Area,
  AreaChart,
} from 'recharts';

export interface AggregateResultsPanelProps {
  sessions: Session[];
}

function StatCards({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return null;
  }

  // Calculate aggregate metrics for each session
  const sessionMetrics = sessions.map((session) => {
    if (session.timeSeries.length === 0) {
      return {
        meanDeviation: 0,
        rotationRange: 0,
        xRange: 0,
        yRange: 0,
      };
    }

    const deviations = session.timeSeries.map((ts) =>
      Math.sqrt(ts.x * ts.x + ts.y * ts.y)
    );
    const rotations = session.timeSeries.map((ts) => ts.r);

    const deviationStats = calculateStats(deviations);
    const rotationStats = calculateStats(rotations);

    const xValues = session.timeSeries.map((ts) => ts.x);
    const yValues = session.timeSeries.map((ts) => ts.y);
    const xRange = Math.max(...xValues) - Math.min(...xValues);
    const yRange = Math.max(...yValues) - Math.min(...yValues);

    return {
      meanDeviation: deviationStats.mean,
      rotationRange: rotationStats.mean,
      xRange: xRange,
      yRange: yRange,
    };
  });

  // Calculate aggregate stats
  const deviationMeans = sessionMetrics.map((m) => m.meanDeviation);
  const rotationMeans = sessionMetrics.map((m) => m.rotationRange);
  const xRangeMeans = sessionMetrics.map((m) => m.xRange);
  const yRangeMeans = sessionMetrics.map((m) => m.yRange);

  const deviationStats = calculateStats(deviationMeans);
  const rotationStats = calculateStats(rotationMeans);
  const xStats = calculateStats(xRangeMeans);
  const yStats = calculateStats(yRangeMeans);

  const cards = [
    {
      label: 'Mean Deviation',
      mean: deviationStats.mean,
      stddev: deviationStats.stddev,
      unit: 'cm',
    },
    {
      label: 'Rotation Range',
      mean: rotationStats.mean,
      stddev: rotationStats.stddev,
      unit: '°',
    },
    {
      label: 'X Range',
      mean: xStats.mean,
      stddev: xStats.stddev,
      unit: 'cm',
    },
    {
      label: 'Y Range',
      mean: yStats.mean,
      stddev: yStats.stddev,
      unit: 'cm',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '20px',
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            padding: '12px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(0,255,0,0.2)',
            borderRadius: '4px',
          }}
        >
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
            {card.label}
          </div>
          <div style={{ fontSize: '14px', color: '#00ff00', fontWeight: 'bold' }}>
            {card.mean.toFixed(2)} ± {card.stddev.toFixed(2)} {card.unit}
          </div>
        </div>
      ))}
    </div>
  );
}

type TrendMetric = 'meanDeviation' | 'rotationRange' | 'xRange' | 'yRange';

function TrendChart({ sessions }: { sessions: Session[] }) {
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
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '12px',
        }}
      >
        {['meanDeviation', 'rotationRange', 'xRange', 'yRange'].map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m as TrendMetric)}
            style={{
              padding: '4px 8px',
              backgroundColor:
                metric === m ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.05)',
              border:
                metric === m
                  ? '1px solid #0f0'
                  : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer',
            }}
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
          <div style={{ color: '#888' }}>No data available</div>
        )}
      </div>
    </div>
  );
}

type OverlayMetric = 'x' | 'y' | 'rotation';

// Linear interpolation helper
function interpolate(t: number, points: Array<[number, number]>): number | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0][1];

  for (let i = 0; i < points.length - 1; i++) {
    const [t1, v1] = points[i];
    const [t2, v2] = points[i + 1];
    if (t >= t1 && t <= t2) {
      if (t1 === t2) return v1;
      const ratio = (t - t1) / (t2 - t1);
      return v1 + (v2 - v1) * ratio;
    }
  }

  return null;
}

// Resample session data to a fixed time grid using linear interpolation
function resampleSession(
  session: Session,
  metric: OverlayMetric,
  timeGrid: number[]
): Array<[number, number]> {
  // Create sorted time-series data points
  const points: Array<[number, number]> = session.timeSeries.map((ts) => {
    let value = 0;
    if (metric === 'x') {
      value = ts.x;
    } else if (metric === 'y') {
      value = ts.y;
    } else if (metric === 'rotation') {
      value = ts.r;
    }
    return [ts.t, value];
  });

  // Resample at fixed time grid
  return timeGrid
    .map((t) => [t, interpolate(t, points)] as const)
    .filter(([, v]) => v !== null) as Array<[number, number]>;
}

function OverlayChart({ sessions }: { sessions: Session[] }) {
  const [metric, setMetric] = useState<OverlayMetric>('rotation');
  const [timeMode, setTimeMode] = useState<'absolute' | 'relative'>('absolute');

  // Prepare chart data with resampled data on fixed time grid
  const prepareChartData = () => {
    if (sessions.length === 0) return null;

    // Determine time range and sampling interval in absolute mode
    let minTime = Infinity;
    let maxTime = -Infinity;

    sessions.forEach((session) => {
      if (session.timeSeries.length > 0) {
        minTime = Math.min(minTime, session.timeSeries[0].t);
        maxTime = Math.max(maxTime, session.timeSeries[session.timeSeries.length - 1].t);
      }
    });

    if (minTime === Infinity) return null;

    // Create fixed time grid - sample every 50ms or based on total duration
    const totalDuration = maxTime - minTime;
    const sampleInterval = Math.max(
      50,
      Math.ceil(totalDuration / 200) // Aim for ~200 samples max
    );

    const absoluteTimeGrid: number[] = [];
    for (let t = minTime; t <= maxTime; t += sampleInterval) {
      absoluteTimeGrid.push(t);
    }
    if (absoluteTimeGrid[absoluteTimeGrid.length - 1] !== maxTime) {
      absoluteTimeGrid.push(maxTime);
    }

    // Resample all sessions to the fixed time grid
    const resampledSessions = sessions.map((session) => {
      const maxT = session.timeSeries[session.timeSeries.length - 1]?.t || 1;
      const relativeTimeGrid = absoluteTimeGrid.map((t) => minTime + ((t - minTime) / (maxTime - minTime)) * maxT);
      return resampleSession(session, metric, absoluteTimeGrid);
    });

    // Build chart data
    const chartData: Array<{
      t: number;
      mean: number;
      upper: number;
      lower: number;
      [key: string]: number;
    }> = [];

    absoluteTimeGrid.forEach((timePoint) => {
      const values: number[] = [];

      resampledSessions.forEach((resampledData) => {
        const point = resampledData.find(([t]) => Math.abs(t - timePoint) < 0.1);
        if (point) {
          values.push(point[1]);
        }
      });

      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance =
          values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          values.length;
        const stddev = Math.sqrt(variance);

        const entry: any = {
          t: timeMode === 'absolute' ? timePoint : ((timePoint - minTime) / (maxTime - minTime)) * 100,
          mean,
          upper: mean + stddev,
          lower: mean - stddev,
        };

        // Add individual session data
        resampledSessions.forEach((resampledData, sessionIdx) => {
          const point = resampledData.find(([t]) => Math.abs(t - timePoint) < 0.1);
          if (point) {
            entry[`session${sessionIdx}`] = point[1];
          }
        });

        chartData.push(entry);
      }
    });

    return chartData;
  };

  const chartData = prepareChartData();

  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '12px',
        }}
      >
        <div>Metric:</div>
        {['x', 'y', 'rotation'].map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m as OverlayMetric)}
            style={{
              padding: '4px 8px',
              backgroundColor:
                metric === m ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.05)',
              border:
                metric === m
                  ? '1px solid #0f0'
                  : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {m === 'rotation' ? 'Rotation' : m.toUpperCase()}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '12px',
        }}
      >
        <div>Time:</div>
        {['absolute', 'relative'].map((mode) => (
          <button
            key={mode}
            onClick={() => setTimeMode(mode as 'absolute' | 'relative')}
            style={{
              padding: '4px 8px',
              backgroundColor:
                timeMode === mode
                  ? 'rgba(0,255,0,0.2)'
                  : 'rgba(255,255,255,0.05)',
              border:
                timeMode === mode
                  ? '1px solid #0f0'
                  : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      <div
        style={{
          padding: '12px',
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(0,255,0,0.2)',
          borderRadius: '4px',
          minHeight: '250px',
          width: '100%',
        }}
      >
        {chartData && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="t"
                stroke="#888"
                style={{ fontSize: '10px' }}
                label={{
                  value: timeMode === 'absolute' ? 'Time (ms)' : 'Duration (%)',
                  position: 'insideBottomRight',
                  offset: -5,
                  fill: '#888',
                  fontSize: 10,
                }}
              />
              <YAxis
                stroke="#888"
                style={{ fontSize: '10px' }}
                label={{
                  value: metric.charAt(0).toUpperCase() + metric.slice(1),
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#888',
                  fontSize: 10,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(10, 10, 10, 0.95)',
                  border: '1px solid #0f0',
                  borderRadius: '4px',
                }}
                labelStyle={{ color: '#0f0' }}
              />

              {/* Individual session lines (thin grey) */}
              {sessions.map((_, sessionIdx) => (
                <Line
                  key={`session${sessionIdx}`}
                  dataKey={`session${sessionIdx}`}
                  stroke="rgba(180,180,180,0.3)"
                  dot={false}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
              ))}

              {/* Upper standard deviation bound */}
              <Line
                type="monotone"
                dataKey="upper"
                stroke="rgba(0,255,0,0.4)"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />

              {/* Lower standard deviation bound */}
              <Line
                type="monotone"
                dataKey="lower"
                stroke="rgba(0,255,0,0.4)"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />

              {/* Mean line (thick green, rendered last so it's on top) */}
              <Line
                type="monotone"
                dataKey="mean"
                stroke="#00ff00"
                dot={false}
                strokeWidth={3}
                isAnimationActive={false}
                name="Mean ± 1σ"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: '#888', fontSize: '10px' }}>
            No data available
          </div>
        )}
      </div>
    </div>
  );
}

export function AggregateResultsPanel({
  sessions,
}: AggregateResultsPanelProps) {
  if (sessions.length < 2) {
    return (
      <div style={{ padding: '16px', color: '#888' }}>
        Select 2 or more sessions to view aggregates
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', color: '#fff', overflow: 'auto' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '14px' }}>
        {sessions.length} Sessions Selected
      </h2>
      <StatCards sessions={sessions} />
      <TrendChart sessions={sessions} />
      <OverlayChart sessions={sessions} />
    </div>
  );
}
