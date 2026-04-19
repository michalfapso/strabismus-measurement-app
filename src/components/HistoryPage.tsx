import { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { css } from '@emotion/react';
import { Session } from '../types';
import { SessionContext } from '../context/SessionContext';
import { useViewState } from '../hooks/useViewState';
import { DateFilterBar } from './DateFilterBar';
import { ExerciseTypeFilterBar } from './ExerciseTypeFilterBar';
import { HistoryListView } from './HistoryListView';
import { SelectionBar } from './SelectionBar';
import { SessionDrawer } from './SessionDrawer';
import SingleSessionView from './SingleSessionView';
import MultiSessionAnalysisView from './MultiSessionAnalysisView';
import { downloadCSV } from '../services/export';
import { THEME } from '../theme';

export interface HistoryPageProps {}

export function HistoryPage({}: HistoryPageProps) {
  const { loadHistoricalSessions, deleteSelectedSessions } = useContext(SessionContext);
  const location = useLocation();
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drillDownSessionId, setDrillDownSessionId] = useState<string | null>(null);

  const {
    state,
    updateFilters,
    updateSelectedSessions,
  } = useViewState();

  const autoSelectDoneRef = useRef(false);

  // Save the History page URL to localStorage whenever it changes
  useEffect(() => {
    const fullUrl = window.location.pathname + window.location.search;
    localStorage.setItem('lastHistoryUrl', fullUrl);
  }, [location]);

  // Resize listener for mobile/desktop responsiveness
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessions = await loadHistoricalSessions();
        setAllSessions(sessions);

        // Auto-select last 30 sessions on first load (only once)
        if (!autoSelectDoneRef.current && state.selectedSessions.size === 0 && sessions.length > 0) {
          autoSelectDoneRef.current = true;
          const sorted = [...sessions].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          updateSelectedSessions(new Set(sorted.slice(0, 30).map(s => s.sessionId)));
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSessions();
  }, [loadHistoricalSessions, updateSelectedSessions]);

  // Compute distinct exercise types from sessions
  const distinctExerciseTypes = useMemo(() => {
    const types = new Set(allSessions.map((s) => s.exerciseTag).filter(Boolean));
    return Array.from(types).sort();
  }, [allSessions]);

  // Convert dateRange timestamps to Date objects for DateFilterBar
  // Handle infinity edge case: convert to current time
  const dateRange = useMemo(() => {
    const now = Date.now();
    return {
      from: new Date(state.filters.dateRange[0] === -Infinity ? 0 : state.filters.dateRange[0]),
      to: new Date(state.filters.dateRange[1] === Infinity ? now : state.filters.dateRange[1]),
    };
  }, [state.filters.dateRange]);

  // Build selectedExerciseTypes set for ExerciseTypeFilterBar
  // If exerciseTypes is null, show all types selected
  const selectedExerciseTypes = useMemo(() => {
    if (state.filters.exerciseTypes === null) {
      return new Set(distinctExerciseTypes);
    }
    return new Set(state.filters.exerciseTypes);
  }, [state.filters.exerciseTypes, distinctExerciseTypes]);

  // Filter sessions based on date range AND exercise type
  const filteredSessions = useMemo(() => {
    return allSessions.filter((session) => {
      const sessionDate = new Date(session.timestamp);
      const inDateRange = sessionDate >= dateRange.from && sessionDate <= dateRange.to;
      const inSelectedTypes = selectedExerciseTypes.has(session.exerciseTag);
      return inDateRange && inSelectedTypes;
    });
  }, [allSessions, dateRange, selectedExerciseTypes]);

  // Compute hidden count: selected sessions not visible due to filters
  const hiddenCount = useMemo(() => {
    const visibleIds = new Set(filteredSessions.map(s => s.sessionId));
    return Array.from(state.selectedSessions).filter(id => !visibleIds.has(id)).length;
  }, [filteredSessions, state.selectedSessions]);

  // Compute visible selected count
  const visibleSelectedCount = useMemo(() => {
    return filteredSessions.filter(s =>
      state.selectedSessions.has(s.sessionId)
    ).length;
  }, [filteredSessions, state.selectedSessions]);

  const handleDateChange = (from: Date, to: Date) => {
    const [actualFrom, actualTo] = from <= to ? [from, to] : [to, from];
    updateFilters({
      dateRange: [actualFrom.getTime(), actualTo.getTime()],
    });
  };

  const handleExerciseTypeChange = (types: Set<string>) => {
    if (types.size === distinctExerciseTypes.length) {
      // All types selected: show all exercises
      updateFilters({ exerciseTypes: null });
    } else if (types.size > 0) {
      // Selected types: filter to show only these exercises
      updateFilters({ exerciseTypes: new Set(types) });
    } else {
      // No types selected: show none (filter to empty set)
      updateFilters({ exerciseTypes: new Set() });
    }
  };

  const handleExport = () => {
    const selectedSessionIds = Array.from(state.selectedSessions);
    const selectedSessions = selectedSessionIds
      .map(id => allSessions.find(s => s.sessionId === id))
      .filter(s => s !== undefined) as Session[];

    if (selectedSessions.length > 0) {
      downloadCSV(selectedSessions);
    }
  };

  const handleDelete = async () => {
    const selectedSessionIds = Array.from(state.selectedSessions);
    if (selectedSessionIds.length === 0) return;

    if (window.confirm(`Delete ${selectedSessionIds.length} session${selectedSessionIds.length > 1 ? 's' : ''}?`)) {
      await deleteSelectedSessions(selectedSessionIds);
      setAllSessions(allSessions.filter(s => !selectedSessionIds.includes(s.sessionId)));
      updateSelectedSessions(new Set());
    }
  };

  const handleSelectAll = () => {
    const visibleIds = filteredSessions.map((s) => s.sessionId);
    updateSelectedSessions(new Set(visibleIds));
  };

  const handleSelectNone = () => {
    updateSelectedSessions(new Set());
  };

  const handleRowClick = (id: string, ctrlKey: boolean, shiftKey: boolean, visibleIds: string[]) => {
    let nextSelection: Set<string>;

    if (shiftKey) {
      // Shift+click: select range from last selected to clicked item
      const selectedArray = Array.from(state.selectedSessions);
      const anchorId = selectedArray[selectedArray.length - 1];

      if (anchorId) {
        const anchorIndex = visibleIds.indexOf(anchorId);
        const currentIndex = visibleIds.indexOf(id);
        if (anchorIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(anchorIndex, currentIndex);
          const end = Math.max(anchorIndex, currentIndex);
          nextSelection = new Set(visibleIds.slice(start, end + 1));
        } else {
          nextSelection = new Set([id]);
        }
      } else {
        nextSelection = new Set([id]);
      }
    } else if (ctrlKey) {
      // Ctrl+click: toggle
      nextSelection = new Set(state.selectedSessions);
      if (nextSelection.has(id)) {
        nextSelection.delete(id);
      } else {
        nextSelection.add(id);
      }
    } else {
      // Plain click: select only this item
      nextSelection = new Set([id]);
    }

    updateSelectedSessions(nextSelection);
  };

  const selectedCount = state.selectedSessions.size;

  // Memoize selectedSessions to avoid O(n²) computation on every render
  const selectedSessions = useMemo(() => {
    return Array.from(state.selectedSessions)
      .map(id => allSessions.find(s => s.sessionId === id))
      .filter(s => s !== undefined) as Session[];
  }, [state.selectedSessions, allSessions]);

  // Styles
  const styles = {
    outerStyle: css`
      position: fixed;
      inset: 0;
      background-color: rgba(10, 10, 10, 0.98);
      border: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 100;
      display: flex;
      flex-direction: column;

      @media (max-width: 768px) {
        padding: 0;
      }
    `,
    headerStyle: css`
      padding: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background-color: rgba(0, 0, 0, 0.3);
      flex-shrink: 0;

      h1 {
        margin: 0 0 12px 0;
        font-size: 20px;
        color: #fff;
      }

      @media (max-width: 768px) {
        padding: 8px 16px;

        h1 {
          font-size: 18px;
          margin: 0 0 8px 0;
        }
      }
    `,
    leftPanelStyle: css`
      width: fit-content;
      min-width: 300px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-right: 1px solid rgba(255, 255, 255, 0.1);

      @media (max-width: 768px) {
        display: none;
      }
    `,
    rightPanelStyle: css`
      flex: 1;
      border-left: 1px solid rgba(255, 255, 255, 0.1);
      overflow: auto;
      position: relative;
      display: flex;
      flex-direction: column;

      @media (max-width: 768px) {
        border-left: none;
      }
    `,
    mainContentStyle: css`
      display: flex;
      flex: 1;
      overflow: hidden;

      @media (max-width: 768px) {
        flex-direction: column;
      }
    `,
    funnelButtonStyle: css`
      display: none;

      @media (max-width: 768px) {
        display: flex;
        position: fixed;
        bottom: 24px;
        left: 24px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.85);
        border: 2px solid ${THEME.accentGreen};
        z-index: 201;
        cursor: pointer;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        color: ${THEME.accentGreen};
        transition: all 0.2s;

        &:hover {
          background: rgba(0, 255, 0, 0.1);
          text-shadow: 0 0 8px ${THEME.accentGreen};
        }

        &:active {
          transform: scale(0.95);
        }
      }
    `,
  };

  // Empty state component
  const EmptyState = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      color: '#999',
      fontSize: '14px',
    }}>
      Select one or more sessions to view analysis
    </div>
  );

  return (
    <div css={styles.outerStyle} data-component="HistoryPage">
      {/* Header */}
      <div css={styles.headerStyle}>
        <h1>Session History</h1>
        {!isMobile && (
          <>
            <DateFilterBar currentRange={dateRange} onDateChange={handleDateChange} />
            <ExerciseTypeFilterBar
              distinctTypes={distinctExerciseTypes}
              selectedTypes={selectedExerciseTypes}
              onSelectedTypesChange={handleExerciseTypeChange}
            />
          </>
        )}
      </div>

      {/* Main content */}
      <div css={styles.mainContentStyle}>
        {/* Left Panel (Desktop only) */}
        <div css={styles.leftPanelStyle}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              color: '#ddd',
            }}>
              Loading sessions...
            </div>
          ) : (
            <>
              <HistoryListView
                sessions={filteredSessions}
                selectedIds={state.selectedSessions}
                onRowClick={handleRowClick}
              />
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                <SelectionBar
                  selectedCount={selectedCount}
                  filteredSessionCount={filteredSessions.length}
                  visibleSelectedCount={visibleSelectedCount}
                  hiddenCount={hiddenCount}
                  onSelectAll={handleSelectAll}
                  onSelectNone={handleSelectNone}
                  onExport={handleExport}
                  onDelete={handleDelete}
                />
              </div>
            </>
          )}
        </div>

        {/* Right Panel */}
        <div css={styles.rightPanelStyle}>
          {drillDownSessionId !== null ? (
            /* Case 1: User drilled down from multi-session to single session */
            (() => {
              const session = allSessions.find(s => s.sessionId === drillDownSessionId);
              return session
                ? <SingleSessionView session={session} onBack={() => setDrillDownSessionId(null)} />
                : null;
            })()
          ) : selectedCount === 0 ? (
            /* Case 2: No sessions selected - show empty state */
            <EmptyState />
          ) : selectedCount === 1 && selectedSessions.length > 0 ? (
            /* Case 3a: Exactly 1 session selected - show that session (no back button) */
            <SingleSessionView session={selectedSessions[0]} />
          ) : (
            /* Case 3b: Multiple sessions selected - show analysis with drill-down */
            <MultiSessionAnalysisView
              sessions={selectedSessions}
              onDrillDown={(sessionId) => setDrillDownSessionId(sessionId)}
            />
          )}
        </div>
      </div>

      {/* Mobile SessionDrawer */}
      <SessionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        dateRange={dateRange}
        onDateChange={handleDateChange}
        distinctExerciseTypes={distinctExerciseTypes}
        selectedExerciseTypes={selectedExerciseTypes}
        onExerciseTypeChange={handleExerciseTypeChange}
        sessions={filteredSessions}
        selectedIds={state.selectedSessions}
        onRowClick={handleRowClick}
        selectedCount={selectedCount}
        hiddenCount={hiddenCount}
        onSelectNone={handleSelectNone}
        onSelectAll={handleSelectAll}
        onExport={handleExport}
        onDelete={handleDelete}
      />

      {/* Mobile Floating Funnel Button */}
      <button
        css={styles.funnelButtonStyle}
        onClick={() => setIsDrawerOpen(true)}
        aria-label="Open session list"
        title="Open session filter and list"
        data-component="FunnelButton"
      >
        ⧩
      </button>
    </div>
  );
}
