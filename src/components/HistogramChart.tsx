import { useState } from 'react';
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
} from '../utils/histogram';

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

export function HistogramChart({ sessions, isSingleSession }: HistogramChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<HistogramMetric>('deviation');
  const [displayMode, setDisplayMode] = useState<'mean' | 'individual'>('individual');

  // Calculate histogram based on view mode
  const histogramData = isSingleSession
    ? calculateSessionHistogram(sessions[0], selectedMetric)
    : calculateAggregateHistogram(sessions, selectedMetric, displayMode);

  // Prepare data for recharts
  const chartData = histogramData.map((bin) => ({
    label: bin.label,
    duration: parseFloat(bin.duration.toFixed(2)),
  }));

  const chartTitle = isSingleSession
    ? `Session Duration by ${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Range`
    : `Combined Duration by ${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Range`;

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
        {chartTitle}
      </div>

      {/* Metric Selector */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '10px', color: '#aaa' }}>Metric:</label>
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
              type="radio"
              name="metric"
              value={metric}
              checked={selectedMetric === metric}
              onChange={() => setSelectedMetric(metric)}
              style={{ cursor: 'pointer' }}
            />
            {metric.charAt(0).toUpperCase() + metric.slice(1)}
          </label>
        ))}
      </div>

      {/* Display Mode Selector - only for aggregate view */}
      {!isSingleSession && (
        <div style={{ marginBottom: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '10px', color: '#aaa' }}>Mode:</label>
          {(['individual', 'mean'] as const).map((mode) => (
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
                type="radio"
                name="displayMode"
                value={mode}
                checked={displayMode === mode}
                onChange={() => setDisplayMode(mode)}
                style={{ cursor: 'pointer' }}
              />
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </label>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 0, bottom: 50 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="label"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 10, fill: '#888' }}
            />
            <YAxis
              label={{ value: 'Duration (seconds)', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 10, fill: '#888' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '4px',
                color: '#fff',
              }}
              formatter={(value: any) => {
                if (typeof value === 'number') {
                  return `${value.toFixed(2)}s`;
                }
                return `${value}s`;
              }}
              labelStyle={{ color: '#888' }}
            />
            <Bar
              dataKey="duration"
              fill={METRIC_COLORS[selectedMetric]}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ color: '#666', fontSize: '12px', height: '250px', display: 'flex', alignItems: 'center' }}>
          No data available
        </div>
      )}
    </div>
  );
}
