import { useContext } from 'react';
import { CalibrationContext } from '../context/CalibrationContext';

export function useCalibration() {
  const context = useContext(CalibrationContext);
  if (!context) {
    throw new Error('useCalibration must be used within CalibrationProvider');
  }
  return context;
}
