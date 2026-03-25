import { useEffect, useRef } from 'react';
import { useSession } from './useSession';

export function useTimeSeries() {
  const { currentSession, addTimeSeriesPoint } = useSession();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const startCapture = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;

      addTimeSeriesPoint({
        t: elapsed,
        x: 0,
        y: 0,
        r: 0,
      });
    }, 100);
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

  return { startCapture, stopCapture, isCapturing: timerRef.current !== null };
}
