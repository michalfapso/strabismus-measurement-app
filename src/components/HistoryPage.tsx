import { useContext, useState, useEffect, useMemo } from 'react';
import { Session } from '../types';
import { SessionContext } from '../context/SessionContext';
import { useViewState } from '../hooks/useViewState';
import { DateFilterBar } from './DateFilterBar';
import { ExerciseTypeFilterBar } from './ExerciseTypeFilterBar';
import { HistoryListView } from './HistoryListView';
import { SelectionBar } from './SelectionBar';
import { UnifiedSessionPanel } from './UnifiedSessionPanel';
import SingleSessionView from './SingleSessionView';
import MultiSessionAnalysisView from './MultiSessionAnalysisView';
import { downloadCSV } from '../services/export';
import { computeSessionMetrics } from '../utils/sessionMetrics';
import { getAnalysisSettings } from '../utils/analysisSettings';

export interface HistoryPageProps {}

export function HistoryPage({}: HistoryPageProps) {
  const { loadHistoricalSessions, deleteSelectedSessions } = useContext(SessionContext);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisConfig, setAnalysisConfig] = useState<{
    metrics: ('deviation' | 'rotation')[];
    thresholds: { deviation: number; rotation: number };
    sustainedDays: number;
  }>(() => {
    const settings = getAnalysisSettings();
    return {
      metrics: ['deviation'],
      thresholds: settings.goal.thresholds,
      sustainedDays: settings.goal.sustainedDays,
    };
  });

  const {
    state,
    updateFilters,
    updateSelectedSessions,
  } = useViewState();

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessions = await loadHistoricalSessions();
        setAllSessions(sessions);
      } catch (error) {
        console.error('Failed to load sessions:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSessions();
  }, [loadHistoricalSessions]);

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
  // If exerciseType is null, show all types selected
  const selectedExerciseTypes = useMemo(() => {
    if (state.filters.exerciseType === null) {
      return new Set(distinctExerciseTypes);
    }
    return new Set([state.filters.exerciseType]);
  }, [state.filters.exerciseType, distinctExerciseTypes]);

  // Filter sessions based on date range AND exercise type
  const filteredSessions = useMemo(() => {
    return allSessions.filter((session) => {
      const sessionDate = new Date(session.timestamp);
      const inDateRange = sessionDate >= dateRange.from && sessionDate <= dateRange.to;
      const inSelectedTypes = selectedExerciseTypes.has(session.exerciseTag);
      return inDateRange && inSelectedTypes;
    });
  }, [allSessions, dateRange, selectedExerciseTypes]);

  // Update selection when filters change
  useEffect(() => {
    const visibleIds = filteredSessions.map((s) => s.sessionId);
    const filtered = new Set(
      Array.from(state.selectedSessions).filter((id) => visibleIds.includes(id))
    );
    if (filtered.size !== state.selectedSessions.size ||
        Array.from(filtered).some((id) => !state.selectedSessions.has(id))) {
      updateSelectedSessions(filtered);
    }
  }, [filteredSessions, state.selectedSessions, updateSelectedSessions]);

  const handleDateChange = (from: Date, to: Date) => {
    const [actualFrom, actualTo] = from <= to ? [from, to] : [to, from];
    updateFilters({
      dateRange: [actualFrom.getTime(), actualTo.getTime()],
    });
  };

  const handleExerciseTypeChange = (types: Set<string>) => {
    // LIMITATION: useViewState only supports filtering by a single exerciseType at a time
    // If the user selects multiple types, we select only the first one
    // If all types are selected, we set exerciseType to null (show all)
    // TODO: Consider extending useViewState.filters.exerciseType to support Set<string> for true multi-select

    if (types.size === distinctExerciseTypes.length) {
      // All types selected: show all exercises
      updateFilters({ exerciseType: null });
    } else if (types.size > 0) {
      // Single or multiple types: apply the first selected type
      // Note: This silently ignores additional selections when count > 1
      updateFilters({ exerciseType: Array.from(types)[0] });
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

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(10, 10, 10, 0.98)',
      border: '1px solid rgba(255,255,255,0.1)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.3)',
        flexShrink: 0,
      }}>
        <h1 style={{ margin: '0 0 12px 0', fontSize: '20px', color: '#fff' }}>Session History</h1>
        <DateFilterBar currentRange={dateRange} onDateChange={handleDateChange} />
        <ExerciseTypeFilterBar
          distinctTypes={distinctExerciseTypes}
          selectedTypes={selectedExerciseTypes}
          onSelectedTypesChange={handleExerciseTypeChange}
        />
      </div>

      {/* Main content */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* List side */}
        <div style={{
          width: '300px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: '1px solid rgba(255,255,255,0.1)',
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              color: '#888',
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
              {selectedCount > 0 && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <SelectionBar
                    selectedCount={selectedCount}
                    onExport={handleExport}
                    onDelete={handleDelete}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail side */}
        <div style={{
          flex: 1,
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          overflow: 'auto',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {selectedCount === 0 && (
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
          )}

          {selectedCount === 1 && selectedSessions.length > 0 && (
            (() => {
              try {
                const metrics = computeSessionMetrics(
                  selectedSessions[0],
                  analysisConfig.thresholds,
                  analysisConfig.metrics[0]
                );
                return (
                  <SingleSessionView
                    metrics={metrics}
                    session={selectedSessions[0]}
                  />
                );
              } catch {
                return (
                  <div style={{ padding: '16px', color: '#999' }}>
                    Unable to compute metrics (session may be too short)
                  </div>
                );
              }
            })()
          )}

          {selectedCount > 1 && (
            <MultiSessionAnalysisView
              sessions={selectedSessions}
              config={analysisConfig}
              onConfigChange={(config) => setAnalysisConfig(config)}
            />
          )}

          {/* Keep UnifiedSessionPanel as fallback for backward compatibility */}
          {selectedCount > 1 && false && (
            <UnifiedSessionPanel sessions={selectedSessions} />
          )}
        </div>
      </div>
    </div>
  );
}
