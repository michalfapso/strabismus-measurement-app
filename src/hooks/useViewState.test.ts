import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewState } from './useViewState';

describe('useViewState', () => {
  // Clear localStorage before each test
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllTimers();
  });

  it('initializes with default values when localStorage is empty', () => {
    const { result } = renderHook(() => useViewState());

    expect(result.current.state.filters.dateRange).toEqual([0, Infinity]);
    expect(result.current.state.filters.exerciseType).toBeNull();
    expect(result.current.state.selectedSessions).toEqual(new Set());
    expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation']));
    expect(result.current.state.histogramDisplayModes).toEqual(new Set(['individual', 'meanStddev']));
    expect(result.current.state.timeSeriesMetrics).toEqual(new Set(['deviation']));
    expect(result.current.state.timeSeriesDisplayModes).toEqual(new Set(['individual', 'meanStddev']));
    expect(result.current.state.timeSeriesTimeMode).toBe('absolute');
  });

  it('hydrates from localStorage on mount', () => {
    const mockState = {
      filters: { dateRange: [1000, 2000], exerciseType: 'Pencil Push-ups' },
      selectedSessions: ['session-1', 'session-2'],
      histogramMetrics: ['deviation', 'x'],
      histogramDisplayModes: ['meanStddev'],
      timeSeriesMetrics: ['rotation'],
      timeSeriesDisplayModes: ['individual'],
      timeSeriesTimeMode: 'relative' as const,
    };
    localStorage.setItem('strabismus_view_state', JSON.stringify(mockState));

    const { result } = renderHook(() => useViewState());

    expect(result.current.state.filters.dateRange).toEqual([1000, 2000]);
    expect(result.current.state.filters.exerciseType).toBe('Pencil Push-ups');
    expect(result.current.state.selectedSessions).toEqual(new Set(['session-1', 'session-2']));
    expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation', 'x']));
    expect(result.current.state.histogramDisplayModes).toEqual(new Set(['meanStddev']));
    expect(result.current.state.timeSeriesMetrics).toEqual(new Set(['rotation']));
    expect(result.current.state.timeSeriesDisplayModes).toEqual(new Set(['individual']));
    expect(result.current.state.timeSeriesTimeMode).toBe('relative');
  });

  it('persists state to localStorage on update (debounced)', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useViewState());

    act(() => {
      result.current.updateFilters({ exerciseType: 'Brock String' });
    });

    // Should not save immediately
    expect(localStorage.getItem('strabismus_view_state')).toBe(null);

    // Advance timers past debounce (500ms)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const stored = localStorage.getItem('strabismus_view_state');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored || '{}');
    expect(parsed.filters.exerciseType).toBe('Brock String');

    vi.useRealTimers();
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('strabismus_view_state', 'not valid json');

    const { result } = renderHook(() => useViewState());

    expect(result.current.state).toEqual(expect.objectContaining({
      filters: { dateRange: [0, Infinity], exerciseType: null },
    }));
  });

  it('filters invalid metric values from deserialized state', () => {
    const corruptedState = {
      filters: { dateRange: [0, Infinity], exerciseType: null },
      selectedSessions: [],
      histogramMetrics: ['deviation', 'invalid-metric'],
      histogramDisplayModes: ['individual'],
      timeSeriesMetrics: ['deviation'],
      timeSeriesDisplayModes: ['individual', 'meanStddev'],
      timeSeriesTimeMode: 'absolute',
    };
    localStorage.setItem('strabismus_view_state', JSON.stringify(corruptedState));

    const { result } = renderHook(() => useViewState());

    // Invalid metric should be filtered out, leaving only 'deviation'
    expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation']));
  });

  it('toggleHistogramMetric adds and removes metrics', () => {
    const { result } = renderHook(() => useViewState());

    expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation']));

    act(() => {
      result.current.toggleHistogramMetric('x');
    });

    expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation', 'x']));

    act(() => {
      result.current.toggleHistogramMetric('x');
    });

    expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation']));
  });

  it('toggleHistogramMetric prevents deselecting all metrics', () => {
    const { result } = renderHook(() => useViewState());

    act(() => {
      result.current.toggleHistogramMetric('deviation');
    });

    // Should keep 'deviation' selected
    expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation']));
  });

  it('updateSelectedSessions updates session selection', () => {
    const { result } = renderHook(() => useViewState());

    expect(result.current.state.selectedSessions).toEqual(new Set());

    act(() => {
      result.current.updateSelectedSessions(new Set(['session-1', 'session-2']));
    });

    expect(result.current.state.selectedSessions).toEqual(new Set(['session-1', 'session-2']));
  });

  it('toggleHistogramDisplayMode toggles display modes', () => {
    const { result } = renderHook(() => useViewState());

    expect(result.current.state.histogramDisplayModes).toEqual(new Set(['individual', 'meanStddev']));

    act(() => {
      result.current.toggleHistogramDisplayMode('meanStddev');
    });

    expect(result.current.state.histogramDisplayModes).toEqual(new Set(['individual']));

    act(() => {
      result.current.toggleHistogramDisplayMode('meanStddev');
    });

    expect(result.current.state.histogramDisplayModes).toEqual(new Set(['individual', 'meanStddev']));
  });

  it('setTimeSeriesTimeMode updates time mode', () => {
    const { result } = renderHook(() => useViewState());

    expect(result.current.state.timeSeriesTimeMode).toBe('absolute');

    act(() => {
      result.current.setTimeSeriesTimeMode('relative');
    });

    expect(result.current.state.timeSeriesTimeMode).toBe('relative');
  });
});
