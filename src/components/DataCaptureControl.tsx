import React, { useState, useEffect } from 'react';
import { useCalibration } from '../hooks/useCalibration';
import { useSession } from '../hooks/useSession';
import { useTimeSeries } from '../hooks/useTimeSeries';
import { ExerciseSelector } from './ExerciseSelector';
import { ExerciseType } from '../types';
import { css } from '@emotion/react';

const controlPanelStyle = css`
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 20px;
  background: #2a2a2a;
  border: 2px solid #00ff00;
  border-radius: 8px;
  max-width: 400px;
`;

const rowStyle = css`
  display: flex;
  gap: 10px;
  align-items: center;
`;

const baseButtonStyle = css`
  padding: 10px 20px;
  font-size: 14px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;

  &:hover {
    opacity: 0.8;
  }
`;

const startButtonStyle = css`
  ${baseButtonStyle}
  background: #00ff00;
  color: #000;
`;

const stopButtonStyle = css`
  ${baseButtonStyle}
  background: #ff0000;
  color: #fff;
`;

const clearButtonStyle = css`
  ${baseButtonStyle}
  background: #ffcc00;
  color: #000;
`;

const timerStyle = css`
  font-size: 18px;
  color: #00ff00;
  font-weight: bold;
  min-width: 100px;
`;

export function DataCaptureControl({ currentCanvasPosition, onStartMeasurement }: { currentCanvasPosition?: { x: number; y: number; r: number }, onStartMeasurement?: () => void }) {
  const { calibration } = useCalibration();
  const { currentSession, startSession, endSession, clearSession } = useSession();
  const { startCapture, stopCapture, updatePosition, isCapturing } = useTimeSeries();
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType>('No Exercise/Control');
  const [elapsed, setElapsed] = useState(0);
  const [sessionJustStarted, setSessionJustStarted] = useState(false);

  // When a session is first created, start capturing with fresh context
  useEffect(() => {
    if (currentSession && sessionJustStarted) {
      console.log('[DataCaptureControl] Session activated, starting capture with position:', currentCanvasPosition);
      startCapture(currentCanvasPosition);
      setSessionJustStarted(false);
    }
  }, [currentSession, sessionJustStarted, currentCanvasPosition, startCapture]);

  // Update position whenever canvas data changes during active recording
  useEffect(() => {
    console.log('[DataCaptureControl] Canvas position changed:', currentCanvasPosition);
    console.log('[DataCaptureControl] Session active?', !!currentSession);
    if (currentSession && currentCanvasPosition) {
      console.log('[DataCaptureControl] Updating position in recorder:', currentCanvasPosition);
      updatePosition(currentCanvasPosition.x, currentCanvasPosition.y, currentCanvasPosition.r);
    }
  }, [currentCanvasPosition, currentSession, updatePosition]);

  const handleStart = () => {
    console.log('[DataCaptureControl] handleStart called');
    console.log('[DataCaptureControl] currentCanvasPosition:', currentCanvasPosition);
    if (calibration?.ppi) {
      // Dismiss any previous results panel
      onStartMeasurement?.();
      console.log('[DataCaptureControl] Starting session with exercise:', selectedExercise);
      startSession(selectedExercise, calibration.ppi);
      setSessionJustStarted(true);
      setElapsed(0);
    }
  };

  const handleStop = async () => {
    stopCapture();
    await endSession();
    setElapsed(0);
  };

  const handleClear = () => {
    stopCapture();
    clearSession();
    setElapsed(0);
  };

  React.useEffect(() => {
    if (!isCapturing) return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isCapturing]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!currentSession) {
    return (
      <div css={controlPanelStyle} data-component="DataCaptureControl">
        <h2>Start Measurement</h2>
        <ExerciseSelector value={selectedExercise} onChange={setSelectedExercise} />
        <button css={startButtonStyle} onClick={handleStart}>
          Start Measurement
        </button>
      </div>
    );
  }

  return (
    <div css={controlPanelStyle} data-component="DataCaptureControl">
      <h2>Active Measurement</h2>
      <div css={rowStyle}>
        <span>Exercise:</span>
        <strong>{currentSession.exerciseTag}</strong>
      </div>
      <div css={rowStyle}>
        <span>Elapsed:</span>
        <div css={timerStyle}>{formatTime(elapsed)}</div>
      </div>
      <button css={stopButtonStyle} onClick={handleStop}>
        Stop & Save
      </button>
      <button css={clearButtonStyle} onClick={handleClear}>
        Clear
      </button>
    </div>
  );
}
