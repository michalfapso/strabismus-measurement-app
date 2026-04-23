import React, { useMemo, useState, useEffect, useRef } from 'react';
import { SessionMetrics } from '../types/analysis';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { css } from '@emotion/react';
import { THEME } from '../theme';
import { useSharedHover } from '../hooks/useSharedHover';

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
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  } catch {
    return dateStr;
  }
}

// Helper function: check if locked session is visible in current zoom window
function isLockedSessionVisible(
  lockedGlobalIndex: number,
  zoomStart: number,
  zoomEnd: number
): boolean {
  return lockedGlobalIndex >= Math.floor(zoomStart) && lockedGlobalIndex <= Math.ceil(zoomEnd);
}

// Helper function: find visible index of locked session in current data
function getLockedSessionVisibleIndex(
  lockedGlobalIndex: number,
  visibleData: any[]
): number | null {
  const visibleIndex = visibleData.findIndex(d => d.sessionIndex === lockedGlobalIndex);
  return visibleIndex >= 0 ? visibleIndex : null;
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

function useResponsiveGraphHeight(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [graphHeight, setGraphHeight] = useState(150);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        // Aspect ratio: 500px width -> 150px height (3.33:1)
        // Width >= 500px: height = 150px
        // Width < 500px: height = width * 0.3
        const newHeight = width >= 500 ? 150 : width * 0.3;
        setGraphHeight(newHeight);
      }
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [containerRef]);

  return graphHeight;
}

function useZoomPan(dataLength: number) {
  const [zoomStart, setZoomStart] = useState(0);
  const [zoomEnd, setZoomEnd] = useState(dataLength);

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
  longestQualityStreak: number;
  qualityEpisodeCount: number;
  fusionPercent: number;
  nearFusionPercent: number;
  stableDeviationPercent: number;
  approachingPercent: number;
  driftingPercent: number;
}

interface LockedTooltipState {
  sessionData: ProgressGraphsTooltipPayload;
  visibleIndex: number | null;
  globalIndex: number;
}

interface ProgressGraphsTooltipContentProps {
  active?: boolean;
  payload?: Array<{
    payload: ProgressGraphsTooltipPayload;
  }>;
  label?: any;
  isLocked?: boolean;
  lockedSession?: ProgressGraphsTooltipPayload | null;
  onCloseLocked?: () => void;
  onDrillDown?: (sessionId: string) => void;
  dataLocked?: string;
}

function ProgressGraphsTooltipContent({
  active,
  payload,
  isLocked = false,
  lockedSession,
  onCloseLocked,
  onDrillDown,
  dataLocked,
}: ProgressGraphsTooltipContentProps) {
  // Get session data from payload (hover) or lockedSession (locked)
  const data = isLocked ? lockedSession : (active && payload && payload.length > 0 ? payload[0].payload : null);

  if (!data) return null;

  return (
    <div
      css={styles.tooltip}
      data-locked={dataLocked || (isLocked ? "true" : "false")}
      style={{
        borderColor: isLocked ? THEME.accentGreen : undefined,
        position: 'relative',
      }}
    >
      <p><strong>{data.date}</strong></p>
      <p>Exercise: {data.exerciseTag}</p>
      <p>Session #{data.sessionIndex + 1}</p>
      <hr />
      <p>Best Stable Deviation: {data.bestStableDeviation.toFixed(2)} cm</p>
      <p>Near-Best Stable Time: {data.nearBestStableTime.toFixed(1)}s</p>
      <p>Longest Quality Streak: {data.longestQualityStreak.toFixed(1)}s</p>
      <p>Quality Episode Count: {data.qualityEpisodeCount}</p>
      <hr />
      <p>Fusion: {data.fusionPercent.toFixed(1)}%</p>
      <p>Near Fusion: {data.nearFusionPercent.toFixed(1)}%</p>
      <p>Stable Deviation: {data.stableDeviationPercent.toFixed(1)}%</p>
      <p>Approaching: {data.approachingPercent.toFixed(1)}%</p>
      <p>Drifting: {data.driftingPercent.toFixed(1)}%</p>

      {/* Locked state controls */}
      {isLocked && (
        <>
          <div css={styles.closeButtonContainer}>
            <button
              onClick={onCloseLocked}
              aria-label="Close tooltip"
              css={styles.closeButton}
            >
              ✕
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDrillDown?.(data.sessionId);
            }}
            aria-label={`View session ${data.sessionIndex + 1} details`}
            css={styles.viewSessionButton}
          >
            View Session →
          </button>
        </>
      )}
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
    gap: 6px;
    margin-bottom: 12px;
    align-items: center;
    flex-wrap: wrap;

    button {
      padding: 4px 10px;
      border: 1px solid ${THEME.accentGreen};
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.8);
      color: ${THEME.accentGreen};
      cursor: pointer;
      font-weight: 500;
      font-size: 12px;

      &:hover {
        background: rgba(0, 255, 0, 0.1);
        text-shadow: 0 0 8px ${THEME.accentGreen};
      }

      &:active {
        background: rgba(0, 255, 0, 0.2);
      }
    }

    @media (max-width: 900px) {
      gap: 4px;

      button {
        padding: 3px 8px;
        font-size: 11px;
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

    &[data-locked="true"] {
      border: 2px solid ${THEME.accentGreen};
    }
  `,
  closeButtonContainer: css`
    position: absolute;
    top: 4px;
    right: 4px;
  `,
  closeButton: css`
    background: none;
    border: none;
    color: ${THEME.textPrimary};
    cursor: pointer;
    font-size: 16px;
    padding: 0;

    &:hover {
      opacity: 0.7;
    }

    &:active {
      opacity: 0.5;
    }
  `,
  viewSessionButton: css`
    margin-top: 8px;
    width: 100%;
    padding: 5px 0;
    background: ${THEME.accentGreenLight};
    border: 1px solid ${THEME.accentGreen};
    border-radius: 3px;
    color: ${THEME.accentGreen};
    font-size: 11px;
    cursor: pointer;
    font-weight: 500;

    &:hover {
      background: rgba(0, 255, 0, 0.25);
      box-shadow: 0 0 8px rgba(0, 255, 0, 0.3);
    }

    &:active {
      background: rgba(0, 255, 0, 0.35);
    }
  `,
  lockedOverlay: css`
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
    pointer-events: auto;
  `,
  sharedTooltipContainer: css`
    position: absolute;
    pointer-events: auto;
    z-index: 100;
    transform: translateX(-50%);

    @media (max-width: 768px) {
      z-index: 100;
    }
  `,
  legendWrapper: css`
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px;
    margin: 8px 0 12px 0;
    font-size: 12px;
    color: ${THEME.textSecondary};

    @media (max-width: 768px) {
      margin: 4px 0 8px 0;
      gap: 8px;
    }
  `,
  legendItem: css`
    display: flex;
    align-items: center;
    gap: 6px;
  `,
  legendDot: css`
    width: 10px;
    height: 10px;
    border-radius: 2px;
  `,
};

/**
 * ProgressGraphs: Three stacked graphs showing progression over multiple sessions
 * - Graph 1: bestStableDeviation (cm)
 * - Graph 2: nearBestStableTime (seconds)
 * - Graph 3: qualityPercent + driftingPercent + approachingPercent (%)
 */
export function ProgressGraphs({ sessions, onDrillDown, exerciseFilter }: ProgressGraphsProps) {
  // Ref to measure container width for responsive height
  const containerRef = useRef<HTMLDivElement>(null);

  // Locked session state for click-to-lock tooltip
  const [lockedSession, setLockedSession] = useState<LockedTooltipState | null>(null);

  // Shared hover state across all charts
  const { activeIndex, hoveredGraphId, cursorX, cursorY, setHover, clearHover } = useSharedHover();

  // Responsive graph height with aspect ratio
  const graphHeight = useResponsiveGraphHeight(containerRef);

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
        longestQualityStreak: session.longestQualityStreak,
        qualityEpisodeCount: session.qualityEpisodeCount,
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

  // Filter data based on zoom
  const visibleData = useMemo(() => {
    return graphData.slice(Math.floor(zoomStart), Math.ceil(zoomEnd));
  }, [graphData, zoomStart, zoomEnd]);

  // Handle chart click to lock tooltip
  const handleChartClick = (state: any) => {
    if (state && state.activeTooltipIndex !== undefined) {
      const sessionData = visibleData[state.activeTooltipIndex];
      if (sessionData) {
        setLockedSession({
          sessionData: {
            sessionIndex: sessionData.sessionIndex,
            sessionId: sessionData.sessionId,
            date: sessionData.date,
            exerciseTag: sessionData.exerciseTag,
            bestStableDeviation: sessionData.bestStableDeviation,
            nearBestStableTime: sessionData.nearBestStableTime,
            longestQualityStreak: sessionData.longestQualityStreak,
            qualityEpisodeCount: sessionData.qualityEpisodeCount,
            fusionPercent: sessionData.fusionPercent,
            nearFusionPercent: sessionData.nearFusionPercent,
            stableDeviationPercent: sessionData.stableDeviationPercent,
            approachingPercent: sessionData.approachingPercent,
            driftingPercent: sessionData.driftingPercent,
          },
          visibleIndex: state.activeTooltipIndex,
          globalIndex: sessionData.sessionIndex,
        });
      }
    }
  };

  // Recalculate locked session visibility on zoom/pan
  useEffect(() => {
    if (lockedSession) {
      const isVisible = isLockedSessionVisible(
        lockedSession.globalIndex,
        zoomStart,
        zoomEnd
      );
      if (!isVisible) {
        setLockedSession(null);
      } else {
        const newVisibleIndex = getLockedSessionVisibleIndex(
          lockedSession.globalIndex,
          visibleData
        );
        if (newVisibleIndex !== null) {
          setLockedSession(prev => ({
            ...prev!,
            visibleIndex: newVisibleIndex,
          }));
        }
      }
    }
  }, [zoomStart, zoomEnd, visibleData, lockedSession]);

  if (graphData.length === 0) {
    return <div>No sessions to display</div>;
  }

  return (
    <div
      ref={containerRef}
      css={styles.container}
      data-component="ProgressGraphs"
      onTouchStart={touchHandlers.handleTouchStart}
      onTouchMove={touchHandlers.handleTouchMove}
      onTouchEnd={touchHandlers.handleTouchEnd}
    >
      <div css={styles.controls}>
        <button onClick={() => handlePan('left')}>← Pan Left</button>
        <button onClick={() => handleZoom(ZOOM_IN_FACTOR)}>🔍- Zoom Out</button>
        <button onClick={() => handleZoom(ZOOM_OUT_FACTOR)}>🔍+ Zoom In</button>
        <button onClick={() => handlePan('right')}>Pan Right →</button>
        <span css={styles.zoomInfo}>
          Showing sessions {Math.floor(zoomStart) + 1} - {Math.ceil(zoomEnd)} of {graphData.length}
        </span>
      </div>
      <div css={styles.graphContainer}>
        <h3>Best Stable Deviation (cm)</h3>
        <ResponsiveContainer width="100%" height={graphHeight}>
          <LineChart
            data={visibleData}
            margin={{ right: 15, left: 35, bottom: 10, top: 10 }}
            onClick={handleChartClick}
            onMouseMove={(state: any) => { if (state && state.activeTooltipIndex !== undefined) { setHover(state.activeTooltipIndex, "graph1", state.chartX, state.chartY); } }}
            onMouseLeave={() => clearHover()}
          >
            <CartesianGrid strokeDasharray="3 3" />
            {/* Invisible XAxis for ReferenceLine positioning on non-hovered graphs */}
            <XAxis dataKey="sessionIndex" tick={false} axisLine={false} height={0} />
            <YAxis width={35} tick={{ fontSize: 12 }} />
            {/* Vertical line on non-hovered graphs */}
            {hoveredGraphId !== "graph1" && activeIndex !== null && visibleData[activeIndex] && (
              <ReferenceLine x={visibleData[activeIndex].sessionIndex} stroke={THEME.textSecondary} strokeDasharray="3 3" />
            )}
            <Tooltip
              active={!lockedSession && activeIndex !== null && hoveredGraphId === "graph1"}
              content={(props: any) => (
                <ProgressGraphsTooltipContent
                  {...props}
                  isLocked={!!lockedSession}
                  lockedSession={lockedSession?.sessionData}
                  dataLocked={lockedSession ? "true" : "false"}
                  onCloseLocked={() => setLockedSession(null)}
                  onDrillDown={onDrillDown}
                />
              )}
            />
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

        <div css={styles.legendWrapper}>
          <div css={styles.legendItem}>
            <div css={[styles.legendDot, { backgroundColor: THEME.stateNearFusion }]} />
            <span>Near-Best Stable Time</span>
          </div>
          <div css={styles.legendItem}>
            <div css={[styles.legendDot, { backgroundColor: '#20b2aa' }]} />
            <span>Longest Quality Streak</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={graphHeight}>
          <LineChart
            data={visibleData}
            margin={{ right: 15, left: 35, bottom: 10, top: 10 }}
            onClick={handleChartClick}
            onMouseMove={(state: any) => { if (state && state.activeTooltipIndex !== undefined) { setHover(state.activeTooltipIndex, "graph2", state.chartX, state.chartY); } }}
            onMouseLeave={() => clearHover()}
          >
            <CartesianGrid strokeDasharray="3 3" />
            {/* Invisible XAxis for ReferenceLine positioning on non-hovered graphs */}
            <XAxis dataKey="sessionIndex" tick={false} axisLine={false} height={0} />
            <YAxis width={35} tick={{ fontSize: 12 }} />
            {/* Vertical line on non-hovered graphs */}
            {hoveredGraphId !== "graph2" && activeIndex !== null && visibleData[activeIndex] && (
              <ReferenceLine x={visibleData[activeIndex].sessionIndex} stroke={THEME.textSecondary} strokeDasharray="3 3" />
            )}
            <Tooltip
              active={!lockedSession && activeIndex !== null && hoveredGraphId === "graph2"}
              content={(props: any) => (
                <ProgressGraphsTooltipContent
                  {...props}
                  isLocked={!!lockedSession}
                  lockedSession={lockedSession?.sessionData}
                  dataLocked={lockedSession ? "true" : "false"}
                  onCloseLocked={() => setLockedSession(null)}
                  onDrillDown={onDrillDown}
                />
              )}
            />
            <Line
              type="monotone"
              dataKey="nearBestStableTime"
              stroke={THEME.stateNearFusion}
              name="Near-Best Stable Time"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="longestQualityStreak"
              stroke="#20b2aa"
              strokeDasharray="5 5"
              dot={false}
              name="Longest Quality Streak"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div css={styles.graphContainer}>
        <h3>Session Composition (%)</h3>

        <div css={styles.legendWrapper}>
          <div css={styles.legendItem}>
            <div css={[styles.legendDot, { backgroundColor: THEME.stateFusion }]} />
            <span>Fusion</span>
          </div>
          <div css={styles.legendItem}>
            <div css={[styles.legendDot, { backgroundColor: THEME.stateNearFusion }]} />
            <span>Near Fusion</span>
          </div>
          <div css={styles.legendItem}>
            <div css={[styles.legendDot, { backgroundColor: THEME.stateStableDeviation }]} />
            <span>Stable Deviation</span>
          </div>
          <div css={styles.legendItem}>
            <div css={[styles.legendDot, { backgroundColor: THEME.stateApproaching }]} />
            <span>Approaching</span>
          </div>
          <div css={styles.legendItem}>
            <div css={[styles.legendDot, { backgroundColor: THEME.stateDrifting }]} />
            <span>Drifting</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={graphHeight}>
          <AreaChart
            data={visibleData}
            margin={{ right: 15, left: 35, bottom: 10, top: 10 }}
            onClick={handleChartClick}
            onMouseMove={(state: any) => { if (state && state.activeTooltipIndex !== undefined) { setHover(state.activeTooltipIndex, "graph3", state.chartX, state.chartY); } }}
            onMouseLeave={() => clearHover()}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="sessionIndex"
              tickFormatter={(index) => {
                if (visibleData && visibleData[index]) {
                  return formatDatetimeLabel(visibleData[index].date);
                }
                return index.toString();
              }}
              angle={-30}
              textAnchor="end"
              height={38}
              tick={{ fontSize: 12 }}
            />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} width={35} tick={{ fontSize: 12 }} />
            {/* Vertical line on non-hovered graphs */}
            {hoveredGraphId !== "graph3" && activeIndex !== null && visibleData[activeIndex] && (
              <ReferenceLine x={visibleData[activeIndex].sessionIndex} stroke={THEME.textSecondary} strokeDasharray="3 3" />
            )}
            <Tooltip
              active={!lockedSession && activeIndex !== null && hoveredGraphId === "graph3"}
              content={(props: any) => (
                <ProgressGraphsTooltipContent
                  {...props}
                  isLocked={!!lockedSession}
                  lockedSession={lockedSession?.sessionData}
                  dataLocked={lockedSession ? "true" : "false"}
                  onCloseLocked={() => setLockedSession(null)}
                  onDrillDown={onDrillDown}
                />
              )}
            />
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
