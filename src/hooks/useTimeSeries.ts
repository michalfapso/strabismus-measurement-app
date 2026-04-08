import { useEffect, useRef } from 'react';
import { useSession } from './useSession';

export function useTimeSeries() {
  const { currentSession, addTimeSeriesPoint } = useSession();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const currentPositionRef = useRef({ x: 0, y: 0, r: 0 });

  const startCapture = (initialPosition?: { x: number; y: number; r: number }) => {
    console.log('[useTimeSeries] startCapture called with initialPosition:', initialPosition);
    console.log('[useTimeSeries] Current session from hook:', !!currentSession);
    if (initialPosition) {
      currentPositionRef.current = initialPosition;
      console.log('[useTimeSeries] Initial position set:', currentPositionRef.current);
    }
    startTimeRef.current = Date.now();
    let recordCount = 0;
    timerRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;

      const point = {
        t: elapsed,
        x: currentPositionRef.current.x,
        y: currentPositionRef.current.y,
        r: currentPositionRef.current.r,
      };
      recordCount++;
      if (recordCount % 10 === 0) {
        console.log('[useTimeSeries] Recording point:', point, '(count:', recordCount, ')');
      }
      addTimeSeriesPoint(point);
    }, 100);
  };

  const updatePosition = (x: number, y: number, r: number) => {
    console.log('[useTimeSeries] updatePosition called with:', { x, y, r });
    currentPositionRef.current = { x, y, r };
  };

  const stopCapture = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return { startCapture, stopCapture, updatePosition, isCapturing: timerRef.current !== null };
}
