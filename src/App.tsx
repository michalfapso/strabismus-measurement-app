import React, { useState } from 'react';
import { useNavigate, useRoutes, useLocation } from 'react-router-dom';
import { CalibrationProvider } from './context/CalibrationContext';
import { SessionProvider } from './context/SessionContext';
import { CalibrationScreen } from './components/CalibrationScreen';
import { AssessmentCanvas } from './components/AssessmentCanvas';
import { DataCaptureControl } from './components/DataCaptureControl';
import { HistoryPage } from './components/HistoryPage';
import { SettingsPage } from './components/SettingsPage';
import { ResultsPanel } from './components/ResultsPanel';
import { useCalibration } from './hooks/useCalibration';
import { useSession } from './hooks/useSession';
import { CanvasState } from './types';
import { css } from '@emotion/react';
import { APP_BASE_URL } from './config';

/* ── overlay container (top-right desktop, bottom-right mobile) ─────────────────────── */
const overlayStyle = css`
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none; /* let clicks fall through to canvas by default */

  @media (max-width: 768px) {
    top: auto;
    bottom: 16px;
    flex-direction: row;
  }

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

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: auto;
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
  const { currentSession, completedSession, showResults, setShowResults } = useSession();
  const [showCalibration, setShowCalibration] = useState(false);
  const [canvasData, setCanvasData] = useState({ x: 0, y: 0, r: 0 });
  const [savedCanvasState, setSavedCanvasState] = useState<CanvasState | undefined>();
  const [restoredCanvasState, setRestoredCanvasState] = useState<CanvasState | undefined>();
  const navigate = useNavigate();
  const location = useLocation();

  const onMeasurementPage = location.pathname === '/';

  // Helper function to navigate to History page, preserving last URL if available
  const handleHistoryClick = () => {
    let lastUrl = localStorage.getItem('lastHistoryUrl');
    const defaultUrl = `/history`;

    if (lastUrl) {
      // Strip base path prefix to avoid duplication (BrowserRouter basename already adds it)
      const basePath = APP_BASE_URL.replace(/\/$/, ''); // remove trailing slash
      if (basePath && lastUrl.startsWith(basePath)) {
        lastUrl = lastUrl.substring(basePath.length);
      }
    }

    navigate(lastUrl || defaultUrl);
  };

  const routeElement = useRoutes([
    {
      path: '/',
      element: (
        <AssessmentCanvas
          onPositionChange={(x, y, r) => setCanvasData({ x, y, r })}
          restoredState={restoredCanvasState}
          onStateRestored={() => setRestoredCanvasState(undefined)}
        />
      ),
    },
    { path: '/history', element: <HistoryPage /> },
    { path: '/settings', element: <SettingsPage /> },
  ]);

  if (isLoading) return null;

  // Case 1: First-time calibration — no toolbar, full takeover
  if (!calibration) {
    return (
      <CalibrationScreen
        onComplete={() => {
          setShowCalibration(false);
          if (savedCanvasState) {
            setRestoredCanvasState(savedCanvasState);
            setSavedCanvasState(undefined);
          }
        }}
        restoredCanvasState={restoredCanvasState}
        recalibrating={false}
      />
    );
  }

  // Case 2: Recalibrating — show toolbar above CalibrationScreen
  if (showCalibration) {
    return (
      <>
        <CalibrationScreen
          onComplete={() => {
            setShowCalibration(false);
            if (savedCanvasState) {
              setRestoredCanvasState(savedCanvasState);
              setSavedCanvasState(undefined);
            }
          }}
          restoredCanvasState={restoredCanvasState}
          recalibrating={true}
        />
        <div css={overlayStyle}>
          <div css={chipRowStyle}>
            <button css={chipStyle} onClick={() => { setShowCalibration(false); navigate('/'); }}>
              ☰ Measurement
            </button>
            <button css={chipStyle} onClick={() => { setShowCalibration(false); handleHistoryClick(); }}>
              📊 History
            </button>
            <button css={chipStyle} onClick={() => { setShowCalibration(false); navigate('/settings'); }}>
              ⚙️ Settings
            </button>
          </div>
        </div>
      </>
    );
  }

  const handleRecalibrate = () => {
    setSavedCanvasState({
      x: canvasData.x,
      y: canvasData.y,
      rotation: canvasData.r,
    });
    setShowCalibration(true);
  };

  return (
    <>
      {routeElement}

      {/* Floating overlay — always visible */}
      <div css={overlayStyle} data-component="AppOverlay">

        {/* Top chip row */}
        <div css={chipRowStyle}>
          {onMeasurementPage && (
            <div css={hudStyle}>
              {canvasData.x.toFixed(2)}&thinsp;cm&ensp;
              {canvasData.y.toFixed(2)}&thinsp;cm&ensp;
              {canvasData.r.toFixed(1)}°
              {currentSession && (
                <>&ensp;· {currentSession.timeSeries.length}&thinsp;pts</>
              )}
            </div>
          )}
          <button css={chipStyle} onClick={() => navigate('/')}>
            ☰ Measurement
          </button>
          <button css={chipStyle} onClick={handleHistoryClick}>
            📊 History
          </button>
          <button css={chipStyle} onClick={() => navigate('/settings')}>
            ⚙️ Settings
          </button>
          <button css={chipStyle} onClick={handleRecalibrate}>
            Recalibrate
          </button>
        </div>

        {/* Collapsible controls panel */}
        {onMeasurementPage && (
          <div css={panelStyle}>
            <DataCaptureControl
              currentCanvasPosition={canvasData}
              onStartMeasurement={() => setShowResults(false)}
            />
          </div>
        )}

        {/* Results panel after measurement */}
        <ResultsPanel
          session={completedSession}
          visible={showResults}
          onDismiss={() => {
            setShowResults(false);
          }}
        />

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
