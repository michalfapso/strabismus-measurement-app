import { Session } from '../types';
import { getSessionDuration, getPositionRange } from '../services/stats';
import { THEME } from '../theme';

export interface HistoryListViewProps {
  sessions: Session[];
  selectedIds: Set<string>;
  onRowClick: (id: string, ctrlKey: boolean, shiftKey: boolean, visibleIds: string[]) => void;
  checkboxMode?: boolean;
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
  checkboxMode,
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
              onRowClick(session.sessionId, ctrl, shift, visibleIds);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              backgroundColor: isSelected ? 'rgba(0,255,0,0.15)' : 'transparent',
              borderLeft: isSelected ? '3px solid #00ff00' : '3px solid transparent',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              paddingLeft: '13px',
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
            {checkboxMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  onRowClick(session.sessionId, true, false, visibleIds);
                }}
                style={{
                  accentColor: THEME.accentGreen,
                  cursor: 'pointer',
                  marginRight: '8px',
                }}
                aria-label={`Select session ${session.sessionId}`}
              />
            )}

            {/* Exercise & Time */}
            <div style={{ minWidth: '140px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>
                {session.exerciseTag}
              </div>
              <div style={{ fontSize: '11px', color: '#aaa' }}>
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
          </div>
        );
      })}
    </div>
  );
}
