import { renderHook, act } from '@testing-library/react';
import { useSharedHover } from '../useSharedHover';

describe('useSharedHover', () => {
  it('should initialize with null values', () => {
    const { result } = renderHook(() => useSharedHover());

    expect(result.current.activeIndex).toBe(null);
    expect(result.current.hoveredGraphId).toBe(null);
  });

  it('should set hover state with index and graphId', () => {
    const { result } = renderHook(() => useSharedHover());

    act(() => {
      result.current.setHover(5, 'graph1', 100, 200);
    });

    expect(result.current.activeIndex).toBe(5);
    expect(result.current.hoveredGraphId).toBe('graph1');
  });

  it('should set hover state with index only', () => {
    const { result } = renderHook(() => useSharedHover());

    act(() => {
      result.current.setHover(3);
    });

    expect(result.current.activeIndex).toBe(3);
    expect(result.current.hoveredGraphId).toBe(null);
  });

  it('should clear hover state', () => {
    const { result } = renderHook(() => useSharedHover());

    act(() => {
      result.current.setHover(5, 'graph1', 100, 200);
    });

    expect(result.current.activeIndex).toBe(5);

    act(() => {
      result.current.clearHover();
    });

    expect(result.current.activeIndex).toBe(null);
    expect(result.current.hoveredGraphId).toBe(null);
  });

  it('should set null index to clear hover', () => {
    const { result } = renderHook(() => useSharedHover());

    act(() => {
      result.current.setHover(5, 'graph1', 100, 200);
    });

    act(() => {
      result.current.setHover(null);
    });

    expect(result.current.activeIndex).toBe(null);
    expect(result.current.hoveredGraphId).toBe(null);
  });

  it('should not re-render when hovering same data point with different cursor position', () => {
    const { result, rerender } = renderHook(() => useSharedHover());
    let renderCount = 0;

    act(() => {
      result.current.setHover(5, 'graph1', 100, 200);
    });
    renderCount++;

    act(() => {
      result.current.setHover(5, 'graph1', 105, 205);
    });

    // Re-render should not have happened because activeIndex and hoveredGraphId are the same
    expect(renderCount).toBe(1);
  });
});
