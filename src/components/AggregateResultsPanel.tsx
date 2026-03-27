import { Session } from '../types';

export interface AggregateResultsPanelProps {
  sessions: Session[];
  onClose: () => void;
}

export function AggregateResultsPanel({ sessions, onClose }: AggregateResultsPanelProps) {
  return (
    <div style={{ padding: '16px', color: '#fff' }}>
      <div style={{ fontSize: '14px', marginBottom: '12px' }}>
        <strong>{sessions.length} sessions selected</strong>
      </div>
      <button onClick={onClose} style={{ padding: '6px 12px', backgroundColor: '#666', border: 'none', borderRadius: '3px', color: '#fff', cursor: 'pointer' }}>
        Close
      </button>
    </div>
  );
}
