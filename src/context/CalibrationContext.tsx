import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { CalibrationState } from '../types';
import { getCalibration, saveCalibration } from '../services/storage';

export const CalibrationContext = createContext<{
  calibration: CalibrationState | null;
  setPpmm: (ppmm: number) => Promise<void>;
  isLoading: boolean;
}>({
  calibration: null,
  setPpmm: async () => {},
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

  const setPpmm = async (ppmm: number) => {
    const newCalibration: CalibrationState = {
      ppmm,
      timestamp: new Date().toISOString(),
    };
    await saveCalibration(newCalibration);
    setCalibration(newCalibration);
  };

  return (
    <CalibrationContext.Provider value={{ calibration, setPpmm, isLoading }}>
      {children}
    </CalibrationContext.Provider>
  );
}
