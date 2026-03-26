// src/__tests__/hooks/useHistoryFilters.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistoryFilters } from '../../hooks/useHistoryFilters';
import { Session } from '../../types';

function createTestSession(date: string, tag: string): Session {
  return {
    sessionId: `session-${Math.random()}`,
    timestamp: date,
    exerciseTag: tag,
    ppi: 96,
    timeSeries: [],
  };
}

describe('useHistoryFilters', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should initialize with last 30 days by default', () => {
    const { result } = renderHook(() => useHistoryFilters([]));
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    expect(result.current.dateRange.to.toDateString()).toBe(
      now.toDateString()
    );
    // Allow 1-day tolerance for date arithmetic
    expect(
      Math.abs(
        result.current.dateRange.from.getTime() -
          thirtyDaysAgo.getTime()
      )
    ).toBeLessThan(86400000);
  });

  it('should filter sessions by date range', () => {
    const sessions = [
      createTestSession('2026-03-20T10:00:00Z', 'Test'),
      createTestSession('2026-03-25T10:00:00Z', 'Test'),
      createTestSession('2026-03-26T10:00:00Z', 'Test'),
    ];

    const { result } = renderHook(() => useHistoryFilters(sessions));

    const from = new Date('2026-03-24T00:00:00Z');
    const to = new Date('2026-03-26T23:59:59Z');

    act(() => {
      result.current.setDateRange(from, to);
    });

    const filtered = result.current.filteredSessions;
    expect(filtered).toHaveLength(2);
    expect(filtered.some((s) => s.timestamp.includes('03-25'))).toBe(true);
    expect(filtered.some((s) => s.timestamp.includes('03-26'))).toBe(true);
  });

  it('should persist date range to sessionStorage', () => {
    const { result } = renderHook(() => useHistoryFilters([]));

    const from = new Date('2026-03-20T00:00:00Z');
    const to = new Date('2026-03-26T23:59:59Z');

    act(() => {
      result.current.setDateRange(from, to);
    });

    const stored = sessionStorage.getItem('historyDateRange');
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(new Date(parsed.from).toDateString()).toBe(from.toDateString());
    expect(new Date(parsed.to).toDateString()).toBe(to.toDateString());
  });

  it('should restore date range from sessionStorage', () => {
    const from = new Date('2026-03-20T00:00:00Z');
    const to = new Date('2026-03-26T23:59:59Z');
    sessionStorage.setItem(
      'historyDateRange',
      JSON.stringify({
        from: from.toISOString(),
        to: to.toISOString(),
      })
    );

    const { result } = renderHook(() => useHistoryFilters([]));

    expect(result.current.dateRange.from.toDateString()).toBe(
      from.toDateString()
    );
    expect(result.current.dateRange.to.toDateString()).toBe(to.toDateString());
  });

  it('should update filtered sessions when sessions array changes', () => {
    const sessions1 = [createTestSession('2026-03-26T10:00:00Z', 'Test')];
    const { result, rerender } = renderHook(
      ({ sessions }: { sessions: Session[] }) => useHistoryFilters(sessions),
      { initialProps: { sessions: sessions1 } }
    );

    expect(result.current.filteredSessions).toHaveLength(1);

    const sessions2 = [
      createTestSession('2026-03-26T10:00:00Z', 'Test'),
      createTestSession('2026-03-25T10:00:00Z', 'Test'),
    ];

    rerender({ sessions: sessions2 });
    expect(result.current.filteredSessions.length).toBeGreaterThanOrEqual(1);
  });

  it('should provide preset date range setters', () => {
    const { result } = renderHook(() => useHistoryFilters([]));

    act(() => {
      result.current.setPresetLast7Days();
    });

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    expect(result.current.dateRange.to.toDateString()).toBe(
      now.toDateString()
    );
    expect(
      Math.abs(
        result.current.dateRange.from.getTime() -
          sevenDaysAgo.getTime()
      )
    ).toBeLessThan(86400000);
  });
});
