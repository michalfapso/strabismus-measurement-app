import { useState } from 'react';
import { Session } from '../types';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatTimeSeconds, formatTimeSecondsVerbose } from '../utils/timeFormatting';
import { useViewState } from '../hooks/useViewState';

export interface TimeSeriesGraphProps {
  sessions: Session[];
  isSingleSession: boolean;
  viewState?: ReturnType<typeof useViewState>;
}

type MetricType = 'deviation' | 'x' | 'y' | 'rotation';
type DisplayMode = 'meanStddev' | 'individual';

// Metric colors from the plan
const METRIC_COLORS: Record<MetricType, string> = {
  deviation: '#00FFFF',  // bright cyan
  x: '#FF00FF',          // magenta
  y: '#FF9500',          // orange
  rotation: '#FFC107',   // gold
};

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

// Get metric value from TimeSeries data point
function getMetricValue(point: any, metric: MetricType): number {
  if (metric === 'deviation') {
    return Math.sqrt(point.x * point.x + point.y * point.y);
  } else if (metric === 'x') {
    return point.x;
  } else if (metric === 'y') {
    return point.y;
  } else if (metric === 'rotation') {
    return point.r;
  }
  return 0;
}

// Resample single metric across a session
function resampleSessionForMetric(
  session: Session,
  metric: MetricType,
  timeGrid: number[]
): Array<[number, number]> {
  const points: Array<[number, number]> = session.timeSeries.map((ts) => [
    ts.t,
    getMetricValue(ts, metric),
  ]);

  return timeGrid
    .map((t) => [t, interpolate(t, points)] as const)
    .filter(([, v]) => v !== null) as Array<[number, number]>;
}

// Calculate mean and stddev from an array
function calculateStats(values: number[]) {
  if (values.length === 0) {
    return { mean: 0, stddev: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stddev = Math.sqrt(variance);

  return { mean, stddev };
}


export function TimeSeriesGraph({ sessions, isSingleSession, viewState: passedViewState }: TimeSeriesGraphProps) {
  // Use passed viewState if provided (from UnifiedSessionPanel), otherwise create our own
  const defaultViewState = useViewState();
  const { state, toggleTimeSeriesMetric, toggleTimeSeriesDisplayMode, setTimeSeriesTimeMode } = passedViewState || defaultViewState;

  // Read from viewState
  const selectedMetrics = state.timeSeriesMetrics;
  const displayMode = state.timeSeriesDisplayModes;
  const timeMode = state.timeSeriesTimeMode;

  if (sessions.length === 0) {
    return (
      <div
        style={{
          padding: '12px',
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(0,255,0,0.2)',
          borderRadius: '4px',
          minHeight: '250px',
          width: '100%',
          color: '#888',
        }}
      >
        No data available
      </div>
    );
  }

  // Toggle metric selection
  const toggleMetric = (metric: MetricType) => {
    toggleTimeSeriesMetric(metric);
  };

  // Toggle display mode (aggregate only)
  const toggleDisplayMode = (mode: DisplayMode) => {
    toggleTimeSeriesDisplayMode(mode);
  };

  // Handle time mode change
  const handleTimeModeChange = (mode: 'absolute' | 'relative') => {
    setTimeSeriesTimeMode(mode);
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (sessions.length === 0 || selectedMetrics.size === 0) return null;

    // Determine time range
    let minTime = Infinity;
    let maxTime = -Infinity;

    sessions.forEach((session) => {
      if (session.timeSeries.length > 0) {
        minTime = Math.min(minTime, session.timeSeries[0].t);
        maxTime = Math.max(maxTime, session.timeSeries[session.timeSeries.length - 1].t);
      }
    });

    if (minTime === Infinity) return null;

    // Create fixed time grid
    const totalDuration = maxTime - minTime;
    const sampleInterval = Math.max(
      50,
      Math.ceil(totalDuration / 200)
    );

    const absoluteTimeGrid: number[] = [];
    for (let t = minTime; t <= maxTime; t += sampleInterval) {
      absoluteTimeGrid.push(t);
    }
    if (absoluteTimeGrid[absoluteTimeGrid.length - 1] !== maxTime) {
      absoluteTimeGrid.push(maxTime);
    }

    // For single session: just show raw data (resampled)
    if (isSingleSession) {
      const session = sessions[0];
      const chartData: any[] = [];

      for (const metric of selectedMetrics) {
        const resampledData = resampleSessionForMetric(session, metric, absoluteTimeGrid);

        resampledData.forEach((point) => {
          const [t, value] = point;
          const timeValue = timeMode === 'absolute' ? t : ((t - minTime) / (maxTime - minTime)) * 100;

          // Find or create entry for this time
          let entry = chartData.find((e) => Math.abs(e.t - timeValue) < 0.1);
          if (!entry) {
            entry = { t: timeValue };
            chartData.push(entry);
          }

          entry[metric] = value;
        });
      }

      return chartData;
    }

    // For aggregate: calculate mean, stddev, and individual session data
    const chartData: any[] = [];

    absoluteTimeGrid.forEach((timePoint) => {
      const timeValue = timeMode === 'absolute' ? timePoint : ((timePoint - minTime) / (maxTime - minTime)) * 100;
      const entry: any = { t: timeValue };

      for (const metric of selectedMetrics) {
        const metricValues: number[] = [];
        const sessionValues: Record<string, number> = {};

        // Resample each session for this metric
        sessions.forEach((session, sessionIdx) => {
          const resampledData = resampleSessionForMetric(session, metric, absoluteTimeGrid);
          const point = resampledData.find(([t]) => Math.abs(t - timePoint) < 0.1);

          if (point) {
            const [, value] = point;
            metricValues.push(value);
            sessionValues[`${metric}_session${sessionIdx}`] = value;
          }
        });

        if (metricValues.length > 0) {
          const stats = calculateStats(metricValues);
          entry[`${metric}_mean`] = stats.mean;
          entry[`${metric}_upper`] = stats.mean + stats.stddev;
          entry[`${metric}_lower`] = stats.mean - stats.stddev;
        }

        // Add individual session data for this metric
        Object.assign(entry, sessionValues);
      }

      chartData.push(entry);
    });

    return chartData;
  };

  const chartData = prepareChartData();

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Metric Selector */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: '11px', color: '#888' }}>Metrics:</div>
        {(['deviation', 'x', 'y', 'rotation'] as MetricType[]).map((metric) => (
          <label
            key={metric}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              padding: '4px 8px',
              backgroundColor: selectedMetrics.has(metric)
                ? 'rgba(0,255,0,0.1)'
                : 'rgba(255,255,255,0.05)',
              border: selectedMetrics.has(metric)
                ? '1px solid ' + METRIC_COLORS[metric]
                : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '3px',
            }}
          >
            <input
              type="checkbox"
              checked={selectedMetrics.has(metric)}
              onChange={() => toggleMetric(metric)}
              style={{ cursor: 'pointer' }}
            />
            <span>
              {metric === 'deviation' ? 'Deviation' : metric.toUpperCase()}
            </span>
          </label>
        ))}
      </div>

      {/* Aggregate-only controls */}
      {!isSingleSession && (
        <>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '12px',
              fontSize: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '11px', color: '#888' }}>Display:</div>
            {(['meanStddev', 'individual'] as DisplayMode[]).map((mode) => (
              <label
                key={mode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  backgroundColor: displayMode.has(mode)
                    ? 'rgba(0,255,0,0.1)'
                    : 'rgba(255,255,255,0.05)',
                  border: displayMode.has(mode)
                    ? '1px solid #0f0'
                    : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '3px',
                }}
              >
                <input
                  type="checkbox"
                  checked={displayMode.has(mode)}
                  onChange={() => toggleDisplayMode(mode)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{mode === 'meanStddev' ? 'Mean & Std Dev' : 'Individual'}</span>
              </label>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '12px',
              fontSize: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '11px', color: '#888' }}>Time:</div>
            {(['absolute', 'relative'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleTimeModeChange(mode)}
                style={{
                  padding: '4px 8px',
                  backgroundColor:
                    timeMode === mode ? 'rgba(0,255,0,0.1)' : 'rgba(255,255,255,0.05)',
                  border:
                    timeMode === mode
                      ? '1px solid #0f0'
                      : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '3px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {mode === 'absolute' ? 'Absolute' : 'Relative'}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Chart */}
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
              margin={{ top: 5, right: 60, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="t"
                stroke="#888"
                style={{ fontSize: '10px' }}
                tickFormatter={timeMode === 'absolute' ? formatTimeSeconds : (v) => v.toFixed(1) + '%'}
                label={{
                  value: timeMode === 'absolute' ? 'Time' : 'Duration (%)',
                  position: 'insideBottomRight',
                  offset: -5,
                  fill: '#888',
                  fontSize: 10,
                }}
              />

              {/* Y-Axis for cm (Deviation, X, Y) */}
              <YAxis
                yAxisId="left"
                stroke="#888"
                style={{ fontSize: '10px' }}
                label={{
                  value: 'Distance (cm)',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#888',
                  fontSize: 10,
                }}
              />

              {/* Y-Axis for rotation (degrees) */}
              {selectedMetrics.has('rotation') && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#888"
                  style={{ fontSize: '10px' }}
                  label={{
                    value: 'Rotation (°)',
                    angle: 90,
                    position: 'insideRight',
                    fill: '#888',
                    fontSize: 10,
                  }}
                />
              )}

              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(10, 10, 10, 0.95)',
                  border: '1px solid #0f0',
                  borderRadius: '4px',
                }}
                labelStyle={{ color: '#0f0' }}
                labelFormatter={(value) =>
                  timeMode === 'absolute' ? formatTimeSeconds(value as number) : value.toFixed(1) + '%'
                }
              />

              {/* Render lines for each metric */}
              {isSingleSession ? (
                // Single session: just show metric lines
                Array.from(selectedMetrics).map((metric) => (
                  <Line
                    key={metric}
                    yAxisId={metric === 'rotation' ? 'right' : 'left'}
                    dataKey={metric}
                    stroke={METRIC_COLORS[metric]}
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    name={metric.charAt(0).toUpperCase() + metric.slice(1)}
                  />
                ))
              ) : (
                // Aggregate: show individual, and mean & stddev lines
                <>
                  {Array.from(selectedMetrics).map((metric) => (
                    <div key={metric}>
                      {/* Individual session lines */}
                      {displayMode.has('individual') &&
                        sessions.map((_, sessionIdx) => (
                          <Line
                            key={`${metric}_session${sessionIdx}`}
                            yAxisId={metric === 'rotation' ? 'right' : 'left'}
                            dataKey={`${metric}_session${sessionIdx}`}
                            stroke="rgba(180,180,180,0.2)"
                            dot={false}
                            strokeWidth={0.5}
                            isAnimationActive={false}
                          />
                        ))}

                      {/* Mean & Std Dev: render both bounds and mean line together */}
                      {displayMode.has('meanStddev') && (
                        <>
                          <Line
                            key={`${metric}_upper`}
                            yAxisId={metric === 'rotation' ? 'right' : 'left'}
                            dataKey={`${metric}_upper`}
                            stroke={METRIC_COLORS[metric]}
                            dot={false}
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            isAnimationActive={false}
                            opacity={0.5}
                          />
                          <Line
                            key={`${metric}_lower`}
                            yAxisId={metric === 'rotation' ? 'right' : 'left'}
                            dataKey={`${metric}_lower`}
                            stroke={METRIC_COLORS[metric]}
                            dot={false}
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            isAnimationActive={false}
                            opacity={0.5}
                          />
                          <Line
                            key={`${metric}_mean`}
                            yAxisId={metric === 'rotation' ? 'right' : 'left'}
                            dataKey={`${metric}_mean`}
                            stroke={METRIC_COLORS[metric]}
                            dot={false}
                            strokeWidth={2.5}
                            isAnimationActive={false}
                            name={metric.charAt(0).toUpperCase() + metric.slice(1) + ' (mean)'}
                          />
                        </>
                      )}
                    </div>
                  ))}
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: '#888', fontSize: '10px' }}>No data available</div>
        )}
      </div>
    </div>
  );
}
