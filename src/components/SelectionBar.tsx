import { useState } from 'react';
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
  const [expandedControls, setExpandedControls] = useState(false);

  const allSelected = visibleSelectedCount === filteredSessionCount && filteredSessionCount > 0;
  const noneSelected = selectedCount === 0;
  const selectAllEnabled = filteredSessionCount > 0 && !allSelected;
  const selectNoneEnabled = selectedCount > 0;

  const buttonBaseStyle = {
    padding: '6px 10px',
    fontSize: '12px',
    color: THEME.accentGreen,
    backgroundColor: THEME.accentGreenLight,
    border: `1px solid ${THEME.accentGreen}`,
    borderRadius: '3px',
    cursor: 'pointer',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      backgroundColor: THEME.accentGreenLight,
      border: `1px solid ${THEME.accentGreenBorder}`,
      borderRadius: '4px',
      padding: '12px 16px',
      color: THEME.textPrimary,
    }} data-component="SelectionBar">
      {/* Row 1: Always visible - selection count + All/None + expand toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
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

        <div style={{ display: 'flex', gap: '6px', whiteSpace: 'nowrap' }}>
          <button
            aria-label="Select all filtered sessions"
            onClick={onSelectAll}
            disabled={!selectAllEnabled || disabled}
            style={{
              ...buttonBaseStyle,
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
              ...buttonBaseStyle,
              cursor: selectNoneEnabled && !disabled ? 'pointer' : 'not-allowed',
              opacity: selectNoneEnabled && !disabled ? 1 : 0.5,
            }}
          >
            None
          </button>

          <button
            aria-label={expandedControls ? 'Collapse controls' : 'Expand controls'}
            onClick={() => setExpandedControls(!expandedControls)}
            title={expandedControls ? 'Collapse controls' : 'Expand controls'}
            style={{
              ...buttonBaseStyle,
              padding: '6px 8px',
              width: '32px',
            }}
          >
            {expandedControls ? '⌃' : '⌄'}
          </button>
        </div>
      </div>

      {/* Row 2: Expandable advanced controls */}
      {expandedControls && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            aria-label="Export selected sessions to CSV"
            onClick={onExport}
            disabled={selectedCount === 0 || disabled}
            style={{
              ...buttonBaseStyle,
              flex: 1,
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
              ...buttonBaseStyle,
              flex: 1,
              color: THEME.stateDrifting,
              border: `1px solid ${THEME.stateDrifting}`,
              cursor: selectedCount > 0 && !disabled ? 'pointer' : 'default',
              opacity: selectedCount > 0 && !disabled ? 1 : 0.5,
            }}
          >
            🗑 Delete
          </button>
        </div>
      )}
    </div>
  );
}
