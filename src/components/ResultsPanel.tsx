import { Session } from '../types';
import { useSessionStats } from '../hooks/useSessionStats';
import { prepareSessionGraphData } from '../services/graphData';
import { StatCards } from './StatCards';
import { PositionGraph } from './PositionGraph';
import { RotationGraph } from './RotationGraph';

export interface ResultsPanelProps {
  session: Session | null;
  visible: boolean;
  onDismiss: () => void;
}

export function ResultsPanel({ session, visible, onDismiss }: ResultsPanelProps) {
  const stats = useSessionStats(session);

  if (!visible || !session) {
    return null;
  }

  const graphData = prepareSessionGraphData(session);

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      width: 'min(400px, 100vw)',
      backgroundColor: 'rgba(10, 10, 10, 0.98)',
      border: '1px solid rgba(0,255,0,0.3)',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.7)',
      overflowY: 'auto',
      zIndex: 1001,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideIn 0.3s ease-out',
    }}>
      {/* Header with close & actions */}
      <div style={{
        padding: '16px',
        borderBottom: '2px solid rgba(0,255,0,0.2)',
        backgroundColor: 'rgba(0,255,0,0.05)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', color: '#0f0' }}>Measurement Results</h2>
          <button
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: '#0f0',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ fontSize: '12px', color: '#8f8', marginBottom: '8px' }}>
          {session.exerciseTag} • {new Date(session.timestamp).toLocaleTimeString()}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: 'rgba(0,255,0,0.2)',
              border: '1px solid #0f0',
              borderRadius: '3px',
              color: '#0f0',
              cursor: 'pointer',
            }}
          >
            📊 View in History
          </button>
          <button
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: 'rgba(0,255,0,0.2)',
              border: '1px solid #0f0',
              borderRadius: '3px',
              color: '#0f0',
              cursor: 'pointer',
            }}
          >
            ➕ New Session
          </button>
        </div>
      </div>

      {/* Stats & Graphs */}
      <div style={{
        flex: 1,
        padding: '16px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        <StatCards
          positionRange={stats.positionRange}
          rotationRange={stats.rotationRange}
          duration={stats.duration}
          meanDeviation={stats.meanDeviation}
          exerciseTag={session.exerciseTag}
        />

        <PositionGraph data={graphData} />
        <RotationGraph data={graphData} />
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
