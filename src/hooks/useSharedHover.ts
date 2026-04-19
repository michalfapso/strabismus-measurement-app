import { useState, useCallback } from 'react';

interface SharedHoverState {
  activeIndex: number | null;
  cursorX: number | null;
  cursorY: number | null;
}

export function useSharedHover() {
  const [state, setState] = useState<SharedHoverState>({
    activeIndex: null,
    cursorX: null,
    cursorY: null,
  });

  const setHover = useCallback((index: number | null, cursorX?: number, cursorY?: number) => {
    setState({
      activeIndex: index,
      cursorX: cursorX ?? null,
      cursorY: cursorY ?? null,
    });
  }, []);

  const clearHover = useCallback(() => {
    setState({
      activeIndex: null,
      cursorX: null,
      cursorY: null,
    });
  }, []);

  return {
    activeIndex: state.activeIndex,
    cursorX: state.cursorX,
    cursorY: state.cursorY,
    setHover,
    clearHover,
  };
}
