import { StateSegment, SessionState } from '../types/analysis';
import { css } from '@emotion/react';
import { THEME } from '../theme';

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
  STABLE_DEVIATION: 'Stable',
  DRIFTING: 'Drifting',
};

interface StateSegmentationTimelineProps {
  segments: StateSegment[];
  sessionDuration: number;
}

export default function StateSegmentationTimeline({
  segments,
  sessionDuration,
}: StateSegmentationTimelineProps) {
  if (segments.length === 0) {
    return <div css={css`padding: 16px; color: #999;`}>No state data available</div>;
  }

  return (
    <div css={css`padding: 16px; border: 1px solid ${THEME.borderPrimary}; border-radius: 4px; background-color: ${THEME.panelBg};`} data-component="StateSegmentationTimeline">
      <h3 css={css`margin-top: 0; margin-bottom: 12px; color: ${THEME.textPrimary};`}>Session State Timeline</h3>

      {/* Timeline bar */}
      <div
        css={css`
          display: flex;
          height: 40px;
          border: 1px solid ${THEME.borderPrimary};
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 12px;
        `}
      >
        {segments.map((seg, i) => (
          <div
            key={i}
            css={css`
              flex: ${seg.duration / sessionDuration};
              background-color: ${STATE_COLORS[seg.state]};
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: bold;
              color: white;
              text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.3);
            `}
            title={`${STATE_LABELS[seg.state]}: ${seg.duration.toFixed(1)}s`}
          >
            {seg.duration > 2 ? `${seg.duration.toFixed(1)}s` : ''}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div css={css`display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;`}>
        {Object.entries(STATE_COLORS).map(([state, color]) => (
          <div key={state} css={css`display: flex; align-items: center; gap: 6px;`}>
            <div
              css={css`
                width: 16px;
                height: 16px;
                background-color: ${color};
                border-radius: 2px;
              `}
            />
            <span css={css`font-size: 12px;`}>{STATE_LABELS[state as SessionState]}</span>
          </div>
        ))}
      </div>

      {/* Summary text */}
      <div css={css`font-size: 13px; color: ${THEME.textSecondary}; line-height: 1.6;`}>
        <p css={css`margin: 0 0 8px 0;`}>
          {segments.filter(s => s.state === 'FUSION').length} fusion episode
          {segments.filter(s => s.state === 'FUSION').length !== 1 ? 's' : ''} totalling{' '}
          {segments
            .filter(s => s.state === 'FUSION')
            .reduce((sum, s) => sum + s.duration, 0)
            .toFixed(1)}
          s. Session spent{' '}
          {((segments
            .filter(s => s.state === 'FUSION')
            .reduce((sum, s) => sum + s.duration, 0) / sessionDuration) *
            100).toFixed(0)}
          % in fusion state.
        </p>
      </div>
    </div>
  );
}
