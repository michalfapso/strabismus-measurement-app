import { SessionMetrics } from '../types/analysis';
import SubScoresPanel from './SubScoresPanel';
import StateSegmentationTimeline from './StateSegmentationTimeline';
import HistogramChart from './HistogramChart';
import TimeSeriesGraph from './TimeSeriesGraph';
import { Session } from '../types';
import { css } from '@emotion/react';

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
        border-bottom: 2px solid #ddd;
      `}>
        <h2 css={css`margin: 0; font-size: 18px;`}>
          {metrics.date} — {metrics.exerciseTag}
        </h2>
        <p css={css`margin: 4px 0 0 0; color: #666; font-size: 13px;`}>
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
      <div css={css`border: 1px solid #ddd; border-radius: 4px; padding: 12px;`}>
        <h3 css={css`margin-top: 0; margin-bottom: 12px;`}>Distribution</h3>
        <HistogramChart sessions={[session]} metric={metrics.metric} />
      </div>

      {/* Time series */}
      <div css={css`border: 1px solid #ddd; border-radius: 4px; padding: 12px;`}>
        <h3 css={css`margin-top: 0; margin-bottom: 12px;`}>Time Series</h3>
        <TimeSeriesGraph sessions={[session]} metric={metrics.metric} />
      </div>
    </div>
  );
}
