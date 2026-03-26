import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiSelect } from '../../hooks/useMultiSelect';

describe('useMultiSelect', () => {
  it('should initialize with empty selection', () => {
    const { result } = renderHook(() => useMultiSelect());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('should add single item on click', () => {
    const { result } = renderHook(() => useMultiSelect());

    act(() => {
      result.current.handleRowClick('item-1', false, false);
    });

    expect(result.current.selectedIds.has('item-1')).toBe(true);
    expect(result.current.selectedIds.size).toBe(1);
  });

  it('should toggle item on ctrl+click', () => {
    const { result } = renderHook(() => useMultiSelect());

    act(() => {
      result.current.handleRowClick('item-1', true, false); // ctrlKey=true
    });

    expect(result.current.selectedIds.has('item-1')).toBe(true);

    act(() => {
      result.current.handleRowClick('item-1', true, false); // ctrl+click again
    });

    expect(result.current.selectedIds.has('item-1')).toBe(false);
  });

  it('should select range on shift+click', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const { result } = renderHook(() => useMultiSelect());

    // Click on 'a'
    act(() => {
      result.current.handleRowClick('a', false, false);
    });
    expect(result.current.selectedIds.has('a')).toBe(true);

    // Shift+click on 'd' (should select a, b, c, d)
    act(() => {
      result.current.handleRowClick('d', false, true, items);
    });

    expect(result.current.selectedIds.has('a')).toBe(true);
    expect(result.current.selectedIds.has('b')).toBe(true);
    expect(result.current.selectedIds.has('c')).toBe(true);
    expect(result.current.selectedIds.has('d')).toBe(true);
    expect(result.current.selectedIds.has('e')).toBe(false);
  });

  it('should ctrl+shift+click toggle a range', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const { result } = renderHook(() => useMultiSelect());

    // Select b and c
    act(() => {
      result.current.handleRowClick('b', false, false);
    });
    act(() => {
      result.current.handleRowClick('c', true, false); // ctrl+click
    });

    expect(result.current.selectedIds.size).toBe(2);

    // Shift+click on d (should extend to b, c, d)
    act(() => {
      result.current.handleRowClick('d', false, true, items);
    });

    expect(result.current.selectedIds.has('b')).toBe(true);
    expect(result.current.selectedIds.has('c')).toBe(true);
    expect(result.current.selectedIds.has('d')).toBe(true);
    expect(result.current.selectedIds.has('a')).toBe(false);
  });

  it('should clear all selections', () => {
    const { result } = renderHook(() => useMultiSelect());

    act(() => {
      result.current.handleRowClick('a', false, false);
      result.current.handleRowClick('b', true, false);
    });

    expect(result.current.selectedIds.size).toBe(2);

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedIds.size).toBe(0);
  });

  it('should check if item is selected', () => {
    const { result } = renderHook(() => useMultiSelect());

    act(() => {
      result.current.handleRowClick('a', false, false);
    });

    expect(result.current.isSelected('a')).toBe(true);
    expect(result.current.isSelected('b')).toBe(false);
  });

  it('should get selection as array', () => {
    const { result } = renderHook(() => useMultiSelect());

    act(() => {
      result.current.handleRowClick('a', false, false);
      result.current.handleRowClick('b', true, false);
    });

    const selected = result.current.getSelectedArray();
    expect(selected).toContain('a');
    expect(selected).toContain('b');
    expect(selected.length).toBe(2);
  });
});
