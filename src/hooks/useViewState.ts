import { useState, useEffect, useCallback, useRef } from 'react';

export interface ViewState {
  filters: {
    dateRange: [number, number];
    exerciseTypes: Set<string> | null;
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
    exerciseTypes: null,
  },
  selectedSessions: new Set(),
  histogramMetrics: new Set(['deviation']),
  // Default display modes: both components show individual session data + statistical summary (mean±stddev)
  // This provides a complete view of both individual variation and aggregate statistics
  histogramDisplayModes: new Set(['individual', 'meanStddev']),
  timeSeriesMetrics: new Set(['deviation']),
  timeSeriesDisplayModes: new Set(['individual', 'meanStddev']),
  timeSeriesTimeMode: 'absolute',
};

// Serialized representation of defaults for deserialization
const SERIALIZED_DEFAULTS = {
  filters: {
    dateRange: DEFAULT_STATE.filters.dateRange,
    exerciseTypes: null,
  },
  selectedSessions: Array.from(DEFAULT_STATE.selectedSessions),
  histogramMetrics: Array.from(DEFAULT_STATE.histogramMetrics),
  histogramDisplayModes: Array.from(DEFAULT_STATE.histogramDisplayModes),
  timeSeriesMetrics: Array.from(DEFAULT_STATE.timeSeriesMetrics),
  timeSeriesDisplayModes: Array.from(DEFAULT_STATE.timeSeriesDisplayModes),
  timeSeriesTimeMode: DEFAULT_STATE.timeSeriesTimeMode,
};

// Type guards for validation
function isValidMetric(val: unknown): val is 'deviation' | 'x' | 'y' | 'rotation' {
  return ['deviation', 'x', 'y', 'rotation'].includes(val as string);
}

function isValidDisplayMode(val: unknown): val is 'individual' | 'meanStddev' {
  return ['individual', 'meanStddev'].includes(val as string);
}

function isValidTimeMode(val: unknown): val is 'absolute' | 'relative' {
  return ['absolute', 'relative'].includes(val as string);
}

// Convert ViewState to JSON-serializable format
function serialize(state: ViewState): string {
  return JSON.stringify({
    filters: {
      dateRange: state.filters.dateRange,
      exerciseTypes: state.filters.exerciseTypes ? Array.from(state.filters.exerciseTypes) : null,
    },
    selectedSessions: Array.from(state.selectedSessions),
    histogramMetrics: Array.from(state.histogramMetrics),
    histogramDisplayModes: Array.from(state.histogramDisplayModes),
    timeSeriesMetrics: Array.from(state.timeSeriesMetrics),
    timeSeriesDisplayModes: Array.from(state.timeSeriesDisplayModes),
    timeSeriesTimeMode: state.timeSeriesTimeMode,
  });
}

// Convert JSON back to ViewState with validation
function deserialize(json: string): ViewState {
  try {
    const parsed = JSON.parse(json);
    const exerciseTypes = parsed.filters?.exerciseTypes
      ? new Set<string>(parsed.filters.exerciseTypes)
      : SERIALIZED_DEFAULTS.filters.exerciseTypes;
    return {
      filters: {
        dateRange: parsed.filters?.dateRange || SERIALIZED_DEFAULTS.filters.dateRange,
        exerciseTypes,
      },
      selectedSessions: new Set(parsed.selectedSessions || SERIALIZED_DEFAULTS.selectedSessions),
      histogramMetrics: new Set(
        (parsed.histogramMetrics || SERIALIZED_DEFAULTS.histogramMetrics).filter(isValidMetric)
      ),
      histogramDisplayModes: new Set(
        (parsed.histogramDisplayModes || SERIALIZED_DEFAULTS.histogramDisplayModes).filter(isValidDisplayMode)
      ),
      timeSeriesMetrics: new Set(
        (parsed.timeSeriesMetrics || SERIALIZED_DEFAULTS.timeSeriesMetrics).filter(isValidMetric)
      ),
      timeSeriesDisplayModes: new Set(
        (parsed.timeSeriesDisplayModes || SERIALIZED_DEFAULTS.timeSeriesDisplayModes).filter(isValidDisplayMode)
      ),
      timeSeriesTimeMode: isValidTimeMode(parsed.timeSeriesTimeMode)
        ? parsed.timeSeriesTimeMode
        : SERIALIZED_DEFAULTS.timeSeriesTimeMode,
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
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      // Display modes can be empty (optional views); unlike metrics which require at least one
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
      // Display modes can be empty (optional views); unlike metrics which require at least one
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
