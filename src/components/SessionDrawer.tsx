import React, { useState } from 'react';
import { css } from '@emotion/react';
import { Session } from '../types';
import { THEME } from '../theme';
import { HistoryListView } from './HistoryListView';
import { DateFilterBar } from './DateFilterBar';
import { ExerciseTypeFilterBar } from './ExerciseTypeFilterBar';

export interface SessionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dateRange: { from: Date; to: Date };
  onDateChange: (from: Date, to: Date) => void;
  distinctExerciseTypes: string[];
  selectedExerciseTypes: Set<string>;
  onExerciseTypeChange: (types: Set<string>) => void;
  sessions: Session[]; // filteredSessions passed from parent
  selectedIds: Set<string>;
  onRowClick: (id: string, ctrlKey: boolean, shiftKey: boolean, visibleIds: string[]) => void;
  selectedCount: number; // total selected (visible + hidden)
  hiddenCount: number;
  onSelectNone: () => void;
  onSelectAll?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
}

const backdropStyle = css`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;

  @media (min-width: 769px) {
    display: none;
  }

  &.open {
    opacity: 1;
    visibility: visible;
  }
`;

const drawerStyle = css`
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100vh;
  background: ${THEME.background};
  z-index: 999;
  transform: translateX(-100%);
  transition: transform 0.3s ease-in-out;
  display: flex;
  flex-direction: column;

  @media (min-width: 769px) {
    display: none;
  }

  &.open {
    transform: translateX(0);
  }
`;

const headerStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid ${THEME.borderPrimary};
  flex-shrink: 0;
`;

const titleStyle = css`
  font-size: 18px;
  font-weight: 600;
  color: ${THEME.textPrimary};
`;

const closeButtonStyle = css`
  background: none;
  border: none;
  color: ${THEME.textPrimary};
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
`;

const filterContainerStyle = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid ${THEME.borderSecondary};
  flex-shrink: 0;
`;

const listContainerStyle = css`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
`;

const statusBarStyle = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid ${THEME.borderPrimary};
  background: rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
`;

const statusRowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: ${THEME.textSecondary};
`;

const buttonGroupStyle = css`
  display: flex;
  gap: 6px;
  align-items: center;

  button {
    padding: 6px 10px;
    font-size: 12px;
    background-color: ${THEME.accentGreenLight};
    border: 1px solid ${THEME.accentGreen};
    border-radius: 3px;
    color: ${THEME.accentGreen};
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: ${THEME.accentGreenBorder};
    }

    &:active {
      background-color: ${THEME.accentGreenActive};
    }
  }
`;

const advancedControlsStyle = css`
  display: flex;
  gap: 6px;

  button {
    flex: 1;
    padding: 8px 12px;
    font-size: 12px;
    background-color: ${THEME.accentGreenLight};
    border: 1px solid ${THEME.accentGreen};
    border-radius: 3px;
    color: ${THEME.accentGreen};
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: ${THEME.accentGreenBorder};
    }

    &:active {
      background-color: ${THEME.accentGreenActive};
    }
  }
`;

export function SessionDrawer({
  isOpen,
  onClose,
  dateRange,
  onDateChange,
  distinctExerciseTypes,
  selectedExerciseTypes,
  onExerciseTypeChange,
  sessions,
  selectedIds,
  onRowClick,
  selectedCount,
  hiddenCount,
  onSelectNone,
  onSelectAll,
  onExport,
  onDelete,
}: SessionDrawerProps) {
  const [expandedControls, setExpandedControls] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart !== null) {
      const delta = e.touches[0].clientX - touchStart;
      // Only allow leftward drag (negative delta)
      if (delta < 0) {
        setSwipeOffset(delta);
      } else {
        setSwipeOffset(0);
      }
    }
  };

  const handleTouchEnd = () => {
    // If swipe is more than 80px leftward, close the drawer
    if (swipeOffset < -80) {
      onClose();
    }
    setSwipeOffset(0);
    setTouchStart(null);
  };

  const drawerTransform = swipeOffset < 0 ? `translateX(calc(-100% + ${swipeOffset}px))` : 'translateX(0)';

  return (
    <>
      {/* Backdrop */}
      <div
        css={backdropStyle}
        className={isOpen ? 'open' : ''}
        onClick={onClose}
        aria-hidden="true"
        data-component="SessionDrawerBackdrop"
      />

      {/* Drawer */}
      <div
        css={drawerStyle}
        className={isOpen ? 'open' : ''}
        data-component="SessionDrawer"
        style={{
          transform: drawerTransform,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div css={headerStyle}>
          <h2 css={titleStyle}>Sessions</h2>
          <button
            css={closeButtonStyle}
            onClick={(e) => {
              console.log('Close button clicked, onClose:', typeof onClose);
              e.stopPropagation();
              onClose?.();
            }}
            aria-label="Close drawer"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div css={filterContainerStyle}>
          <DateFilterBar
            currentRange={dateRange}
            onDateChange={onDateChange}
          />
          {distinctExerciseTypes.length > 0 && (
            <ExerciseTypeFilterBar
              distinctTypes={distinctExerciseTypes}
              selectedTypes={selectedExerciseTypes}
              onSelectedTypesChange={onExerciseTypeChange}
            />
          )}
        </div>

        {/* Session List */}
        <div css={listContainerStyle}>
          <HistoryListView
            sessions={sessions}
            selectedIds={selectedIds}
            onRowClick={onRowClick}
            checkboxMode={true}
          />
        </div>

        {/* Status Bar */}
        <div css={statusBarStyle}>
          {/* Row 1: Always visible */}
          <div css={statusRowStyle}>
            <span>
              {selectedCount} {selectedCount === 1 ? 'session' : 'sessions'} selected
              {hiddenCount > 0 && ` · ${hiddenCount} hidden by filter`}
            </span>
            <div css={buttonGroupStyle}>
              {onSelectAll && (
                <button onClick={onSelectAll} title="Select all sessions">
                  All
                </button>
              )}
              <button onClick={onSelectNone} title="Deselect all sessions">
                None
              </button>
              <button
                onClick={() => setExpandedControls(!expandedControls)}
                aria-label="Toggle advanced controls"
                title={expandedControls ? 'Collapse controls' : 'Expand controls'}
              >
                {expandedControls ? '⌃' : '⌄'}
              </button>
            </div>
          </div>

          {/* Row 2: Expandable advanced controls */}
          {expandedControls && (
            <div css={advancedControlsStyle}>
              {onExport && (
                <button onClick={onExport} title="Export selected sessions as CSV">
                  Export CSV
                </button>
              )}
              {onDelete && (
                <button onClick={onDelete} title="Delete selected sessions">
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
