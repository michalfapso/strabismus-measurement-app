import { useState, useMemo, useEffect, useCallback } from 'react';
import { Session } from '../types';

export interface DateRange {
  from: Date;
  to: Date;
}

const STORAGE_KEY = 'historyDateRange';
const EXERCISE_TYPES_STORAGE_KEY = 'historyExerciseTypes';

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
    // Swap if reversed
    const [actualFrom, actualTo] = from <= to ? [from, to] : [to, from];
    setDateRangeState({ from: actualFrom, to: actualTo });
    // Persist to sessionStorage
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        from: actualFrom.toISOString(),
        to: actualTo.toISOString(),
      })
    );
  };

  // Compute distinct exercise types from sessions
  const distinctExerciseTypes = useMemo(() => {
    const types = new Set(sessions.map((s) => s.exerciseTag).filter(Boolean));
    return Array.from(types).sort();
  }, [sessions]);

  // Initialize selectedExerciseTypes from storage or default to all types
  const [selectedExerciseTypes, setSelectedExerciseTypesState] = useState<Set<string>>(() => {
    const stored = sessionStorage.getItem(EXERCISE_TYPES_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return new Set(parsed);
      } catch {
        // Ignore parse errors, fall through to default
      }
    }
    // Default: all types selected
    return new Set(distinctExerciseTypes);
  });

  const setSelectedExerciseTypes = (types: Set<string>) => {
    setSelectedExerciseTypesState(types);
    // Persist to sessionStorage
    sessionStorage.setItem(EXERCISE_TYPES_STORAGE_KEY, JSON.stringify(Array.from(types)));
  };

  // When distinct types change, ensure selected types stays in sync
  useEffect(() => {
    const currentSelected = new Set(selectedExerciseTypes);
    const newDistinct = new Set(distinctExerciseTypes);

    // Remove any selected types that no longer exist
    const filtered = new Set(
      Array.from(currentSelected).filter((type) =>
        newDistinct.has(type)
      )
    );

    // Add any new types that appeared
    newDistinct.forEach((type) => {
      if (!filtered.has(type)) {
        filtered.add(type);
      }
    });

    // Only update if changed
    if (filtered.size !== currentSelected.size ||
        Array.from(filtered).some((t) => !currentSelected.has(t))) {
      setSelectedExerciseTypes(filtered);
    }
  }, [distinctExerciseTypes]);

  // Filter sessions based on date range AND exercise type
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const sessionDate = new Date(session.timestamp);
      const inDateRange = sessionDate >= dateRange.from && sessionDate <= dateRange.to;
      const inSelectedTypes = selectedExerciseTypes.has(session.exerciseTag);
      return inDateRange && inSelectedTypes;
    });
  }, [sessions, dateRange, selectedExerciseTypes]);

  // Preset helpers
  const setPresetLast7Days = useCallback(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    setDateRange(from, to);
  }, []);

  const setPresetLast30Days = useCallback(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    setDateRange(from, to);
  }, []);

  const setPresetThisMonth = useCallback(() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    setDateRange(from, to);
  }, []);

  const setPresetAllTime = useCallback(() => {
    const from = new Date('2000-01-01');
    const to = new Date();
    setDateRange(from, to);
  }, []);

  return {
    dateRange,
    setDateRange,
    filteredSessions,
    setPresetLast7Days,
    setPresetLast30Days,
    setPresetThisMonth,
    setPresetAllTime,
    distinctExerciseTypes,
    selectedExerciseTypes,
    setSelectedExerciseTypes,
  };
}
