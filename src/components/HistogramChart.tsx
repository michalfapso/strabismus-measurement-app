import { memo } from 'react';
import { Session } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  calculateSessionHistogram,
  calculateAggregateHistogram,
  HistogramMetric,
  HistogramBin,
} from '../utils/histogram';
import { useViewState } from '../hooks/useViewState';

export interface HistogramChartProps {
  sessions: Session[];
  isSingleSession: boolean;
}

// Metric colors matching TimeSeriesGraph
const METRIC_COLORS: Record<HistogramMetric, string> = {
  deviation: '#00FFFF',  // bright cyan
  x: '#FF00FF',          // magenta
  y: '#FF9500',          // orange
  rotation: '#FFC107',   // gold
};

/**
 * Helper component to render a single metric's histogram
 */
const HistogramBar = memo(function HistogramBar({
  metric,
  data,
}: {
  metric: HistogramMetric;
  data: HistogramBin[];
}) {
  const chartData = data.map((bin) => ({
    label: bin.label,
    duration: parseFloat(bin.duration.toFixed(2)),
  }));

  const chartTitle = `${metric.charAt(0).toUpperCase() + metric.slice(1)} Range`;

  return (
    <div
      style={{
        marginBottom: '20px',
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(0,255,0,0.1)',
        borderRadius: '4px',
        padding: '8px',
      }}
    >
      {/* Metric title */}
      <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px' }}>
        {chartTitle}
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="label"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 9, fill: '#666' }}
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#666' }}
              label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft', fontSize: 9 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '4px',
                color: '#fff',
              }}
              formatter={(value) => {
                if (typeof value === 'number') {
                  return `${value.toFixed(2)}s`;
                }
                return '';
              }}
              labelStyle={{ color: '#888' }}
            />
            <Bar
              dataKey="duration"
              fill={METRIC_COLORS[metric]}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ color: '#666', fontSize: '11px', height: '200px', display: 'flex', alignItems: 'center' }}>
          No data available
        </div>
      )}
    </div>
  );
});

export function HistogramChart({ sessions, isSingleSession }: HistogramChartProps) {
  const { state, toggleHistogramMetric, toggleHistogramDisplayMode } = useViewState();

  // Determine display mode: 'individual' (default) or 'mean' if 'meanStddev' is selected
  const displayMode: 'individual' | 'mean' = state.histogramDisplayModes.has('meanStddev')
    ? 'mean'
    : 'individual';

  // For single session, always show deviation; for aggregate, use selected metrics from state
  const metricsToShow: HistogramMetric[] = isSingleSession
    ? ['deviation']
    : Array.from(state.histogramMetrics) as HistogramMetric[];

  // Calculate histogram data for each metric
  const histogramDataMap = new Map<HistogramMetric, HistogramBin[]>();
  for (const metric of metricsToShow) {
    const data = isSingleSession && sessions.length > 0
      ? calculateSessionHistogram(sessions[0], metric)
      : calculateAggregateHistogram(sessions, metric, displayMode);
    histogramDataMap.set(metric, data);
  }

  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(0,255,0,0.2)',
        borderRadius: '4px',
        width: '100%',
      }}
    >
      {/* Header with title */}
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px' }}>
        Duration Distribution by Metric
      </div>

      {/* Metric Checkboxes - only for aggregate view */}
      {!isSingleSession && (
        <div style={{ marginBottom: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '10px', color: '#aaa' }}>Metrics:</label>
          {(['deviation', 'x', 'y', 'rotation'] as const).map((metric) => (
            <label
              key={metric}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                color: '#aaa',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={state.histogramMetrics.has(metric)}
                onChange={() => toggleHistogramMetric(metric)}
                style={{ cursor: 'pointer' }}
              />
              {metric.charAt(0).toUpperCase() + metric.slice(1)}
            </label>
          ))}
        </div>
      )}

      {/* Display Mode Selector - only for aggregate view */}
      {!isSingleSession && (
        <div style={{ marginBottom: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '10px', color: '#aaa' }}>Mode:</label>
          {(['individual', 'meanStddev'] as const).map((mode) => (
            <label
              key={mode}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                color: '#aaa',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={state.histogramDisplayModes.has(mode)}
                onChange={() => toggleHistogramDisplayMode(mode)}
                style={{ cursor: 'pointer' }}
              />
              {mode === 'meanStddev' ? 'Mean & Stddev' : 'Individual'}
            </label>
          ))}
        </div>
      )}

      {/* Render histograms for each selected metric */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {metricsToShow.length > 0 ? (
          metricsToShow.map((metric) => (
            <HistogramBar
              key={metric}
              metric={metric}
              data={histogramDataMap.get(metric) || []}
            />
          ))
        ) : (
          <div style={{ color: '#666', fontSize: '12px', padding: '20px' }}>
            No metrics selected
          </div>
        )}
      </div>
    </div>
  );
}
