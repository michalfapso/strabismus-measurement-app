import { useContext } from 'react';
import { CalibrationContext } from '../context/CalibrationContext';
import { CalibrationMode } from '../types';

export function useCalibration() {
  const context = useContext(CalibrationContext);
  if (!context) {
    throw new Error('useCalibration must be used within CalibrationProvider');
  }
  return {
    calibration: context.calibration,
    setPpi: (ppi: number, mode: CalibrationMode) => context.setPpi(ppi, mode),
    isLoading: context.isLoading,
  };
}
