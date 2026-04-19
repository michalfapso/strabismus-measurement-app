import { renderHook, act } from '@testing-library/react';
import { useSharedHover } from '../useSharedHover';

describe('useSharedHover', () => {
  it('should initialize with null values', () => {
    const { result } = renderHook(() => useSharedHover());

    expect(result.current.activeIndex).toBe(null);
    expect(result.current.cursorX).toBe(null);
    expect(result.current.cursorY).toBe(null);
  });

  it('should set hover state with index and coordinates', () => {
    const { result } = renderHook(() => useSharedHover());

    act(() => {
      result.current.setHover(5, 100, 200);
    });

    expect(result.current.activeIndex).toBe(5);
    expect(result.current.cursorX).toBe(100);
    expect(result.current.cursorY).toBe(200);
  });

  it('should set hover state with index only', () => {
    const { result } = renderHook(() => useSharedHover());

    act(() => {
      result.current.setHover(3);
    });

    expect(result.current.activeIndex).toBe(3);
    expect(result.current.cursorX).toBe(null);
    expect(result.current.cursorY).toBe(null);
  });

  it('should clear hover state', () => {
    const { result } = renderHook(() => useSharedHover());

    act(() => {
      result.current.setHover(5, 100, 200);
    });

    expect(result.current.activeIndex).toBe(5);

    act(() => {
      result.current.clearHover();
    });

    expect(result.current.activeIndex).toBe(null);
    expect(result.current.cursorX).toBe(null);
    expect(result.current.cursorY).toBe(null);
  });

  it('should set null index to clear hover', () => {
    const { result } = renderHook(() => useSharedHover());

    act(() => {
      result.current.setHover(5, 100, 200);
    });

    act(() => {
      result.current.setHover(null);
    });

    expect(result.current.activeIndex).toBe(null);
    expect(result.current.cursorX).toBe(null);
    expect(result.current.cursorY).toBe(null);
  });
});
