import { useState, useCallback } from 'react';

interface SharedHoverState {
  activeIndex: number | null;
  hoveredGraphId: string | null;
  cursorX: number | null;
  cursorY: number | null;
}

export function useSharedHover() {
  const [state, setState] = useState<SharedHoverState>({
    activeIndex: null,
    hoveredGraphId: null,
    cursorX: null,
    cursorY: null,
  });

  const setHover = useCallback((index: number | null, graphId?: string, cursorX?: number, cursorY?: number) => {
    setState({
      activeIndex: index,
      hoveredGraphId: graphId ?? null,
      cursorX: cursorX ?? null,
      cursorY: cursorY ?? null,
    });
  }, []);

  const clearHover = useCallback(() => {
    setState({
      activeIndex: null,
      hoveredGraphId: null,
      cursorX: null,
      cursorY: null,
    });
  }, []);

  return {
    activeIndex: state.activeIndex,
    hoveredGraphId: state.hoveredGraphId,
    cursorX: state.cursorX,
    cursorY: state.cursorY,
    setHover,
    clearHover,
  };
}
