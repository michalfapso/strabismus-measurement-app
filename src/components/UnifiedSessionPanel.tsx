import { Session } from '../types';
import { useSessionStats } from '../hooks/useSessionStats';
import { useViewState } from '../hooks/useViewState';
import { getGlobalSettings } from '../utils/globalSettings';
import { StatCards } from './StatCards';
import { TimeSeriesGraph } from './TimeSeriesGraph';
import { HistogramChart } from './HistogramChart';
import { TrendChart } from './TrendChart';

export interface UnifiedSessionPanelProps {
  sessions: Session[];
}

export function UnifiedSessionPanel({ sessions }: UnifiedSessionPanelProps) {
  const isSingleSession = sessions.length === 1;
  const viewState = useViewState();
  const { selectedMetrics } = getGlobalSettings();

  // For single session, calculate stats for that session
  const singleSessionStats = useSessionStats(isSingleSession ? sessions[0] : null);

  // For aggregate, calculate stats from multiple sessions
  const aggregateStats = !isSingleSession ? calculateAggregateStats(sessions) : null;

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        padding: '16px',
        color: '#fff',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}
    >
      {/* Header section */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0', fontSize: '14px', color: '#fff' }}>
          {isSingleSession
            ? sessions[0].exerciseTag
            : `${sessions.length} Sessions Selected`}
        </h2>
      </div>

      {/* Stat Cards section - shared for both single and aggregate views */}
      <div style={{ marginBottom: '20px' }}>
        {isSingleSession ? (
          <StatCards
            positionRange={singleSessionStats.positionRange}
            rotationRange={singleSessionStats.rotationRange}
            duration={singleSessionStats.duration}
            meanDeviation={singleSessionStats.meanDeviation}
            exerciseTag={sessions[0].exerciseTag}
          />
        ) : (
          aggregateStats && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              }}
            >
              {aggregateStats.cards.map((card) => (
                <div
                  key={card.label}
                  style={{
                    padding: '12px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
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
          )
        )}
      </div>

      {/* TimeSeriesGraph section */}
      <div style={{
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        marginBottom: '16px',
      }}>
        <TimeSeriesGraph sessions={sessions} isSingleSession={isSingleSession} selectedMetrics={selectedMetrics} viewState={viewState} />
      </div>

      {/* HistogramChart section */}
      <div style={{
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        marginBottom: '16px',
      }}>
        <HistogramChart sessions={sessions} isSingleSession={isSingleSession} viewState={viewState} />
      </div>

      {/* Trend Chart section - Aggregate Only */}
      {!isSingleSession && (
        <div>
          <TrendChart sessions={sessions} />
        </div>
      )}
    </div>
  );
}

/**
 * Calculate aggregate statistics from multiple sessions
 */
function calculateAggregateStats(sessions: Session[]) {
  if (sessions.length === 0) {
    return null;
  }

  // Calculate metrics for each session
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

  return {
    cards: [
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
    ],
  };
}

/**
 * Calculate mean and standard deviation of an array of numbers
 */
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
