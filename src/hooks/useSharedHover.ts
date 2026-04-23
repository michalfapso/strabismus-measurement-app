import { useState, useCallback, useRef } from 'react';

interface SharedHoverState {
  activeIndex: number | null;
  hoveredGraphId: string | null;
}

export function useSharedHover() {
  const [state, setState] = useState<SharedHoverState>({
    activeIndex: null,
    hoveredGraphId: null,
  });

  // Store cursor position in ref (doesn't need to trigger re-renders)
  const cursorRef = useRef({ x: null as number | null, y: null as number | null });

  const setHover = useCallback((index: number | null, graphId?: string, cursorX?: number, cursorY?: number) => {
    // Always update cursor position in ref
    cursorRef.current = {
      x: cursorX ?? null,
      y: cursorY ?? null,
    };

    // Only update state if activeIndex or hoveredGraphId changed
    setState(prev => {
      if (prev.activeIndex === index && prev.hoveredGraphId === (graphId ?? null)) {
        return prev; // No change, don't trigger re-render
      }
      return {
        activeIndex: index,
        hoveredGraphId: graphId ?? null,
      };
    });
  }, []);

  const clearHover = useCallback(() => {
    setState({
      activeIndex: null,
      hoveredGraphId: null,
    });
  }, []);

  return {
    activeIndex: state.activeIndex,
    hoveredGraphId: state.hoveredGraphId,
    setHover,
    clearHover,
  };
}
