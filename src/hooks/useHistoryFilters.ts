import { useState, useMemo } from 'react';
import { Session } from '../types';

export interface DateRange {
  from: Date;
  to: Date;
}

const STORAGE_KEY = 'historyDateRange';

/**
 * Hook to manage date filtering for history page
 * Persists filter state to sessionStorage
 */
export function useHistoryFilters(sessions: Session[]) {
  const [dateRange, setDateRangeState] = useState<DateRange>(() => {
    // Try to restore from sessionStorage
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          from: new Date(parsed.from),
          to: new Date(parsed.to),
        };
      } catch {
        // Ignore parse errors, fall through to default
      }
    }

    // Default: last 30 days
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    return { from, to };
  });

  const setDateRange = (from: Date, to: Date) => {
    const range = { from, to };
    setDateRangeState(range);
    // Persist to sessionStorage
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        from: from.toISOString(),
        to: to.toISOString(),
      })
    );
  };

  // Filter sessions based on date range
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const sessionDate = new Date(session.timestamp);
      return sessionDate >= dateRange.from && sessionDate <= dateRange.to;
    });
  }, [sessions, dateRange]);

  // Preset helpers
  const setPresetLast7Days = () => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    setDateRange(from, to);
  };

  const setPresetLast30Days = () => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    setDateRange(from, to);
  };

  const setPresetThisMonth = () => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    setDateRange(from, to);
  };

  const setPresetAllTime = () => {
    const from = new Date('2000-01-01');
    const to = new Date();
    setDateRange(from, to);
  };

  return {
    dateRange,
    setDateRange,
    filteredSessions,
    setPresetLast7Days,
    setPresetLast30Days,
    setPresetThisMonth,
    setPresetAllTime,
  };
}
