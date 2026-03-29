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
  ppi: number; // pixels per inch (calibration)
  timeSeries: TimeSeries[]; // array of measurements
}

/**
 * Calibration state
 */
export interface CalibrationState {
  ppi: number | null; // pixels per inch (replaces ppmm)
  timestamp: string; // ISO8601, when last calibrated
  previousPpi?: number; // Store previous PPI for recalibration pre-fill
  lastMode?: CalibrationMode; // Track last-used calibration method
}

/**
 * Calibration mode type
 */
export type CalibrationMode = 'a4-short' | 'a4-long' | 'credit-card';

/**
 * Canvas state (position and rotation)
 */
export interface CanvasState {
  x: number; // pixel x coordinate
  y: number; // pixel y coordinate
  rotation: number; // degrees
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

/**
 * Session statistics (computed from timeSeries)
 */
export interface SessionStats {
  positionRange?: {
    xMin: number;
    xMax: number;
    xRange: number;
    yMin: number;
    yMax: number;
    yRange: number;
  };
  rotationRange?: {
    rMin: number;
    rMax: number;
    range: number;
  };
  duration: number;
  meanDeviation: number;
}
