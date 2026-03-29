import { useContext, useState, useEffect } from 'react';
import { Session } from '../types';
import { SessionContext } from '../context/SessionContext';
import { useHistoryFilters } from '../hooks/useHistoryFilters';
import { useMultiSelect } from '../hooks/useMultiSelect';
import { DateFilterBar } from './DateFilterBar';
import { ExerciseTypeFilterBar } from './ExerciseTypeFilterBar';
import { HistoryListView } from './HistoryListView';
import { SelectionBar } from './SelectionBar';
import { SessionDetailPanel } from './SessionDetailPanel';
import { AggregateResultsPanel } from './AggregateResultsPanel';
import { downloadCSV } from '../services/export';

export interface HistoryPageProps {}

export function HistoryPage({}: HistoryPageProps) {
  const { loadHistoricalSessions, deleteSelectedSessions } = useContext(SessionContext);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    dateRange,
    filteredSessions,
    setDateRange,
    distinctExerciseTypes,
    selectedExerciseTypes,
    setSelectedExerciseTypes,
  } = useHistoryFilters(allSessions);
  const {
    selectedIds,
    handleRowClick,
    clearSelection,
    updateSelectionAfterFilter,
    getSelectedArray,
  } = useMultiSelect();

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

  // Update selection when filters change
  useEffect(() => {
    const visibleIds = filteredSessions.map((s) => s.sessionId);
    updateSelectionAfterFilter(visibleIds);
  }, [filteredSessions, updateSelectionAfterFilter]);

  const handleExport = () => {
    const selectedSessions = getSelectedArray()
      .map(id => allSessions.find(s => s.sessionId === id))
      .filter(s => s !== undefined) as Session[];

    if (selectedSessions.length > 0) {
      downloadCSV(selectedSessions);
    }
  };

  const handleDelete = async () => {
    const selectedSessionIds = getSelectedArray();
    if (selectedSessionIds.length === 0) return;

    if (window.confirm(`Delete ${selectedSessionIds.length} session${selectedSessionIds.length > 1 ? 's' : ''}?`)) {
      await deleteSelectedSessions(selectedSessionIds);
      setAllSessions(allSessions.filter(s => !selectedSessionIds.includes(s.sessionId)));
    }
  };

  const selectedCount = selectedIds.size;
  const selectedSessions = getSelectedArray()
    .map(id => allSessions.find(s => s.sessionId === id))
    .filter(s => s !== undefined) as Session[];

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
        <DateFilterBar currentRange={dateRange} onDateChange={setDateRange} />
        <ExerciseTypeFilterBar
          distinctTypes={distinctExerciseTypes}
          selectedTypes={selectedExerciseTypes}
          onSelectedTypesChange={setSelectedExerciseTypes}
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
                selectedIds={selectedIds}
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
        {selectedCount === 1 && (
          <div style={{
            flex: 1,
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            overflow: 'auto',
            position: 'relative',
          }}>
            <SessionDetailPanel
              session={selectedSessions[0]}
              onClose={() => {}}
            />
          </div>
        )}

        {selectedCount > 1 && (
          <div style={{
            flex: 1,
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            overflow: 'auto',
            position: 'relative',
          }}>
            <AggregateResultsPanel
              sessions={selectedSessions}
            />
          </div>
        )}
      </div>
    </div>
  );
}
