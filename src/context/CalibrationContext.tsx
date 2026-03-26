import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { CalibrationState, CalibrationMode } from '../types';
import { getCalibration, saveCalibration } from '../services/storage';

export const CalibrationContext = createContext<{
  calibration: CalibrationState | null;
  setPpi: (ppi: number, mode: CalibrationMode) => Promise<void>;
  isLoading: boolean;
}>({
  calibration: null,
  setPpi: async () => {},
  isLoading: true,
});

export function CalibrationProvider({ children }: { children: ReactNode }) {
  const [calibration, setCalibration] = useState<CalibrationState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const cal = await getCalibration();
        setCalibration(cal);
      } catch (err) {
        console.error('Failed to load calibration:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const setPpi = async (ppi: number, mode: CalibrationMode) => {
    const newCalibration: CalibrationState = {
      ppi,
      timestamp: new Date().toISOString(),
      previousPpi: calibration?.ppi ?? undefined,
      lastMode: mode,
    };
    await saveCalibration(newCalibration);
    setCalibration(newCalibration);
  };

  return (
    <CalibrationContext.Provider value={{ calibration, setPpi, isLoading }}>
      {children}
    </CalibrationContext.Provider>
  );
}
