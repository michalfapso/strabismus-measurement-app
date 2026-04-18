import { THEME } from '../theme';

export interface SelectionBarProps {
  /** Total count of all selected sessions (visible + hidden) */
  selectedCount: number;
  /** Total sessions visible under current filters */
  filteredSessionCount: number;
  /** Selected sessions that are currently visible (subset of selectedCount) */
  visibleSelectedCount: number;
  /** Selected sessions hidden by current filters */
  hiddenCount: number;
  /** Callback to select all filtered sessions */
  onSelectAll: () => void;
  /** Callback to deselect all sessions */
  onSelectNone: () => void;
  /** Callback to export selected sessions */
  onExport: () => void;
  /** Callback to delete selected sessions */
  onDelete: () => void;
  /** Disable all interactions when true */
  disabled?: boolean;
}

export function SelectionBar({
  selectedCount,
  filteredSessionCount,
  visibleSelectedCount,
  hiddenCount,
  onSelectAll,
  onSelectNone,
  onExport,
  onDelete,
  disabled = false,
}: SelectionBarProps) {
  const allSelected = visibleSelectedCount === filteredSessionCount && filteredSessionCount > 0;
  const noneSelected = selectedCount === 0;
  const selectAllEnabled = filteredSessionCount > 0 && !allSelected;
  const selectNoneEnabled = selectedCount > 0;

  const selectButtonBaseStyle = {
    padding: '6px 10px',
    fontSize: '12px',
    color: THEME.accentGreen,
    backgroundColor: THEME.accentGreenLight,
    border: `1px solid ${THEME.accentGreen}`,
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
      backgroundColor: THEME.accentGreenLight,
      border: `1px solid ${THEME.accentGreenBorder}`,
      borderRadius: '4px',
      padding: '12px 16px',
      color: THEME.textPrimary,
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
        <div>
          <strong>{selectedCount}</strong> {selectedCount === 1 ? 'session' : 'sessions'} selected
        </div>
        {hiddenCount > 0 && (
          <div style={{ fontSize: '11px', color: THEME.textMuted, marginTop: '2px' }}>
            {hiddenCount} of them {hiddenCount === 1 ? 'is' : 'are'} hidden by filter
          </div>
        )}
      </div>

      {/* Action buttons (right) */}
      <button
        aria-label="Export selected sessions to CSV"
        onClick={onExport}
        disabled={selectedCount === 0 || disabled}
        style={{
          ...actionButtonBaseStyle,
          color: THEME.accentGreen,
          border: `1px solid ${THEME.accentGreen}`,
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
          color: THEME.stateDrifting,
          border: `1px solid ${THEME.stateDrifting}`,
          cursor: selectedCount > 0 && !disabled ? 'pointer' : 'default',
          opacity: selectedCount > 0 && !disabled ? 1 : 0.5,
        }}
      >
        🗑 Delete
      </button>
    </div>
  );
}
