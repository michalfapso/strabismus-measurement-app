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

function OverlayChart({ sessions }: { sessions: Session[] }) {
  const [metric, setMetric] = useState<OverlayMetric>('rotation');
  const [timeMode, setTimeMode] = useState<'absolute' | 'relative'>('absolute');

  // Prepare chart data with individual session lines and mean/stddev band
  const prepareChartData = () => {
    if (sessions.length === 0) return null;

    // Get max duration for normalization
    const maxDuration = Math.max(
      ...sessions.map((s) =>
        s.timeSeries.length > 0
          ? s.timeSeries[s.timeSeries.length - 1].t
          : 0
      )
    );

    // Create a map of time points -> values across all sessions
    const timePointsMap = new Map<number, number[]>();

    sessions.forEach((session) => {
      const maxT = session.timeSeries[session.timeSeries.length - 1]?.t || 1;

      session.timeSeries.forEach((ts) => {
        let value = 0;
        if (metric === 'x') {
          value = ts.x;
        } else if (metric === 'y') {
          value = ts.y;
        } else if (metric === 'rotation') {
          value = ts.r;
        }

        const key = timeMode === 'absolute' ? ts.t : Math.round((ts.t / maxT) * 100);
        if (!timePointsMap.has(key)) {
          timePointsMap.set(key, []);
        }
        timePointsMap.get(key)!.push(value);
      });
    });

    // Calculate mean and stddev for each time point
    const chartData: Array<{
      t: number;
      mean: number;
      upper: number;
      lower: number;
      [key: string]: number;
    }> = [];

    Array.from(timePointsMap.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([timePoint, values]) => {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance =
          values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          values.length;
        const stddev = Math.sqrt(variance);

        chartData.push({
          t: timePoint,
          mean,
          upper: mean + stddev,
          lower: mean - stddev,
        });
      });

    // Add individual session lines to the data
    sessions.forEach((session, sessionIdx) => {
      const maxT = session.timeSeries[session.timeSeries.length - 1]?.t || 1;
      const sessionKey = `session${sessionIdx}`;

      session.timeSeries.forEach((ts) => {
        let value = 0;
        if (metric === 'x') {
          value = ts.x;
        } else if (metric === 'y') {
          value = ts.y;
        } else if (metric === 'rotation') {
          value = ts.r;
        }

        const timePoint =
          timeMode === 'absolute' ? ts.t : Math.round((ts.t / maxT) * 100);
        const existingPoint = chartData.find((p) => p.t === timePoint);

        if (existingPoint) {
          existingPoint[sessionKey] = value;
        }
      });
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
                  stroke="rgba(200,200,200,0.4)"
                  dot={false}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
              ))}

              {/* Standard deviation band (semitransparent green area) */}
              <Area
                type="monotone"
                dataKey="upper"
                fill="rgba(0,255,0,0.15)"
                stroke="none"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="lower"
                fill="rgba(0,255,0,0.15)"
                stroke="none"
                isAnimationActive={false}
              />

              {/* Mean line (thick green, rendered last so it's on top) */}
              <Line
                type="monotone"
                dataKey="mean"
                stroke="#00ff00"
                dot={false}
                strokeWidth={2.5}
                isAnimationActive={false}
                name="Mean"
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
