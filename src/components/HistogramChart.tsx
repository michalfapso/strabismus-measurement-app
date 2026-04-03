import { memo, useMemo } from 'react';
import { css } from '@emotion/react';
import { Session } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
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
import { calculateQuartiles, calculateWhiskers, identifyOutliers } from '../utils/chartUtils';
import { TimeSeries } from '../types';
import { useViewState, type ViewState } from '../hooks/useViewState';
import { metricButtonStyle } from '../styles/chartControlsStyles';

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
 * Represents box plot elements for rendering
 */
export interface BoxPlotElements {
  type: 'full' | 'minmax' | 'line';
  median?: number;
  q1?: number;
  q3?: number;
  min?: number;
  max?: number;
  whiskerLower?: number;
  whiskerUpper?: number;
  outliers?: number[];
  value?: number; // for single value case
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
 * Calculate box plot elements based on degenerate case handling
 * Handles n=0 (line at 0), n=1 (single line), n=2 (minmax line), n>=3 (full box plot)
 */
function calcBoxPlotElements(
  values: number[],
  quartiles: ReturnType<typeof calculateQuartiles> | null,
  whiskers: ReturnType<typeof calculateWhiskers> | null
): BoxPlotElements {
  if (values.length === 0) {
    return { type: 'line', value: 0 };
  }

  if (values.length === 1) {
    return { type: 'line', value: values[0] };
  }

  if (values.length === 2 && quartiles) {
    return {
      type: 'minmax',
      median: quartiles.median,
      min: quartiles.min,
      max: quartiles.max,
    };
  }

  // n >= 3: full box plot
  if (quartiles && whiskers) {
    const outliers = identifyOutliers(values, whiskers);
    return {
      type: 'full',
      median: quartiles.median,
      q1: quartiles.q1,
      q3: quartiles.q3,
      whiskerLower: whiskers.lower,
      whiskerUpper: whiskers.upper,
      outliers,
    };
  }

  return { type: 'line', value: 0 };
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

/**
 * Custom tooltip component for box plot displays
 * Shows coverage percentage and measurement count
 */
function BoxPlotTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: {
      coverage: number;
      count: number;
      totalMeasurements: number;
    };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const { coverage, count, totalMeasurements } = payload[0]?.payload || {};

  return (
    <div
      css={css`
        background-color: rgba(0, 0, 0, 0.8);
        padding: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      `}
    >
      <p css={css`margin: 0; color: #fff; font-size: 12px;`}>
        {coverage.toFixed(0)}% of measurements
      </p>
      <p css={css`margin: 4px 0 0 0; color: #ccc; font-size: 11px;`}>
        n={count} of {totalMeasurements}
      </p>
    </div>
  );
}

export interface HistogramChartProps {
  sessions: Session[];
  isSingleSession: boolean;
  viewState?: ReturnType<typeof useViewState>;
  /** When provided in single-session mode, overrides the default 'deviation' metric */
  metric?: HistogramMetric;
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
 * Renders a box plot chart using aggregateHistogramData and ComposedChart
 * Handles degenerate cases and shows coverage labels
 */
function renderAggregateBoxPlots(
  sessions: Session[],
  metric: HistogramMetric
) {
  if (sessions.length === 0) {
    return (
      <div style={{ color: '#666', fontSize: '11px', height: '200px', display: 'flex', alignItems: 'center' }}>
        No data available
      </div>
    );
  }

  // Get aggregated histogram data with coverage tracking
  const binData = aggregateHistogramData(sessions, metric, 1);

  if (binData.length === 0) {
    return (
      <div style={{ color: '#666', fontSize: '11px', height: '200px', display: 'flex', alignItems: 'center' }}>
        No data available
      </div>
    );
  }

  const color = METRIC_COLORS[metric];

  // Prepare chart data with box plot calculations
  const chartData = binData.map((bin) => {
    const quartiles = calculateQuartiles(bin.values);
    const whiskers = quartiles ? calculateWhiskers(quartiles) : null;
    const boxPlot = calcBoxPlotElements(bin.values, quartiles, whiskers);

    return {
      binRange: bin.binRange,
      binStart: bin.binStart,
      binEnd: bin.binEnd,
      coverage: bin.coverage,
      count: bin.count,
      totalMeasurements: bin.totalMeasurements,
      ...boxPlot,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart
        data={chartData}
        margin={{ top: 5, right: 20, left: 40, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="binRange"
          tick={{ fontSize: 9, fill: '#666' }}
        />
        <YAxis
          label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft', fontSize: 9 }}
          tick={{ fontSize: 9, fill: '#666' }}
        />

        {/* Whiskers - for full box plots (n >= 3) */}
        <Line
          dataKey="whiskerLower"
          stroke={color}
          dot={false}
          isAnimationActive={false}
          strokeWidth={1}
        />
        <Line
          dataKey="whiskerUpper"
          stroke={color}
          dot={false}
          isAnimationActive={false}
          strokeWidth={1}
        />

        {/* Median line */}
        <Line
          dataKey="median"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />

        {/* Min/Max for degenerate cases */}
        <Line
          dataKey="min"
          stroke={color}
          strokeWidth={1}
          dot={false}
          isAnimationActive={false}
          opacity={0.5}
        />
        <Line
          dataKey="max"
          stroke={color}
          strokeWidth={1}
          dot={false}
          isAnimationActive={false}
          opacity={0.5}
        />

        {/* Single value line for n=1 case */}
        <Line
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />

        {/* Outliers as scatter points */}
        <Scatter
          dataKey="outliers"
          fill={color}
          isAnimationActive={false}
        />

        <Tooltip
          content={<BoxPlotTooltip />}
          cursor={{ fill: 'rgba(255, 255, 255, 0.3)' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
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
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '4px',
          padding: '8px',
        }}
      >
        {/* Metric title */}
        <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px' }}>
          {chartTitle}
        </div>
        {renderAggregateBoxPlots(sessions, metric)}
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
        border: '1px solid rgba(255,255,255,0.1)',
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
              {renderAggregateBoxPlots(sessions, metric)}
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

export function HistogramChart({ sessions, isSingleSession, viewState: passedViewState, metric: metricOverride }: HistogramChartProps) {
  // Use passed viewState if provided (from UnifiedSessionPanel), otherwise create our own
  const defaultViewState = useViewState();
  const { state, toggleHistogramMetric, toggleHistogramDisplayMode } = passedViewState || defaultViewState;

  // For single session, use metricOverride if provided, otherwise default to deviation
  // For aggregate, use selected metrics from state
  const metricsToShow: HistogramMetric[] = isSingleSession
    ? [metricOverride ?? 'deviation']
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
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '4px',
        width: '100%',
      }}
    >
      {/* Header with title */}
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px' }}>
        Duration Distribution by Metric
      </div>

      {/* Metric Buttons - only for aggregate view */}
      {!isSingleSession && (
        <div style={{ marginBottom: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '10px', color: '#aaa' }}>Metrics:</label>
          {(['deviation', 'x', 'y', 'rotation'] as const).map((metric) => (
            <button
              key={metric}
              css={metricButtonStyle}
              data-active={state.histogramMetrics.has(metric)}
              onClick={() => toggleHistogramMetric(metric)}
              style={{
                fontSize: '10px',
                color: '#aaa',
              }}
            >
              {metric.charAt(0).toUpperCase() + metric.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Display Mode Selector - only for aggregate view */}
      {!isSingleSession && (
        <div style={{ marginBottom: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '10px', color: '#aaa' }}>Mode:</label>
          {(['individual', 'meanStddev'] as const).map((mode) => (
            <button
              key={mode}
              css={metricButtonStyle}
              data-active={state.histogramDisplayModes.has(mode)}
              onClick={() => toggleHistogramDisplayMode(mode)}
              style={{
                fontSize: '10px',
                color: '#aaa',
              }}
            >
              {mode === 'meanStddev' ? 'Mean & Stddev' : 'Individual'}
            </button>
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
