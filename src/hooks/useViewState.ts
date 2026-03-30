import { useState, useEffect, useCallback, useRef } from 'react';

export interface ViewState {
  filters: {
    dateRange: [number, number];
    exerciseType: string | null;
  };
  selectedSessions: Set<string>;
  histogramMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>;
  histogramDisplayModes: Set<'individual' | 'meanStddev'>;
  timeSeriesMetrics: Set<'deviation' | 'x' | 'y' | 'rotation'>;
  timeSeriesDisplayModes: Set<'individual' | 'meanStddev'>;
  timeSeriesTimeMode: 'absolute' | 'relative';
}

const STORAGE_KEY = 'strabismus_view_state';

const DEFAULT_STATE: ViewState = {
  filters: {
    dateRange: [0, Infinity],
    exerciseType: null,
  },
  selectedSessions: new Set(),
  histogramMetrics: new Set(['deviation']),
  histogramDisplayModes: new Set(['individual']),
  timeSeriesMetrics: new Set(['deviation']),
  timeSeriesDisplayModes: new Set(['individual', 'meanStddev']),
  timeSeriesTimeMode: 'absolute',
};

// Convert ViewState to JSON-serializable format
function serialize(state: ViewState): string {
  return JSON.stringify({
    filters: state.filters,
    selectedSessions: Array.from(state.selectedSessions),
    histogramMetrics: Array.from(state.histogramMetrics),
    histogramDisplayModes: Array.from(state.histogramDisplayModes),
    timeSeriesMetrics: Array.from(state.timeSeriesMetrics),
    timeSeriesDisplayModes: Array.from(state.timeSeriesDisplayModes),
    timeSeriesTimeMode: state.timeSeriesTimeMode,
  });
}

// Convert JSON back to ViewState
function deserialize(json: string): ViewState {
  try {
    const parsed = JSON.parse(json);
    return {
      filters: parsed.filters || DEFAULT_STATE.filters,
      selectedSessions: new Set(parsed.selectedSessions || []),
      histogramMetrics: new Set(parsed.histogramMetrics || ['deviation']),
      histogramDisplayModes: new Set(parsed.histogramDisplayModes || ['individual']),
      timeSeriesMetrics: new Set(parsed.timeSeriesMetrics || ['deviation']),
      timeSeriesDisplayModes: new Set(parsed.timeSeriesDisplayModes || ['individual', 'meanStddev']),
      timeSeriesTimeMode: parsed.timeSeriesTimeMode || 'absolute',
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useViewState() {
  // Initialize from localStorage
  const [state, setState] = useState<ViewState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? deserialize(stored) : DEFAULT_STATE;
    } catch {
      return DEFAULT_STATE;
    }
  });

  // Debounced save to localStorage
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    // Clear pending timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout (debounce 500ms)
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, serialize(state));
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state]);

  // Setters
  const updateFilters = useCallback(
    (updates: Partial<ViewState['filters']>) => {
      setState((prev) => ({
        ...prev,
        filters: { ...prev.filters, ...updates },
      }));
    },
    []
  );

  const updateSelectedSessions = useCallback((sessions: Set<string>) => {
    setState((prev) => ({
      ...prev,
      selectedSessions: new Set(sessions),
    }));
  }, []);

  const toggleHistogramMetric = useCallback((metric: 'deviation' | 'x' | 'y' | 'rotation') => {
    setState((prev) => {
      const newMetrics = new Set(prev.histogramMetrics);
      if (newMetrics.has(metric)) {
        newMetrics.delete(metric);
      } else {
        newMetrics.add(metric);
      }
      // Ensure at least one metric selected
      return {
        ...prev,
        histogramMetrics: newMetrics.size > 0 ? newMetrics : new Set(['deviation']),
      };
    });
  }, []);

  const toggleHistogramDisplayMode = useCallback((mode: 'individual' | 'meanStddev') => {
    setState((prev) => {
      const newModes = new Set(prev.histogramDisplayModes);
      if (newModes.has(mode)) {
        newModes.delete(mode);
      } else {
        newModes.add(mode);
      }
      return {
        ...prev,
        histogramDisplayModes: newModes,
      };
    });
  }, []);

  const toggleTimeSeriesMetric = useCallback((metric: 'deviation' | 'x' | 'y' | 'rotation') => {
    setState((prev) => {
      const newMetrics = new Set(prev.timeSeriesMetrics);
      if (newMetrics.has(metric)) {
        newMetrics.delete(metric);
      } else {
        newMetrics.add(metric);
      }
      // Ensure at least one metric selected
      return {
        ...prev,
        timeSeriesMetrics: newMetrics.size > 0 ? newMetrics : new Set(['deviation']),
      };
    });
  }, []);

  const toggleTimeSeriesDisplayMode = useCallback((mode: 'individual' | 'meanStddev') => {
    setState((prev) => {
      const newModes = new Set(prev.timeSeriesDisplayModes);
      if (newModes.has(mode)) {
        newModes.delete(mode);
      } else {
        newModes.add(mode);
      }
      return {
        ...prev,
        timeSeriesDisplayModes: newModes,
      };
    });
  }, []);

  const setTimeSeriesTimeMode = useCallback((mode: 'absolute' | 'relative') => {
    setState((prev) => ({
      ...prev,
      timeSeriesTimeMode: mode,
    }));
  }, []);

  return {
    state,
    updateFilters,
    updateSelectedSessions,
    toggleHistogramMetric,
    toggleHistogramDisplayMode,
    toggleTimeSeriesMetric,
    toggleTimeSeriesDisplayMode,
    setTimeSeriesTimeMode,
  };
}
