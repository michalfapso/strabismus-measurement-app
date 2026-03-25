import React, { useState } from 'react';
import { CalibrationProvider } from './context/CalibrationContext';
import { SessionProvider } from './context/SessionContext';
import { CalibrationScreen } from './components/CalibrationScreen';
import { AssessmentCanvas } from './components/AssessmentCanvas';
import { DataCaptureControl } from './components/DataCaptureControl';
import { SessionExplorer } from './components/SessionExplorer';
import { useCalibration } from './hooks/useCalibration';
import { useSession } from './hooks/useSession';
import { css } from '@emotion/react';

const appStyle = css`
  width: 100vw;
  height: 100vh;
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
`;

const mainLayoutStyle = css`
  display: flex;
  flex: 1;
  gap: 20px;
  padding: 20px;
  overflow: hidden;
`;

const canvasContainerStyle = css`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const sidebarStyle = css`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 450px;
  overflow-y: auto;
`;

const headerStyle = css`
  padding: 15px 20px;
  border-bottom: 2px solid #00ff00;
  display: flex;
  align-items: center;
  justify-content: space-between;

  h1 {
    margin: 0;
    color: #00ff00;
    font-size: 20px;
  }

  p {
    margin: 0;
    color: #aaa;
    font-size: 13px;
  }
`;

const recalibrateBtnStyle = css`
  padding: 8px 16px;
  font-size: 13px;
  background: transparent;
  color: #00ff00;
  border: 1px solid #00ff00;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: #00ff0022;
  }
`;

const positionInfoStyle = css`
  padding: 15px;
  background: #1a1a1a;
  border: 1px solid #00ff00;
  border-radius: 4px;

  h3 {
    margin: 0 0 10px;
    color: #00ff00;
    font-size: 14px;
  }

  p {
    margin: 4px 0;
    font-size: 14px;
  }
`;

const toggleBtnStyle = css`
  padding: 10px 20px;
  font-size: 14px;
  background: #00ff00;
  color: #000;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;

  &:hover {
    background: #00cc00;
  }
`;

function AppContent() {
  const { calibration, isLoading } = useCalibration();
  const { currentSession } = useSession();
  const [showCalibration, setShowCalibration] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [canvasData, setCanvasData] = useState({ x: 0, y: 0, r: 0 });

  if (isLoading) {
    return (
      <div css={appStyle}>
        <div css={headerStyle}>
          <h1>Strabismus Measurement App</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!calibration || showCalibration) {
    return (
      <div css={appStyle}>
        <CalibrationScreen onComplete={() => setShowCalibration(false)} />
      </div>
    );
  }

  return (
    <div css={appStyle}>
      <div css={headerStyle}>
        <div>
          <h1>Strabismus Measurement App</h1>
          <p>Calibrated at {new Date(calibration.timestamp).toLocaleString()} · {calibration.ppmm != null ? calibration.ppmm.toFixed(2) : 'N/A'} px/mm</p>
        </div>
        <button css={recalibrateBtnStyle} onClick={() => setShowCalibration(true)}>
          Recalibrate
        </button>
      </div>

      <div css={mainLayoutStyle}>
        <div css={canvasContainerStyle}>
          <AssessmentCanvas
            onPositionChange={(x, y, r) => setCanvasData({ x, y, r })}
          />
        </div>

        <div css={sidebarStyle}>
          <DataCaptureControl />

          <div css={positionInfoStyle}>
            <h3>Position & Rotation</h3>
            <p>X: {canvasData.x.toFixed(2)} cm</p>
            <p>Y: {canvasData.y.toFixed(2)} cm</p>
            <p>Rotation: {canvasData.r.toFixed(1)}°</p>
            <p><strong>Points: {currentSession?.timeSeries.length ?? 0}</strong></p>
          </div>

          <button css={toggleBtnStyle} onClick={() => setShowExplorer(!showExplorer)}>
            {showExplorer ? 'Hide' : 'Show'} Session History
          </button>

          {showExplorer && <SessionExplorer />}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <CalibrationProvider>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </CalibrationProvider>
  );
}
