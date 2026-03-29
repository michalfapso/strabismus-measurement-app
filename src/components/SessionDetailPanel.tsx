/**
 * @deprecated Use UnifiedSessionPanel instead. This component is kept for reference only.
 * All functionality has been migrated to UnifiedSessionPanel.
 */

import { Session } from '../types';
import { useSessionStats } from '../hooks/useSessionStats';
import { prepareSessionGraphData } from '../services/graphData';
import { StatCards } from './StatCards';
import { PositionGraph } from './PositionGraph';
import { RotationGraph } from './RotationGraph';

export interface SessionDetailPanelProps {
  session: Session | null;
  onClose: () => void;
}

export function SessionDetailPanel({ session, onClose }: SessionDetailPanelProps) {
  const stats = useSessionStats(session);

  if (!session) {
    return null;
  }

  const graphData = prepareSessionGraphData(session);

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      width: '400px',
      maxWidth: '100vw',
      backgroundColor: 'rgba(10, 10, 10, 0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      overflowY: 'auto',
      zIndex: 999,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '-2px 0 10px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#fff' }}>
            {session.exerciseTag}
          </h2>
          <div style={{ fontSize: '12px', color: '#888' }}>
            {new Date(session.timestamp).toLocaleDateString()}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '6px 10px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '3px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <StatCards
          positionRange={stats.positionRange}
          rotationRange={stats.rotationRange}
          duration={stats.duration}
          meanDeviation={stats.meanDeviation}
          exerciseTag={session.exerciseTag}
        />

        <PositionGraph data={graphData} title="Position" />
        <RotationGraph data={graphData} title="Rotation" />
      </div>
    </div>
  );
}
