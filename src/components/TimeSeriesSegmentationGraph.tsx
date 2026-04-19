import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { css } from '@emotion/react';
import { Session, TimeSeries } from '../types';
import { StateSegment, SessionState } from '../types/analysis';
import { classifyStates } from '../utils/sessionMetrics';
import { smoothSeries } from '../utils/smoothing';
import { THEME } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type MetricType = 'deviation' | 'x' | 'y' | 'rotation';

export interface TimeSeriesSegmentationGraphProps {
  session: Session;
  metrics: MetricType[];
  thresholds: {
    deviation?: number;
    x?: number;
    y?: number;
    rotation?: number;
  };
}

interface MetricDataset {
  metric: MetricType;
  rawValues: number[];
  smoothedValues: number[];
  smoothedValuesLong: number[];  // Longer window smoothing (for debug visualization)
  segments: StateSegment[];
  timeAxis: number[]; // seconds from session start
  min: number;
  max: number;
}

interface HoverState {
  time: number; // seconds
  clientX: number;
  clientY: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METRIC_COLORS: Record<MetricType, string> = {
  deviation: THEME.metricDeviation,
  x: THEME.metricX,
  y: THEME.metricY,
  rotation: THEME.metricRotation,
};

const METRIC_LABELS: Record<MetricType, string> = {
  deviation: 'Deviation (cm)',
  x: 'X (cm)',
  y: 'Y (cm)',
  rotation: 'Rotation (°)',
};

const STATE_COLORS: Record<SessionState, string> = {
  FUSION: THEME.stateFusion,
  NEAR_FUSION: THEME.stateNearFusion,
  APPROACHING: THEME.stateApproaching,
  STABLE_DEVIATION: THEME.stateStableDeviation,
  DRIFTING: THEME.stateDrifting,
};

const STATE_LABELS: Record<SessionState, string> = {
  FUSION: 'Fusion',
  NEAR_FUSION: 'Near Fusion',
  APPROACHING: 'Approaching',
  STABLE_DEVIATION: 'Stable Deviation',
  DRIFTING: 'Drifting',
};

// Layout constants
const MARGIN = { top: 12, right: 20, bottom: 4, left: 52 };
const GRAPH_HEIGHT = 160; // px for data area
const SEG_STRIP_HEIGHT = 30; // px for segmentation strip
const XAXIS_HEIGHT = 24; // px for x-axis (only on last graph)
const BETWEEN_GAP = 18; // px between graphs

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMetricValue(point: TimeSeries, metric: MetricType): number {
  switch (metric) {
    case 'deviation':
      return Math.sqrt(point.x * point.x + point.y * point.y);
    case 'x':
      return point.x;
    case 'y':
      return point.y;
    case 'rotation':
      return Math.abs(point.r);  // consistent with FSM (sessionMetrics.ts)
  }
}

function lerp(t: number, t1: number, v1: number, t2: number, v2: number): number {
  if (t2 === t1) return v1;
  return v1 + ((t - t1) / (t2 - t1)) * (v2 - v1);
}

/** Find interpolated value at a given time (seconds) using raw data arrays. */
function interpolateAtTime(
  timeAxis: number[],
  values: number[],
  t: number
): number | null {
  if (timeAxis.length === 0) return null;
  if (t <= timeAxis[0]) return values[0];
  if (t >= timeAxis[timeAxis.length - 1]) return values[values.length - 1];

  for (let i = 0; i < timeAxis.length - 1; i++) {
    if (t >= timeAxis[i] && t <= timeAxis[i + 1]) {
      return lerp(t, timeAxis[i], values[i], timeAxis[i + 1], values[i + 1]);
    }
  }
  return null;
}

/** Find segment containing time t. */
function segmentAtTime(segments: StateSegment[], t: number): SessionState | null {
  for (const seg of segments) {
    if (t >= seg.startTime && t <= seg.endTime) return seg.state;
  }
  return null;
}

// ─── Data Preparation ─────────────────────────────────────────────────────────

function prepareMetricDataset(
  session: Session,
  metric: MetricType,
  threshold: number
): MetricDataset {
  const { timeSeries } = session;

  if (timeSeries.length === 0) {
    return { metric, rawValues: [], smoothedValues: [], smoothedValuesLong: [], segments: [], timeAxis: [], min: 0, max: 0 };
  }

  const t0 = timeSeries[0].t;
  const timeAxis = timeSeries.map((p) => (p.t - t0) / 1000);
  const rawValues = timeSeries.map((p) => getMetricValue(p, metric));

  let smoothedValues: number[];
  let smoothedValuesLong: number[];
  try {
    const windowSizeShort = Math.min(11, rawValues.length % 2 === 0 ? rawValues.length - 1 : rawValues.length);
    smoothedValues = windowSizeShort >= 3 ? smoothSeries(rawValues, windowSizeShort) : [...rawValues];
  } catch {
    smoothedValues = [...rawValues];
  }

  // Compute longer-window smoothing for visualization (longer window than short)
  try {
    const windowSizeLong = Math.min(51, rawValues.length % 2 === 0 ? Math.max(3, rawValues.length - 1) : Math.max(3, rawValues.length));
    smoothedValuesLong = windowSizeLong >= 3 ? smoothSeries(rawValues, windowSizeLong) : [...rawValues];
  } catch {
    smoothedValuesLong = [...rawValues];
  }

  // classifyStates only supports 'deviation' | 'rotation' — for x/y we use deviation-style logic
  // We map x/y to the classifyStates call by passing the timeSeries as-is; it uses getMetricValue
  // internally. But its internal getMetricValue only handles 'deviation' | 'rotation'.
  // So for x/y we fall back to classifying with a local approach.
  let segments: StateSegment[];
  if (metric === 'deviation' || metric === 'rotation') {
    try {
      segments = classifyStates(timeSeries, threshold, metric);
    } catch {
      segments = [];
    }
  } else {
    // For x/y: perform classification inline using the same logic as classifyStates
    segments = classifyMetricStates(timeAxis, rawValues, smoothedValues, threshold);
  }

  const min = Math.min(...rawValues);
  const max = Math.max(...rawValues);

  return { metric, rawValues, smoothedValues, smoothedValuesLong, segments, timeAxis, min, max };
}

const SLOPE_THRESHOLD = 0.1;
const NEAR_FUSION_WIDTH = 1;
const MIN_SEGMENT_DURATION = 0.5;

function classifyMetricStates(
  timeAxis: number[],
  rawValues: number[],
  smoothedValues: number[],
  threshold: number
): StateSegment[] {
  if (rawValues.length < 2) return [];

  // Compute slopes from smoothed
  const slopes: number[] = smoothedValues.map((_, i) => {
    const start = Math.max(0, i - 5);
    const end = Math.min(smoothedValues.length - 1, i + 5);
    if (start === end) return 0;
    return (smoothedValues[end] - smoothedValues[start]) / (end - start);
  });

  const halfWindow = 5;
  const classifications: SessionState[] = rawValues.map((raw, i) => {
    const value = (i < halfWindow || i >= rawValues.length - halfWindow)
      ? raw
      : smoothedValues[i];
    const slope = slopes[i] ?? 0;
    if (value < threshold) return 'FUSION';
    if (value < threshold + NEAR_FUSION_WIDTH) return 'NEAR_FUSION';
    if (slope < -SLOPE_THRESHOLD) return 'APPROACHING';
    if (slope > SLOPE_THRESHOLD) return 'DRIFTING';
    return 'STABLE_DEVIATION';
  });

  const segments: StateSegment[] = [];
  let segStart = 0;

  for (let i = 1; i <= rawValues.length; i++) {
    const isLast = i === rawValues.length;
    if (isLast || classifications[i] !== classifications[segStart]) {
      const startTime = timeAxis[segStart];
      const endTime = isLast ? timeAxis[rawValues.length - 1] : timeAxis[i];
      const duration = endTime - startTime;
      if (duration >= MIN_SEGMENT_DURATION) {
        segments.push({ state: classifications[segStart], startTime, endTime, duration });
      }
      segStart = i;
    }
  }

  return segments;
}

// ─── SVG Graph ────────────────────────────────────────────────────────────────

interface MetricGraphProps {
  data: MetricDataset;
  totalDuration: number; // seconds (shared x-axis domain)
  svgWidth: number; // actual px width available
  isLast: boolean; // show x-axis tick labels
  hoveredTime: number | null;
  threshold: number;
  onHoverMove: (time: number | null) => void;
}

function MetricGraph({ data, totalDuration, svgWidth, isLast, hoveredTime, threshold, onHoverMove }: MetricGraphProps) {
  const { metric, rawValues, smoothedValues, segments, timeAxis } = data;

  const innerWidth = svgWidth - MARGIN.left - MARGIN.right;
  const innerHeight = GRAPH_HEIGHT;
  const totalSvgHeight = MARGIN.top + GRAPH_HEIGHT + SEG_STRIP_HEIGHT + (isLast ? XAXIS_HEIGHT : MARGIN.bottom);

  const color = METRIC_COLORS[metric];

  // Y-scale: add a little padding
  const rawMin = data.min;
  const rawMax = data.max;
  const yPad = (rawMax - rawMin) * 0.1 || 0.5;
  const yDomain: [number, number] = [rawMin - yPad, rawMax + yPad];

  function xScale(t: number): number {
    if (totalDuration === 0) return MARGIN.left;
    return MARGIN.left + (t / totalDuration) * innerWidth;
  }

  function yScale(v: number): number {
    const [yMin, yMax] = yDomain;
    if (yMax === yMin) return MARGIN.top + innerHeight / 2;
    return MARGIN.top + innerHeight - ((v - yMin) / (yMax - yMin)) * innerHeight;
  }

  // Build polyline points strings
  const rawPoints = timeAxis
    .map((t, i) => `${xScale(t).toFixed(1)},${yScale(rawValues[i]).toFixed(1)}`)
    .join(' ');

  const smoothedPoints = timeAxis
    .map((t, i) => `${xScale(t).toFixed(1)},${yScale(smoothedValues[i]).toFixed(1)}`)
    .join(' ');

  const longSmoothPoints = timeAxis
    .map((t, i) => {
      const x = xScale(t);
      const y = yScale(data.smoothedValuesLong[i]);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Grid lines
  const yTickCount = 4;
  const yTicks: number[] = [];
  for (let i = 0; i <= yTickCount; i++) {
    yTicks.push(yDomain[0] + (i / yTickCount) * (yDomain[1] - yDomain[0]));
  }

  // X ticks (time, seconds)
  const xTickInterval = totalDuration <= 30 ? 5 : totalDuration <= 120 ? 10 : 30;
  const xTicks: number[] = [];
  for (let t = 0; t <= totalDuration; t += xTickInterval) {
    xTicks.push(t);
  }
  if (xTicks[xTicks.length - 1] < totalDuration) xTicks.push(totalDuration);

  // Segmentation strip Y start
  const stripY = MARGIN.top + innerHeight;

  // Hover line x
  const hoverX = hoveredTime !== null ? xScale(hoveredTime) : null;

  // Mouse event handler
  // Note: getBoundingClientRect() of the capture rect already accounts for MARGIN.left,
  // so we do NOT subtract MARGIN.left again here.
  const handleMouseEvent = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      if (relX < 0 || relX > innerWidth) {
        onHoverMove(null);
        return;
      }
      const t = (relX / innerWidth) * totalDuration;
      onHoverMove(Math.max(0, Math.min(totalDuration, t)));
    },
    [innerWidth, totalDuration, onHoverMove]
  );

  const handleMouseLeave = useCallback(() => onHoverMove(null), [onHoverMove]);

  if (rawValues.length === 0) {
    return (
      <svg width={svgWidth} height={totalSvgHeight} css={css`display: block;`}>
        <text x={svgWidth / 2} y={totalSvgHeight / 2} fill={THEME.textSecondary} textAnchor="middle" fontSize={12}>
          No data
        </text>
      </svg>
    );
  }

  return (
    <svg
      width={svgWidth}
      height={totalSvgHeight}
      css={css`display: block; overflow: visible;`}
    >
      {/* Y-axis grid lines + ticks */}
      {yTicks.map((tick, i) => {
        const y = yScale(tick);
        return (
          <g key={i}>
            <line
              x1={MARGIN.left}
              y1={y}
              x2={MARGIN.left + innerWidth}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 6}
              y={y + 4}
              fill={THEME.textSecondary}
              fontSize={9}
              textAnchor="end"
            >
              {tick.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Y-axis label */}
      <text
        x={10}
        y={MARGIN.top + innerHeight / 2}
        fill={THEME.textSecondary}
        fontSize={9}
        textAnchor="middle"
        transform={`rotate(-90, 10, ${MARGIN.top + innerHeight / 2})`}
      >
        {METRIC_LABELS[metric]}
      </text>

      {/* X-axis line */}
      <line
        x1={MARGIN.left}
        y1={MARGIN.top + innerHeight}
        x2={MARGIN.left + innerWidth}
        y2={MARGIN.top + innerHeight}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
      />

      {/* X-axis ticks */}
      {xTicks.map((t) => {
        const x = xScale(t);
        return (
          <g key={t}>
            <line
              x1={x}
              y1={MARGIN.top + innerHeight}
              x2={x}
              y2={MARGIN.top + innerHeight + SEG_STRIP_HEIGHT + (isLast ? 4 : 0)}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
            />
            {isLast && (
              <text
                x={x}
                y={MARGIN.top + innerHeight + SEG_STRIP_HEIGHT + 14}
                fill={THEME.textSecondary}
                fontSize={9}
                textAnchor="middle"
              >
                {t.toFixed(0)}s
              </text>
            )}
          </g>
        );
      })}

      {/* X-axis label (only last graph) */}
      {isLast && (
        <text
          x={MARGIN.left + innerWidth / 2}
          y={MARGIN.top + innerHeight + SEG_STRIP_HEIGHT + XAXIS_HEIGHT}
          fill={THEME.textSecondary}
          fontSize={9}
          textAnchor="middle"
        >
          Time (s)
        </text>
      )}

      {/* Smoothed line (dotted, 70% opacity) */}
      <polyline
        points={smoothedPoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="2,2"
        opacity={0.7}
      />

      {/* Long-window smoothed line (dotted, 40% opacity) */}
      <polyline
        points={longSmoothPoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="5,5"
        opacity={0.4}
      />

      {/* Raw line (solid) */}
      <polyline
        points={rawPoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        opacity={1}
      />

      {/* Threshold horizontal line */}
      {threshold !== undefined && threshold >= yDomain[0] && threshold <= yDomain[1] && (
        <g>
          <line
            x1={MARGIN.left}
            y1={yScale(threshold)}
            x2={MARGIN.left + innerWidth}
            y2={yScale(threshold)}
            stroke="rgba(200,200,200,0.45)"
            strokeWidth={1}
            strokeDasharray="5,4"
          />
          <text
            x={MARGIN.left + innerWidth - 2}
            y={yScale(threshold) - 3}
            fill="rgba(200,200,200,0.6)"
            fontSize={8}
            textAnchor="end"
          >
            threshold ({threshold})
          </text>
        </g>
      )}

      {/* Segmentation strip background (prevents unclassified gaps from showing black) */}
      <rect
        x={MARGIN.left}
        y={stripY}
        width={innerWidth}
        height={SEG_STRIP_HEIGHT}
        fill="rgba(40,40,40,0.8)"
        stroke="rgba(100,100,100,0.3)"
        strokeWidth="1"
      />

      {/* Segmentation strip */}
      {(() => {
        console.log(`Rendering ${segments.length} segments for metric ${metric}, totalDuration=${totalDuration.toFixed(2)}s, innerWidth=${innerWidth}px`);
        segments.forEach((seg, i) => {
          const startPixel = (seg.startTime / totalDuration) * innerWidth;
          const endPixel = (seg.endTime / totalDuration) * innerWidth;
          console.log(`Segment ${i}: ${seg.state} from ${seg.startTime.toFixed(2)}s to ${seg.endTime.toFixed(2)}s, pixels ${startPixel.toFixed(0)}-${endPixel.toFixed(0)}`);
        });
        // Check for gaps between consecutive segments
        for (let i = 1; i < segments.length; i++) {
          const gap = segments[i].startTime - segments[i - 1].endTime;
          if (gap > 0.01) {
            console.warn(`GAP between segment ${i-1} and ${i}: ${gap.toFixed(3)}s (${((gap / totalDuration) * innerWidth).toFixed(1)}px) — this will appear as background color`);
          }
        }
        // Check for gap at the start
        if (segments.length > 0 && segments[0].startTime > 0.01) {
          console.warn(`GAP at start: 0s to ${segments[0].startTime.toFixed(3)}s (${((segments[0].startTime / totalDuration) * innerWidth).toFixed(1)}px)`);
        }
        // Check for gap at the end
        if (segments.length > 0) {
          const lastSeg = segments[segments.length - 1];
          if (totalDuration - lastSeg.endTime > 0.01) {
            console.warn(`GAP at end: ${lastSeg.endTime.toFixed(3)}s to ${totalDuration.toFixed(3)}s (${(((totalDuration - lastSeg.endTime) / totalDuration) * innerWidth).toFixed(1)}px)`);
          }
        }
        return null;
      })()}
      {segments.map((seg, i) => {
        const x1 = xScale(seg.startTime);
        const x2 = xScale(seg.endTime);
        const w = Math.max(x2 - x1, 1);
        const showLabel = seg.duration > 2;
        return (
          <g key={i}>
            <rect
              x={x1}
              y={stripY}
              width={w}
              height={SEG_STRIP_HEIGHT}
              fill={STATE_COLORS[seg.state]}
              opacity={0.9}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="0.5"
            />
            {showLabel && w > 30 && (
              <text
                x={x1 + w / 2}
                y={stripY + SEG_STRIP_HEIGHT / 2 + 4}
                fill="rgba(255,255,255,0.9)"
                fontSize={9}
                textAnchor="middle"
                css={css`pointer-events: none;`}
              >
                {STATE_LABELS[seg.state]}
              </text>
            )}
          </g>
        );
      })}

      {/* Strip border */}
      <rect
        x={MARGIN.left}
        y={stripY}
        width={innerWidth}
        height={SEG_STRIP_HEIGHT}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={1}
      />

      {/* Hover vertical line */}
      {hoverX !== null && (
        <line
          x1={hoverX}
          y1={MARGIN.top}
          x2={hoverX}
          y2={MARGIN.top + innerHeight + SEG_STRIP_HEIGHT}
          stroke="rgba(255,255,255,0.7)"
          strokeWidth={1}
          strokeDasharray="3,3"
          css={css`pointer-events: none;`}
        />
      )}

      {/* Invisible mouse capture rect */}
      <rect
        x={MARGIN.left}
        y={MARGIN.top}
        width={innerWidth}
        height={innerHeight + SEG_STRIP_HEIGHT}
        fill="transparent"
        onMouseMove={handleMouseEvent}
        onMouseLeave={handleMouseLeave}
        css={css`cursor: crosshair;`}
      />
    </svg>
  );
}

// ─── Hover Popup ──────────────────────────────────────────────────────────────

interface HoverPopupProps {
  datasets: MetricDataset[];
  time: number;
  position: { x: number; y: number }; // relative to container
  containerWidth: number;
}

function HoverPopup({ datasets, time, position, containerWidth }: HoverPopupProps) {
  const POPUP_WIDTH = 200;
  // Flip to left when near right edge; clamp to 0 to avoid going off-screen left
  const left = Math.max(
    0,
    position.x + 12 + POPUP_WIDTH > containerWidth
      ? position.x - POPUP_WIDTH - 12
      : position.x + 12
  );

  return (
    <div
      css={css`
        position: absolute;
        top: ${position.y}px;
        left: ${left}px;
        background: rgba(15, 15, 15, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        padding: 8px 10px;
        font-size: 11px;
        pointer-events: none;
        z-index: 100;
        min-width: ${POPUP_WIDTH}px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      `}
    >
      <div css={css`color: ${THEME.textSecondary}; margin-bottom: 6px; font-size: 10px;`}>
        t = {time.toFixed(2)}s
      </div>
      {datasets.map((ds) => {
        const raw = interpolateAtTime(ds.timeAxis, ds.rawValues, time);
        const smoothedShort = interpolateAtTime(ds.timeAxis, ds.smoothedValues, time);
        const smoothedLong = interpolateAtTime(ds.timeAxis, ds.smoothedValuesLong, time);
        const state = segmentAtTime(ds.segments, time);
        const color = METRIC_COLORS[ds.metric];

        return (
          <div key={ds.metric} css={css`margin-bottom: 6px; &:last-child { margin-bottom: 0; }`}>
            <div css={css`color: ${color}; font-weight: bold; margin-bottom: 2px;`}>
              {METRIC_LABELS[ds.metric]}
            </div>
            <div css={css`color: ${THEME.textPrimary}; padding-left: 8px; line-height: 1.5;`}>
              <span css={css`color: ${THEME.textSecondary};`}>raw: </span>
              {raw !== null ? raw.toFixed(3) : '—'}
              <br />
              <span css={css`color: ${THEME.textSecondary};`}>smooth_short: </span>
              {smoothedShort !== null ? smoothedShort.toFixed(3) : '—'}
              <br />
              <span css={css`color: ${THEME.textSecondary};`}>smooth_long: </span>
              {smoothedLong !== null ? smoothedLong.toFixed(3) : '—'}
              <br />
              {state && (
                <>
                  <span css={css`color: ${THEME.textSecondary};`}>state: </span>
                  <span css={css`color: ${STATE_COLORS[state]};`}>{STATE_LABELS[state]}</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function SegmentationLegend() {
  const states: SessionState[] = ['FUSION', 'NEAR_FUSION', 'APPROACHING', 'STABLE_DEVIATION', 'DRIFTING'];
  return (
    <div
      css={css`
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 6px;
        padding: 6px 8px;
        border-top: 1px solid ${THEME.borderSecondary};
      `}
    >
      {states.map((state) => (
        <div key={state} css={css`display: flex; align-items: center; gap: 5px;`}>
          <div
            css={css`
              width: 14px;
              height: 10px;
              background-color: ${STATE_COLORS[state]};
              border-radius: 2px;
            `}
          />
          <span css={css`font-size: 10px; color: ${THEME.textSecondary};`}>
            {STATE_LABELS[state]}
          </span>
        </div>
      ))}
      <div css={css`display: flex; align-items: center; gap: 5px; margin-left: 8px;`}>
        <svg width="24" height="10" css={css`flex-shrink: 0;`}>
          <line x1="0" y1="5" x2="24" y2="5" stroke="rgba(180,180,180,0.8)" strokeWidth="1.5" />
        </svg>
        <span css={css`font-size: 10px; color: ${THEME.textSecondary};`}>Raw</span>
      </div>
      <div css={css`display: flex; align-items: center; gap: 5px;`}>
        <svg width="24" height="10" css={css`flex-shrink: 0;`}>
          <line x1="0" y1="5" x2="24" y2="5" stroke="rgba(180,180,180,0.8)" strokeWidth="1.5" strokeDasharray="4,4" />
        </svg>
        <span css={css`font-size: 10px; color: ${THEME.textSecondary};`}>Smoothed (short)</span>
      </div>
      <div css={css`display: flex; align-items: center; gap: 5px;`}>
        <svg width="24" height="10" css={css`flex-shrink: 0;`}>
          <line x1="0" y1="5" x2="24" y2="5" stroke="rgba(180,180,180,0.8)" strokeWidth="1.5" strokeDasharray="5,5" opacity={0.4} />
        </svg>
        <span css={css`font-size: 10px; color: ${THEME.textSecondary};`}>Smoothed (long)</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TimeSeriesSegmentationGraph({
  session,
  metrics,
  thresholds,
}: TimeSeriesSegmentationGraphProps) {
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  // Measure container width via ResizeObserver with proper cleanup
  useEffect(() => {
    if (!containerRef.current) return;
    // Immediately capture current width
    setContainerWidth(containerRef.current.getBoundingClientRect().width || 600);
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Prepare data for each metric (memoized)
  const metricDatasets = useMemo<MetricDataset[]>(
    () =>
      metrics.map((metric) => {
        const threshold = thresholds[metric] ?? 1.0;
        return prepareMetricDataset(session, metric, threshold);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.sessionId, metrics.join(','), JSON.stringify(thresholds)]
  );

  // Shared time domain
  const totalDuration = useMemo(() => {
    const { timeSeries } = session;
    if (timeSeries.length < 2) return 0;
    return (timeSeries[timeSeries.length - 1].t - timeSeries[0].t) / 1000;
  }, [session]);

  // Handle hover from any sub-graph. We track mouse relative to container for popup.
  const handleHover = useCallback(
    (time: number | null, graphIndex: number) => {
      if (time === null) {
        setHoveredTime(null);
        return;
      }
      setHoveredTime(time);

      // Compute popup position relative to container
      if (containerRef.current) {
        // Popup x: pixel from left of inner area
        const innerWidth = containerWidth - MARGIN.left - MARGIN.right;
        const relX = MARGIN.left + (time / (totalDuration || 1)) * innerWidth;

        // Popup y: offset by graph heights stacked above current graphIndex.
        // The last graph has XAXIS_HEIGHT instead of MARGIN.bottom at the bottom, which
        // shifts the popup down unless explicitly accounted for.
        const isLastGraph = graphIndex === metricDatasets.length - 1;
        const bottomPadding = isLastGraph ? XAXIS_HEIGHT : MARGIN.bottom;
        const graphTotalH = GRAPH_HEIGHT + SEG_STRIP_HEIGHT + MARGIN.top + MARGIN.bottom;
        const currentGraphYStart = graphIndex * (graphTotalH + BETWEEN_GAP);
        const relY = currentGraphYStart + bottomPadding + 10;

        setPopupPos({ x: relX, y: relY });
      }
    },
    [containerWidth, totalDuration]
  );

  if (metrics.length === 0 || session.timeSeries.length === 0) {
    return (
      <div
        css={css`
          padding: 16px;
          color: ${THEME.textSecondary};
          font-size: 12px;
        `}
      >
        No data to display.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      css={css`
        position: relative;
        width: 100%;
        background: transparent;
      `}
      data-component="TimeSeriesSegmentationGraph"
    >
      {metricDatasets.map((data, idx) => {
        const isLast = idx === metricDatasets.length - 1;
        return (
          <div
            key={data.metric}
            css={css`
              margin-bottom: ${isLast ? 0 : BETWEEN_GAP}px;
            `}
          >
            <MetricGraph
              data={data}
              totalDuration={totalDuration}
              svgWidth={Math.max(containerWidth, 300)}
              isLast={isLast}
              hoveredTime={hoveredTime}
              threshold={thresholds[data.metric] ?? 1.0}
              onHoverMove={(t) => handleHover(t, idx)}
            />
          </div>
        );
      })}

      {/* Hover popup */}
      {hoveredTime !== null && (
        <HoverPopup
          datasets={metricDatasets}
          time={hoveredTime}
          position={popupPos}
          containerWidth={containerWidth}
        />
      )}

      {/* Legend */}
      <SegmentationLegend />
    </div>
  );
}
