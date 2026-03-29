import { Session } from '../types';
import { getSessionDuration, getPositionRange } from '../services/stats';

export interface HistoryListViewProps {
  sessions: Session[];
  selectedIds: Set<string>;
  onRowClick: (id: string, ctrlKey: boolean, shiftKey: boolean, visibleIds: string[]) => void;
  onSessionSelect: (session: Session) => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function HistoryListView({
  sessions,
  selectedIds,
  onRowClick,
  onSessionSelect,
}: HistoryListViewProps) {
  if (sessions.length === 0) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: '#888',
        fontSize: '14px',
      }}>
        No sessions found in this date range
      </div>
    );
  }

  const visibleIds = sessions.map(s => s.sessionId);

  return (
    <div style={{ flex: 1, overflow: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
      {sessions.map((session) => {
        const isSelected = selectedIds.has(session.sessionId);
        const duration = getSessionDuration(session);
        const posRange = session.timeSeries.length > 0 ? getPositionRange(session) : null;

        return (
          <div
            key={session.sessionId}
            onClick={(e) => {
              const ctrl = (e as any).ctrlKey || (e as any).metaKey;
              const shift = (e as any).shiftKey;

              if (ctrl || shift) {
                onRowClick(session.sessionId, ctrl, shift, visibleIds);
              } else {
                onSessionSelect(session);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              backgroundColor: isSelected ? 'rgba(0,255,0,0.08)' : 'transparent',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                (e.currentTarget as any).style.backgroundColor = 'rgba(255,255,255,0.03)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                (e.currentTarget as any).style.backgroundColor = 'transparent';
              }
            }}
          >
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onRowClick(session.sessionId, true, false, visibleIds);
              }}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />

            {/* Exercise & Time */}
            <div style={{ minWidth: '140px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>
                {session.exerciseTag}
              </div>
              <div style={{ fontSize: '11px', color: '#888' }}>
                {new Date(session.timestamp).toLocaleString()}
              </div>
            </div>

            {/* Duration */}
            <div style={{ minWidth: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#aaa' }}>Duration</div>
              <div style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>
                {formatDuration(duration)}
              </div>
            </div>

            {/* Position Range */}
            {posRange && (
              <div style={{ minWidth: '100px' }}>
                <div style={{ fontSize: '12px', color: '#aaa' }}>Range</div>
                <div style={{ fontSize: '12px', color: '#4ECDC4' }}>
                  X: ±{posRange.xRange.toFixed(1)}cm
                </div>
                <div style={{ fontSize: '12px', color: '#FF6B6B' }}>
                  Y: ±{posRange.yRange.toFixed(1)}cm
                </div>
              </div>
            )}

            <div style={{ flex: 1 }} />

            {/* Selection indicator */}
            {isSelected && (
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#0f0',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
