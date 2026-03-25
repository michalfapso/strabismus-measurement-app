/**
 * Time-series measurement data point
 * t: milliseconds since session start
 * x, y: position in centimeters (relative to canvas center)
 * r: rotation in degrees (relative to vertical axis)
 */
export interface TimeSeries {
  t: number; // milliseconds
  x: number; // cm
  y: number; // cm
  r: number; // degrees
}

/**
 * Measurement session metadata
 */
export interface Session {
  sessionId: string; // UUID
  timestamp: string; // ISO8601
  exerciseTag: string; // e.g., "Pencil Push-ups"
  ppmm: number; // pixels per millimeter (calibration)
  timeSeries: TimeSeries[]; // array of measurements
}

/**
 * Calibration state
 */
export interface CalibrationState {
  ppmm: number | null; // null if not yet calibrated
  timestamp: string; // ISO8601, when last calibrated
}

/**
 * Predefined exercises
 */
export type ExerciseType =
  | 'No Exercise/Control'
  | 'Pencil Push-ups'
  | 'Brock String'
  | 'Extreme Rotation'
  | 'Convergence Jumps'
  | 'Left-Tendon-Stretch'
  | 'Right-Tendon-Stretch';

export const PREDEFINED_EXERCISES: ExerciseType[] = [
  'No Exercise/Control',
  'Pencil Push-ups',
  'Brock String',
  'Extreme Rotation',
  'Convergence Jumps',
  'Left-Tendon-Stretch',
  'Right-Tendon-Stretch',
];
