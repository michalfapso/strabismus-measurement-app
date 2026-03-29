export interface SelectionBarProps {
  selectedCount: number;
  onExport: () => void;
  disabled?: boolean;
}

export function SelectionBar({ selectedCount, onExport, disabled = false }: SelectionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      backgroundColor: 'rgba(0,255,0,0.1)',
      border: '1px solid rgba(0,255,0,0.2)',
      borderRadius: '4px',
      padding: '12px 16px',
      color: '#fff',
      height: '48px',
    }}>
      <div style={{ flex: 1 }}>
        <strong>{selectedCount}</strong> {selectedCount === 1 ? 'session' : 'sessions'} selected
      </div>

      <button
        onClick={onExport}
        disabled={disabled}
        style={{
          padding: '6px 12px',
          fontSize: '12px',
          color: '#00ff00',
          backgroundColor: 'transparent',
          border: '1px solid #00ff00',
          borderRadius: '3px',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        📥 Export CSV
      </button>
    </div>
  );
}
