import { useContext, useState, useEffect } from 'react';
import { Session } from '../types';
import { SessionContext } from '../context/SessionContext';
import { useHistoryFilters } from '../hooks/useHistoryFilters';
import { useMultiSelect } from '../hooks/useMultiSelect';
import { DateFilterBar } from './DateFilterBar';
import { HistoryListView } from './HistoryListView';
import { SelectionBar } from './SelectionBar';
import { SessionDetailPanel } from './SessionDetailPanel';
import { AggregateResultsPanel } from './AggregateResultsPanel';

export interface HistoryPageProps {
  onNavigateBack: () => void;
}

export function HistoryPage({ onNavigateBack }: HistoryPageProps) {
  const { loadHistoricalSessions } = useContext(SessionContext);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailSession, setDetailSession] = useState<Session | null>(null);

  const { dateRange, filteredSessions, setDateRange } = useHistoryFilters(allSessions);
  const { selectedIds, handleRowClick, clearSelection, getSelectedArray } = useMultiSelect();

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

  const handleExport = () => {
    const selectedSessions = getSelectedArray()
      .map(id => allSessions.find(s => s.sessionId === id))
      .filter(s => s !== undefined) as Session[];

    // TODO: Implement CSV export
    console.log('Exporting', selectedSessions.length, 'sessions');
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>Session History</h1>
          <button
            onClick={onNavigateBack}
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            ← Back to Measurement
          </button>
        </div>
        <DateFilterBar currentRange={dateRange} onDateChange={setDateRange} />
      </div>

      {/* Main content */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* List side */}
        <div style={{
          flex: 1,
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
                onSessionSelect={setDetailSession}
              />
              {selectedCount > 0 && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <SelectionBar
                    selectedCount={selectedCount}
                    onExport={handleExport}
                    onClear={clearSelection}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail side */}
        {detailSession && (
          <div style={{
            width: '400px',
            maxWidth: '40%',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            overflow: 'auto',
            position: 'relative',
          }}>
            <SessionDetailPanel
              session={detailSession}
              onClose={() => setDetailSession(null)}
            />
          </div>
        )}

        {selectedCount > 1 && !detailSession && (
          <div style={{
            width: '400px',
            maxWidth: '40%',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            overflow: 'auto',
            position: 'relative',
          }}>
            <AggregateResultsPanel
              sessions={selectedSessions}
              onClose={clearSelection}
            />
          </div>
        )}
      </div>
    </div>
  );
}
