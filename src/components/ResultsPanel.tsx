import { Session } from '../types';
import SingleSessionView from './SingleSessionView';

export interface ResultsPanelProps {
  session: Session | null;
  visible: boolean;
  onDismiss: () => void;
}

export function ResultsPanel({ session, visible, onDismiss }: ResultsPanelProps) {
  if (!visible || !session) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 'min(800px, 100vw)',
        backgroundColor: 'rgba(10, 10, 10, 0.98)',
        border: '1px solid rgba(0,255,0,0.3)',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.7)',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      {/* Header with close button */}
      <div
        style={{
          padding: '12px 16px',
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0 4px',
            opacity: 0.7,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        >
          ✕
        </button>
      </div>

      {/* Content: SingleSessionView */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <SingleSessionView session={session} />
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
