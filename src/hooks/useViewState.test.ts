import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewState } from './useViewState';

describe('useViewState', () => {
  // Clear localStorage before each test
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with default values when localStorage is empty', () => {
    const { result } = renderHook(() => useViewState());

    expect(result.current.state.filters.dateRange).toEqual([0, Infinity]);
    expect(result.current.state.filters.exerciseType).toBeNull();
    expect(result.current.state.selectedSessions).toEqual(new Set());
    expect(result.current.state.histogramMetrics).toEqual(new Set(['deviation']));
    expect(result.current.state.histogramDisplayModes).toEqual(new Set(['individual']));
    expect(result.current.state.timeSeriesMetrics).toEqual(new Set(['deviation']));
    expect(result.current.state.timeSeriesDisplayModes).toEqual(new Set(['individual', 'meanStddev']));
    expect(result.current.state.timeSeriesTimeMode).toBe('absolute');
  });
});
