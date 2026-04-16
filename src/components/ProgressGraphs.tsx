import React, { useMemo, useState } from 'react';
import { SessionMetrics } from '../types/analysis';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { css } from '@emotion/react';
import { THEME } from '../theme';

// Progress graph zoom/pan configuration
const DEFAULT_ZOOM_WINDOW = 20;    // Initial visible sessions
const PAN_PERCENTAGE = 0.2;        // 20% of span per pan
const ZOOM_OUT_FACTOR = 1.2;       // Enlarge view by 20%
const ZOOM_IN_FACTOR = 0.8;        // Shrink view by 20%
const MIN_VISIBLE_SPAN = 2;        // Minimum sessions to show

// Format datetime label for X-axis tick labels
function formatDatetimeLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return dateStr;
  }
}

interface ProgressGraphsProps {
  sessions: SessionMetrics[];
  onDrillDown?: (sessionId: string) => void;
  exerciseFilter?: string;
}

function useTouchZoom(onZoom: (factor: number) => void) {
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchStart(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStart !== null) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = touchStart / distance;
      if (factor > 0.9 && factor < 1.1) {
        onZoom(factor);
      }
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
  };

  return { handleTouchStart, handleTouchMove, handleTouchEnd };
}

function useZoomPan(dataLength: number) {
  const [zoomStart, setZoomStart] = useState(0);
  const [zoomEnd, setZoomEnd] = useState(Math.min(DEFAULT_ZOOM_WINDOW, dataLength));

  const handleZoom = (factor: number) => {
    const center = (zoomStart + zoomEnd) / 2;
    const span = zoomEnd - zoomStart;
    const newSpan = Math.max(MIN_VISIBLE_SPAN, span / factor);
    const newStart = Math.max(0, Math.floor(center - newSpan / 2));
    const newEnd = Math.min(dataLength, Math.ceil(newStart + newSpan));
    setZoomStart(newStart);
    setZoomEnd(newEnd);
  };

  const handlePan = (direction: 'left' | 'right') => {
    const span = zoomEnd - zoomStart;
    const shift = Math.max(1, Math.floor(span * PAN_PERCENTAGE));
    if (direction === 'left') {
      const newStart = Math.max(0, zoomStart - shift);
      const newEnd = Math.min(dataLength, newStart + span);
      setZoomStart(newStart);
      setZoomEnd(newEnd);
    } else {
      const newEnd = Math.min(dataLength, zoomEnd + shift);
      const newStart = Math.max(0, newEnd - span);
      setZoomStart(newStart);
      setZoomEnd(newEnd);
    }
  };

  return { zoomStart, zoomEnd, handleZoom, handlePan };
}

function calculateStatePercentages(session: SessionMetrics) {
  const stateTimings: Record<string, number> = {
    FUSION: 0,
    NEAR_FUSION: 0,
    STABLE_DEVIATION: 0,
    APPROACHING: 0,
    DRIFTING: 0,
  };

  // Sum duration for each state
  for (const seg of session.stateSegments) {
    if (seg.state in stateTimings) {
      stateTimings[seg.state] += seg.duration;
    }
  }

  // Convert to percentages
  const duration = session.sessionDuration || 1; // Avoid division by zero
  return {
    fusionPercent: (stateTimings.FUSION / duration) * 100,
    nearFusionPercent: (stateTimings.NEAR_FUSION / duration) * 100,
    stableDeviationPercent: (stateTimings.STABLE_DEVIATION / duration) * 100,
    approachingPercent: (stateTimings.APPROACHING / duration) * 100,
    driftingPercent: (stateTimings.DRIFTING / duration) * 100,
  };
}

interface ProgressGraphsTooltipPayload {
  sessionIndex: number;
  sessionId: string;
  date: string;
  exerciseTag: string;
  bestStableDeviation: number;
  nearBestStableTime: number;
  fusionPercent: number;
  nearFusionPercent: number;
  stableDeviationPercent: number;
  approachingPercent: number;
  driftingPercent: number;
}

interface SharedTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ProgressGraphsTooltipPayload;
  }>;
  label?: any;
}

function SharedTooltip({ active, payload }: SharedTooltipProps) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div css={styles.tooltip}>
        <p><strong>{data.date}</strong></p>
        <p>Exercise: {data.exerciseTag}</p>
        <p>Session #{data.sessionIndex + 1}</p>
        <hr />
        <p>Best Stable Deviation: {data.bestStableDeviation.toFixed(2)} cm</p>
        <p>Near-Best Stable Time: {data.nearBestStableTime.toFixed(1)}s</p>
        <p>Fusion: {data.fusionPercent.toFixed(1)}%</p>
        <p>Near Fusion: {data.nearFusionPercent.toFixed(1)}%</p>
        <p>Stable Deviation: {data.stableDeviationPercent.toFixed(1)}%</p>
        <p>Approaching: {data.approachingPercent.toFixed(1)}%</p>
        <p>Drifting: {data.driftingPercent.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
}

/**
 * ProgressGraphs: Three stacked graphs showing progression over multiple sessions
 * - Graph 1: bestStableDeviation (cm)
 * - Graph 2: nearBestStableTime (seconds)
 * - Graph 3: qualityPercent + driftingPercent + approachingPercent (%)
 */
export function ProgressGraphs({ sessions, onDrillDown, exerciseFilter }: ProgressGraphsProps) {
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

    return sorted.map((session, index) => {
      const statePercentages = calculateStatePercentages(session);
      return {
        sessionIndex: index,
        sessionId: session.sessionId,
        date: session.date,
        exerciseTag: session.exerciseTag,
        bestStableDeviation: session.bestStableDeviation,
        nearBestStableTime: session.nearBestStableTime,
        ...statePercentages,  // Add all 5 state percentages
      };
    });
  }, [filteredSessions]);

  // Initialize zoom/pan hook
  const { zoomStart, zoomEnd, handleZoom, handlePan } = useZoomPan(graphData.length);

  // Initialize touch zoom hook
  const touchHandlers = useTouchZoom((factor) => {
    handleZoom(factor > 1 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR);
  });

  // Responsive graph height
  const graphHeight = window.innerWidth < 768 ? 180 : 250;

  // Filter data based on zoom
  const visibleData = useMemo(() => {
    return graphData.slice(Math.floor(zoomStart), Math.ceil(zoomEnd));
  }, [graphData, zoomStart, zoomEnd]);

  if (graphData.length === 0) {
    return <div>No sessions to display</div>;
  }

  return (
    <div
      css={styles.container}
      onTouchStart={touchHandlers.handleTouchStart}
      onTouchMove={touchHandlers.handleTouchMove}
      onTouchEnd={touchHandlers.handleTouchEnd}
    >
      <div css={styles.controls}>
        <button onClick={() => handlePan('left')}>← Pan Left</button>
        <button onClick={() => handleZoom(ZOOM_OUT_FACTOR)}>🔍- Zoom Out</button>
        <button onClick={() => handleZoom(ZOOM_IN_FACTOR)}>🔍+ Zoom In</button>
        <button onClick={() => handlePan('right')}>Pan Right →</button>
        <span css={styles.zoomInfo}>
          Showing sessions {Math.floor(zoomStart) + 1} - {Math.ceil(zoomEnd)} of {graphData.length}
        </span>
      </div>
      <div css={styles.graphContainer}>
        <h3>Best Stable Deviation (cm)</h3>
        <ResponsiveContainer width="100%" height={graphHeight}>
          <LineChart data={visibleData} margin={{ right: 30, left: 0, bottom: 60, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="sessionIndex"
              label={{ value: 'Session Index', position: 'insideBottomRight', offset: -10, fill: THEME.textSecondary }}
              tickFormatter={(index) => {
                if (visibleData && visibleData[index]) {
                  return formatDatetimeLabel(visibleData[index].date);
                }
                return index.toString();
              }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis label={{ value: 'Deviation (cm)', angle: -90, position: 'insideLeft', fill: THEME.textSecondary }} />
            <Tooltip content={<SharedTooltip />} />
            <Legend wrapperStyle={{ color: THEME.textPrimary }} />
            <Line
              type="monotone"
              dataKey="bestStableDeviation"
              stroke={THEME.metricDeviation}
              name="Best Stable Deviation"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div css={styles.graphContainer}>
        <h3>Near-Best Stable Time (seconds)</h3>
        <ResponsiveContainer width="100%" height={graphHeight}>
          <LineChart data={visibleData} margin={{ right: 30, left: 0, bottom: 60, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="sessionIndex"
              label={{ value: 'Session Index', position: 'insideBottomRight', offset: -10, fill: THEME.textSecondary }}
              tickFormatter={(index) => {
                if (visibleData && visibleData[index]) {
                  return formatDatetimeLabel(visibleData[index].date);
                }
                return index.toString();
              }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis label={{ value: 'Time (seconds)', angle: -90, position: 'insideLeft', fill: THEME.textSecondary }} />
            <Tooltip content={<SharedTooltip />} />
            <Legend wrapperStyle={{ color: THEME.textPrimary }} />
            <Line
              type="monotone"
              dataKey="nearBestStableTime"
              stroke={THEME.stateNearFusion}
              name="Near-Best Stable Time"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div css={styles.graphContainer}>
        <h3>Session Composition (%)</h3>
        <ResponsiveContainer width="100%" height={graphHeight}>
          <AreaChart data={visibleData} margin={{ right: 30, left: 0, bottom: 60, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="sessionIndex"
              label={{ value: 'Session Index', position: 'insideBottomRight', offset: -10, fill: THEME.textSecondary }}
              tickFormatter={(index) => {
                if (visibleData && visibleData[index]) {
                  return formatDatetimeLabel(visibleData[index].date);
                }
                return index.toString();
              }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis label={{ value: 'Percent (%)', angle: -90, position: 'insideLeft', fill: THEME.textSecondary }} />
            <Tooltip content={<SharedTooltip />} />
            <Legend wrapperStyle={{ color: THEME.textPrimary }} />
            <Area type="monotone" dataKey="fusionPercent" stackId="1" stroke={THEME.stateFusion} fill={THEME.stateFusion} name="Fusion" />
            <Area type="monotone" dataKey="nearFusionPercent" stackId="1" stroke={THEME.stateNearFusion} fill={THEME.stateNearFusion} name="Near Fusion" />
            <Area type="monotone" dataKey="stableDeviationPercent" stackId="1" stroke={THEME.stateStableDeviation} fill={THEME.stateStableDeviation} name="Stable Deviation" />
            <Area type="monotone" dataKey="approachingPercent" stackId="1" stroke={THEME.stateApproaching} fill={THEME.stateApproaching} name="Approaching" />
            <Area type="monotone" dataKey="driftingPercent" stackId="1" stroke={THEME.stateDrifting} fill={THEME.stateDrifting} name="Drifting" />
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

    @media (max-width: 768px) {
      padding: 12px;
      gap: 12px;
    }
  `,
  controls: css`
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    align-items: center;
    flex-wrap: wrap;

    button {
      padding: 6px 12px;
      border: 1px solid ${THEME.borderPrimary};
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      cursor: pointer;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }

    @media (max-width: 768px) {
      gap: 4px;

      button {
        padding: 4px 8px;
        font-size: 12px;
      }
    }
  `,
  zoomInfo: css`
    font-size: 12px;
    color: ${THEME.textSecondary};
    margin-left: auto;

    @media (max-width: 768px) {
      font-size: 11px;
    }
  `,
  graphContainer: css`
    border: 1px solid ${THEME.borderPrimary};
    border-radius: 4px;
    padding: 12px;

    @media (max-width: 768px) {
      padding: 8px;

      h3 {
        font-size: 14px;
        margin: 4px 0 8px 0;
      }
    }
  `,
  tooltip: css`
    background: rgba(0, 0, 0, 1);
    border: 1px solid ${THEME.borderPrimary};
    border-radius: 4px;
    padding: 8px;
    font-size: 12px;
    color: ${THEME.textPrimary};

    p {
      margin: 4px 0;
    }

    hr {
      margin: 4px 0;
      border: none;
      border-top: 1px solid ${THEME.borderSecondary || '#444'};
    }
  `,
};
