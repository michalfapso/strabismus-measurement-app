import { useState } from 'react';
import { Session } from '../types';
import { calculateStats, linearRegression } from '../utils/stats';

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
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
        }}
      >
        {trendPoints.length > 0 ? (
          <div style={{ width: '100%', height: '100%', color: '#888' }}>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>
              Trend: {trend} ({regression.slope.toFixed(3)}/session)
            </div>
            {/* Placeholder for actual chart - requires recharts or similar */}
            <div style={{ fontSize: '10px', color: '#666' }}>
              Chart visualization (recharts recommended)
            </div>
          </div>
        ) : (
          <div>No data available</div>
        )}
      </div>
    </div>
  );
}

type OverlayMetric = 'x' | 'y' | 'rotation';

function OverlayChart({ sessions }: { sessions: Session[] }) {
  const [metric, setMetric] = useState<OverlayMetric>('rotation');
  const [timeMode, setTimeMode] = useState<'absolute' | 'relative'>('absolute');
  const [visibleSessionIds, setVisibleSessionIds] = useState<Set<string>>(
    new Set(sessions.map((s) => s.sessionId))
  );

  const toggleSessionVisibility = (sessionId: string) => {
    const next = new Set(visibleSessionIds);
    if (next.has(sessionId)) {
      next.delete(sessionId);
    } else {
      next.add(sessionId);
    }
    setVisibleSessionIds(next);
  };

  // Prepare overlay data
  const maxDuration = Math.max(
    ...sessions.map((s) =>
      s.timeSeries.length > 0
        ? s.timeSeries[s.timeSeries.length - 1].t
        : 0
    )
  );

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
          marginBottom: '12px',
          color: '#888',
        }}
      >
        {/* Placeholder for actual chart - requires recharts or similar */}
        <div style={{ fontSize: '10px' }}>
          Overlay time-series visualization ({sessions.length} sessions, {metric} metric,{' '}
          {timeMode} time)
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          fontSize: '11px',
        }}
      >
        {sessions.map((session) => {
          const isVisible = visibleSessionIds.has(session.sessionId);
          return (
            <button
              key={session.sessionId}
              onClick={() => toggleSessionVisibility(session.sessionId)}
              style={{
                padding: '4px 6px',
                backgroundColor: isVisible
                  ? 'rgba(0,255,0,0.2)'
                  : 'rgba(255,255,255,0.05)',
                border: isVisible
                  ? '1px solid #0f0'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '2px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              {isVisible ? '✓' : '○'} {new Date(session.timestamp).toLocaleDateString()}
            </button>
          );
        })}
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
