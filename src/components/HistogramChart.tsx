import { memo, useMemo } from 'react';
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
  calculateBoxPlotData,
  HistogramMetric,
  HistogramBin,
  HistogramBinWithSessions,
  BoxPlotData,
} from '../utils/histogram';
import { TimeSeries } from '../types';
import { useViewState, type ViewState } from '../hooks/useViewState';

/**
 * Represents aggregated histogram data for a single bin with coverage tracking
 */
export interface BinData {
  binRange: string; // e.g., "0-1"
  binStart: number;
  binEnd: number;
  values: number[]; // All values in this bin across all measurements
  coverage: number; // Percentage of measurements with data in this bin
  count: number; // n value in this bin (number of measurements with data)
  totalMeasurements: number;
}

/**
 * Get metric value from a TimeSeries data point
 */
function getMetricValue(point: TimeSeries, metric: HistogramMetric): number {
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

/**
 * Aggregate histogram data from sessions with coverage tracking
 * Transforms session time series data into bins, tracking which measurements
 * have data in each bin for coverage calculation
 * @param sessions Array of sessions to aggregate
 * @param metric Which metric to analyze (deviation, x, y, rotation)
 * @param binSize Size of each bin (default 1)
 * @returns Array of BinData with coverage tracking
 */
export function aggregateHistogramData(
  sessions: Session[],
  metric: HistogramMetric,
  binSize: number = 1
): BinData[] {
  const bins: Map<string, number[]> = new Map();
  const measurementsWithDataInBin: Map<string, Set<string>> = new Map();
  const totalMeasurements = sessions.length;

  // Iterate through sessions and place values in bins
  sessions.forEach((session) => {
    const sessionMeasuredBins = new Set<string>();

    session.timeSeries.forEach((ts) => {
      const value = getMetricValue(ts, metric);
      const binIndex = Math.floor(value / binSize);
      const binStart = binIndex * binSize;
      const binEnd = binStart + binSize;
      const binKey = `${binStart}-${binEnd}`;

      if (!bins.has(binKey)) {
        bins.set(binKey, []);
      }
      bins.get(binKey)!.push(value);
      sessionMeasuredBins.add(binKey);
    });

    // Track which measurements contributed to each bin
    sessionMeasuredBins.forEach((binKey) => {
      if (!measurementsWithDataInBin.has(binKey)) {
        measurementsWithDataInBin.set(binKey, new Set());
      }
      measurementsWithDataInBin.get(binKey)!.add(session.sessionId);
    });
  });

  // Convert to sorted array of BinData
  const result: BinData[] = Array.from(bins.entries())
    .map(([binKey, values]) => {
      const [binStart, binEnd] = binKey.split('-').map(Number);
      const count = measurementsWithDataInBin.get(binKey)?.size || 0;
      const coverage = (count / totalMeasurements) * 100;

      return {
        binRange: binKey,
        binStart,
        binEnd,
        values,
        coverage,
        count,
        totalMeasurements,
      };
    })
    .sort((a, b) => a.binStart - b.binStart);

  return result;
}

export interface HistogramChartProps {
  sessions: Session[];
  isSingleSession: boolean;
  viewState?: ReturnType<typeof useViewState>;
}

// Metric colors matching TimeSeriesGraph
const METRIC_COLORS: Record<HistogramMetric, string> = {
  deviation: '#00FFFF',  // bright cyan
  x: '#FF00FF',          // magenta
  y: '#FF9500',          // orange
  rotation: '#FFC107',   // gold
};

/**
 * Custom box plot shape component that renders boxes with whiskers
 */
function BoxPlotShape(props: any) {
  const { x, y, width, height, payload } = props;

  if (!payload) return null;

  const data = payload;
  const color = METRIC_COLORS[data.metric as HistogramMetric];

  // Calculate y positions based on data values
  // We need to map data values to pixel positions
  // Assuming y-axis goes from 0 to some max value
  const chartHeight = 160; // approximate chart content height
  const yAxisMax = 50; // approximate max y value (will be dynamic)

  const getYPos = (value: number): number => {
    return y + height - (value / yAxisMax) * chartHeight;
  };

  const minY = getYPos(data.min);
  const q1Y = getYPos(data.q1);
  const medianY = getYPos(data.median);
  const q3Y = getYPos(data.q3);
  const maxY = getYPos(data.max);

  const boxWidth = width * 0.6;
  const boxX = x + width / 2 - boxWidth / 2;

  const elements = [];

  // Whisker lines (min to max)
  elements.push(
    <line
      key="whisker-line"
      x1={x + width / 2}
      y1={minY}
      x2={x + width / 2}
      y2={maxY}
      stroke={color}
      strokeWidth={1}
      opacity={1}
    />
  );

  // Whisker caps
  elements.push(
    <line
      key="whisker-min-cap"
      x1={boxX + boxWidth * 0.2}
      y1={minY}
      x2={boxX + boxWidth * 0.8}
      y2={minY}
      stroke={color}
      strokeWidth={1}
      opacity={1}
    />,
    <line
      key="whisker-max-cap"
      x1={boxX + boxWidth * 0.2}
      y1={maxY}
      x2={boxX + boxWidth * 0.8}
      y2={maxY}
      stroke={color}
      strokeWidth={1}
      opacity={1}
    />
  );

  // Q1-Q3 box
  elements.push(
    <rect
      key="box"
      x={boxX}
      y={Math.min(q1Y, q3Y)}
      width={boxWidth}
      height={Math.abs(q3Y - q1Y)}
      fill={color}
      fillOpacity={1}
      stroke={color}
      strokeWidth={1.5}
    />
  );

  // Median line (bold)
  elements.push(
    <line
      key="median"
      x1={boxX}
      y1={medianY}
      x2={boxX + boxWidth}
      y2={medianY}
      stroke={color}
      strokeWidth={2}
    />
  );

  // Outliers as dots
  if (data.outliers && data.outliers.length > 0) {
    data.outliers.forEach((outlier: number, idx: number) => {
      const outlierY = getYPos(outlier);
      elements.push(
        <circle
          key={`outlier-${idx}`}
          cx={x + width / 2}
          cy={outlierY}
          r={3}
          fill={color}
          fillOpacity={1}
        />
      );
    });
  }

  return <g>{elements}</g>;
}

/**
 * Renders a box plot visualization for Mean & Std Dev mode
 */
function renderBoxPlot(
  boxData: BoxPlotData[],
  metric: HistogramMetric,
  chartTitle: string
) {
  if (boxData.length === 0) {
    return (
      <div style={{ color: '#666', fontSize: '11px', height: '200px', display: 'flex', alignItems: 'center' }}>
        No data available
      </div>
    );
  }

  // Add metric info to box data for shape rendering
  const chartData = boxData.map((item) => ({
    ...item,
    metric,
    duration: item.median, // For chart baseline
  }));

  const color = METRIC_COLORS[metric];

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 20, left: 40, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="label"
          angle={-45}
          textAnchor="end"
          height={60}
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
          labelStyle={{ color: '#888' }}
          formatter={(value) => {
            if (typeof value === 'number') {
              return `${value.toFixed(2)}s`;
            }
            return '';
          }}
          content={({ payload }) => {
            if (!payload || payload.length === 0) return null;
            const data = payload[0].payload;
            return (
              <div
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '8px',
                  fontSize: '11px',
                }}
              >
                <div>{data.label}</div>
                <div>Min: {data.min.toFixed(2)}s</div>
                <div>Q1: {data.q1.toFixed(2)}s</div>
                <div>Median: {data.median.toFixed(2)}s</div>
                <div>Q3: {data.q3.toFixed(2)}s</div>
                <div>Max: {data.max.toFixed(2)}s</div>
                {data.outliers && data.outliers.length > 0 && (
                  <div>Outliers: {data.outliers.map((o: number) => o.toFixed(2)).join(', ')}</div>
                )}
              </div>
            );
          }}
        />
        <Bar
          dataKey="duration"
          fill="transparent"
          shape={(props: any) => <BoxPlotShape {...props} />}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Custom bar shape that renders individual session lines
 */
function createCustomBarShape(
  metric: HistogramMetric,
  showIndividualLines: boolean
) {
  return (props: any) => {
    const { x, y, width, height, payload } = props;

    if (!payload) return null;

    const elements = [];

    // Draw individual session lines if available
    if (showIndividualLines && payload.sessionDurations && payload.sessionDurations.length > 0) {
      const totalDuration = payload.duration;
      let accumulatedHeight = 0;

      payload.sessionDurations.forEach((sd: { sessionId: string; duration: number }, idx: number) => {
        const lineHeight = (sd.duration / totalDuration) * height;
        const lineY = y + height - accumulatedHeight - lineHeight;

        elements.push(
          <line
            key={`session-${idx}`}
            x1={x + width * 0.15}
            y1={lineY + lineHeight / 2}
            x2={x + width * 0.85}
            y2={lineY + lineHeight / 2}
            stroke="#999999"
            strokeOpacity={0.4}
            strokeWidth={1}
          />
        );

        accumulatedHeight += lineHeight;
      });
    }

    // Draw the main bar
    elements.push(
      <rect
        key="bar"
        x={x}
        y={y}
        width={width}
        height={height}
        fill={METRIC_COLORS[metric]}
        rx={3}
        ry={3}
      />
    );

    return <g>{elements}</g>;
  };
}

/**
 * Helper component to render a single metric's histogram
 */
const HistogramBar = memo(function HistogramBar({
  metric,
  data,
  displayModes,
  isSingleSession,
  sessions,
}: {
  metric: HistogramMetric;
  data: HistogramBin[] | HistogramBinWithSessions[];
  displayModes: Set<'individual' | 'meanStddev'>;
  isSingleSession: boolean;
  sessions: Session[];
}) {
  // Check if data contains session info (only in aggregate mode)
  const hasSessionInfo = !isSingleSession && data.length > 0 && 'sessionDurations' in data[0];
  const showIndividualLines = !isSingleSession && displayModes.has('individual');
  const showMeanStddev = !isSingleSession && displayModes.has('meanStddev');

  const chartData = useMemo(() => {
    return data.map((bin) => ({
      label: bin.label,
      duration: parseFloat(bin.duration.toFixed(2)),
      sessionDurations: hasSessionInfo && 'sessionDurations' in bin
        ? (bin as HistogramBinWithSessions).sessionDurations
        : [],
    }));
  }, [data, hasSessionInfo]);

  // Calculate box plot data for Mean & Std Dev mode
  const boxPlotData = useMemo(() => {
    if (!isSingleSession && showMeanStddev && sessions.length > 0) {
      return calculateBoxPlotData(sessions, metric);
    }
    return [];
  }, [isSingleSession, showMeanStddev, sessions, metric]);

  const chartTitle = `${metric.charAt(0).toUpperCase() + metric.slice(1)} Range`;

  // Create custom bar shape only if needed
  const barShape = useMemo(
    () => showIndividualLines && hasSessionInfo ? createCustomBarShape(metric, showIndividualLines) : undefined,
    [showIndividualLines, hasSessionInfo, metric]
  );

  // Determine what to render based on display modes
  // Both modes enabled: render individual + box plot overlay
  // Only Individual: render individual mode
  // Only Mean & Std Dev: render box plot
  // Neither: render default bar chart
  const shouldRenderIndividual = showIndividualLines;
  const shouldRenderBoxPlot = showMeanStddev && boxPlotData.length > 0;

  // If only rendering box plot (Mean & Std Dev mode alone)
  if (!isSingleSession && shouldRenderBoxPlot && !shouldRenderIndividual) {
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
        {renderBoxPlot(boxPlotData, metric, chartTitle)}
      </div>
    );
  }

  // Render normal bar chart (with optional individual lines overlay when enabled)
  // This covers: individual only, both modes together, or neither mode
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
        <div style={{ position: 'relative' }}>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 40, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="label"
                angle={-45}
                textAnchor="end"
                height={60}
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
                shape={barShape}
              />
            </BarChart>
          </ResponsiveContainer>
          {/* Overlay box plot if both modes are enabled */}
          {shouldRenderBoxPlot && shouldRenderIndividual && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              {renderBoxPlot(boxPlotData, metric, chartTitle)}
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: '#666', fontSize: '11px', height: '200px', display: 'flex', alignItems: 'center' }}>
          No data available
        </div>
      )}
    </div>
  );
});

export function HistogramChart({ sessions, isSingleSession, viewState: passedViewState }: HistogramChartProps) {
  // Use passed viewState if provided (from UnifiedSessionPanel), otherwise create our own
  const defaultViewState = useViewState();
  const { state, toggleHistogramMetric, toggleHistogramDisplayMode } = passedViewState || defaultViewState;

  // For single session, always show deviation; for aggregate, use selected metrics from state
  const metricsToShow: HistogramMetric[] = isSingleSession
    ? ['deviation']
    : Array.from(state.histogramMetrics) as HistogramMetric[];

  // Determine display mode for histogram calculation
  // When 'individual' is enabled, calculate individual mode data (with session tracking)
  // When 'meanStddev' is enabled, calculate mean mode data
  const shouldShowIndividualMode = state.histogramDisplayModes.has('individual');
  const displayMode: 'individual' | 'mean' = shouldShowIndividualMode ? 'individual' : 'mean';

  // Calculate histogram data for each metric
  const histogramDataMap = new Map<HistogramMetric, HistogramBin[] | HistogramBinWithSessions[]>();
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
              displayModes={state.histogramDisplayModes}
              isSingleSession={isSingleSession}
              sessions={sessions}
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
