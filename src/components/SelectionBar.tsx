export interface SelectionBarProps {
  selectedCount: number;
  filteredSessionCount: number;  // Total available sessions after filters
  onSelectAll: () => void;
  onSelectNone: () => void;
  onExport: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function SelectionBar({
  selectedCount,
  filteredSessionCount,
  onSelectAll,
  onSelectNone,
  onExport,
  onDelete,
  disabled = false,
}: SelectionBarProps) {
  const allSelected = selectedCount === filteredSessionCount && filteredSessionCount > 0;
  const noneSelected = selectedCount === 0;
  const selectAllEnabled = filteredSessionCount > 0 && !allSelected;
  const selectNoneEnabled = selectedCount > 0;

  const selectButtonBaseStyle = {
    padding: '6px 10px',
    fontSize: '12px',
    color: '#00ff00',
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    border: '1px solid #00ff00',
    borderRadius: '3px',
  };

  const actionButtonBaseStyle = {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    borderRadius: '3px',
  };

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
      minHeight: '48px',
    }}>
      {/* Selection control buttons (left) */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          aria-label="Select all filtered sessions"
          onClick={onSelectAll}
          disabled={!selectAllEnabled || disabled}
          style={{
            ...selectButtonBaseStyle,
            cursor: selectAllEnabled && !disabled ? 'pointer' : 'not-allowed',
            opacity: selectAllEnabled && !disabled ? 1 : 0.5,
          }}
        >
          All
        </button>

        <button
          aria-label="Clear all session selections"
          onClick={onSelectNone}
          disabled={!selectNoneEnabled || disabled}
          style={{
            ...selectButtonBaseStyle,
            cursor: selectNoneEnabled && !disabled ? 'pointer' : 'not-allowed',
            opacity: selectNoneEnabled && !disabled ? 1 : 0.5,
          }}
        >
          None
        </button>
      </div>

      {/* Selection count (center) */}
      <div style={{ flex: 1 }}>
        <strong>{selectedCount}</strong> {selectedCount === 1 ? 'session' : 'sessions'} selected
      </div>

      {/* Action buttons (right) */}
      <button
        aria-label="Export selected sessions to CSV"
        onClick={onExport}
        disabled={selectedCount === 0 || disabled}
        style={{
          ...actionButtonBaseStyle,
          color: '#00ff00',
          border: '1px solid #00ff00',
          cursor: selectedCount > 0 && !disabled ? 'pointer' : 'default',
          opacity: selectedCount > 0 && !disabled ? 1 : 0.5,
        }}
      >
        📥 Export CSV
      </button>

      <button
        aria-label="Delete selected sessions"
        onClick={onDelete}
        disabled={selectedCount === 0 || disabled}
        style={{
          ...actionButtonBaseStyle,
          color: '#ff6b6b',
          border: '1px solid #ff6b6b',
          cursor: selectedCount > 0 && !disabled ? 'pointer' : 'default',
          opacity: selectedCount > 0 && !disabled ? 1 : 0.5,
        }}
      >
        🗑 Delete
      </button>
    </div>
  );
}
