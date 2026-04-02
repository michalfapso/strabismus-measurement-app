import { SessionMetrics } from '../types/analysis';
import SubScoresPanel from './SubScoresPanel';
import StateSegmentationTimeline from './StateSegmentationTimeline';
import { HistogramChart } from './HistogramChart';
import { TimeSeriesGraph } from './TimeSeriesGraph';
import { Session } from '../types';
import { css } from '@emotion/react';
import { THEME } from '../theme';

interface SingleSessionViewProps {
  metrics: SessionMetrics;
  session: Session;
}

export default function SingleSessionView({ metrics, session }: SingleSessionViewProps) {
  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    `}>
      {/* Header */}
      <div css={css`
        padding-bottom: 12px;
        border-bottom: 2px solid ${THEME.borderPrimary};
      `}>
        <h2 css={css`margin: 0; font-size: 18px; color: ${THEME.textPrimary};`}>
          {metrics.date} — {metrics.exerciseTag}
        </h2>
        <p css={css`margin: 4px 0 0 0; color: ${THEME.textSecondary}; font-size: 13px;`}>
          Duration: {metrics.sessionDuration.toFixed(0)} seconds
        </p>
      </div>

      {/* Sub-scores */}
      <SubScoresPanel metrics={metrics} />

      {/* State segmentation timeline */}
      {metrics.stateSegments.length > 0 && (
        <StateSegmentationTimeline
          segments={metrics.stateSegments}
          sessionDuration={metrics.sessionDuration}
        />
      )}

      {/* Histogram */}
      <div css={css`border: 1px solid ${THEME.borderPrimary}; border-radius: 4px; padding: 12px; background-color: ${THEME.panelBg};`}>
        <h3 css={css`margin-top: 0; margin-bottom: 12px; color: ${THEME.textPrimary};`}>Distribution</h3>
        <HistogramChart sessions={[session]} isSingleSession={true} />
      </div>

      {/* Time series */}
      <div css={css`border: 1px solid ${THEME.borderPrimary}; border-radius: 4px; padding: 12px; background-color: ${THEME.panelBg};`}>
        <h3 css={css`margin-top: 0; margin-bottom: 12px; color: ${THEME.textPrimary};`}>Time Series</h3>
        <TimeSeriesGraph sessions={[session]} isSingleSession={true} />
      </div>
    </div>
  );
}
