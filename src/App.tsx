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

/* ── overlay container (top-right corner) ─────────────────────── */
const overlayStyle = css`
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none; /* let clicks fall through to canvas by default */

  & > * {
    pointer-events: auto;
  }
`;

/* ── semi-transparent panel ────────────────────────────────────── */
const panelStyle = css`
  background: rgba(10, 10, 10, 0.82);
  border: 1px solid #00ff00;
  border-radius: 6px;
  backdrop-filter: blur(6px);
  overflow: hidden;
`;

/* ── small icon/text buttons in the top bar ────────────────────── */
const chipRowStyle = css`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const chipStyle = css`
  padding: 5px 11px;
  font-size: 12px;
  background: rgba(10, 10, 10, 0.82);
  color: #00ff00;
  border: 1px solid #00ff00;
  border-radius: 4px;
  cursor: pointer;
  backdrop-filter: blur(6px);
  white-space: nowrap;

  &:hover {
    background: rgba(0, 255, 0, 0.12);
  }
`;

/* ── position HUD ──────────────────────────────────────────────── */
const hudStyle = css`
  padding: 6px 12px;
  font-size: 12px;
  color: #00ff00;
  background: rgba(10, 10, 10, 0.72);
  border: 1px solid #333;
  border-radius: 4px;
  backdrop-filter: blur(6px);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

function AppContent() {
  const { calibration, isLoading } = useCalibration();
  const { currentSession } = useSession();
  const [showCalibration, setShowCalibration] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [canvasData, setCanvasData] = useState({ x: 0, y: 0, r: 0 });

  if (isLoading) return null;

  if (!calibration || showCalibration) {
    return <CalibrationScreen onComplete={() => setShowCalibration(false)} />;
  }

  return (
    <>
      {/* Canvas fills entire screen */}
      <AssessmentCanvas onPositionChange={(x, y, r) => setCanvasData({ x, y, r })} />

      {/* Floating overlay */}
      <div css={overlayStyle}>

        {/* Top chip row — always visible */}
        <div css={chipRowStyle}>
          <div css={hudStyle}>
            {canvasData.x.toFixed(2)}&thinsp;cm&ensp;
            {canvasData.y.toFixed(2)}&thinsp;cm&ensp;
            {canvasData.r.toFixed(1)}°
            {currentSession && (
              <>&ensp;· {currentSession.timeSeries.length}&thinsp;pts</>
            )}
          </div>
          <button css={chipStyle} onClick={() => setShowControls((v) => !v)}>
            {showControls ? '✕ Controls' : '☰ Controls'}
          </button>
          <button css={chipStyle} onClick={() => setShowHistory((v) => !v)}>
            History
          </button>
          <button css={chipStyle} onClick={() => setShowCalibration(true)}>
            Recalibrate
          </button>
        </div>

        {/* Collapsible controls panel */}
        {showControls && (
          <div css={panelStyle}>
            <DataCaptureControl />
          </div>
        )}

        {/* Collapsible session history panel */}
        {showHistory && (
          <div css={panelStyle}>
            <SessionExplorer />
          </div>
        )}

      </div>
    </>
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
