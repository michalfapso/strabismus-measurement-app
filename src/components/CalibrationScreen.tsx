import React, { useState, useRef, useEffect } from 'react';
import { useCalibration } from '../hooks/useCalibration';
import { CalibrationMode, CanvasState } from '../types';
import { css } from '@emotion/react';

const CARD_WIDTH_MM = 85.60;
const CARD_HEIGHT_MM = 53.98;
const A4_SHORT_MM = 210;
const A4_LONG_MM = 297;
const DEFAULT_PPI = 96; // Default pixels per inch before first calibration
const CONTAINER_CENTER_X = 200; // legacy, kept for compatibility
const CONTAINER_CENTER_Y = 150; // legacy, kept for compatibility

const containerStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #1a1a1a;
  color: #fff;
  padding: 20px;
`;

const instructionStyle = css`
  font-size: 18px;
  margin-bottom: 30px;
  text-align: center;
  max-width: 600px;
  line-height: 1.6;
`;

const modeSelectionStyle = css`
  display: flex;
  flex-direction: column;
  gap: 15px;
  align-items: center;
  margin-bottom: 30px;
`;

const modeButtonStyle = css`
  padding: 15px 30px;
  font-size: 16px;
  border: 2px solid #00ff00;
  border-radius: 4px;
  cursor: pointer;
  background: rgba(0, 255, 0, 0.1);
  color: #00ff00;
  font-weight: bold;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 255, 0, 0.3);
    border-color: #00ff00;
  }
`;

const calibrationAreaStyle = css`
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 30px;
  min-height: 350px;
  width: 100%;
`;

const resizableRectStyle = css`
  background: rgba(0, 255, 0, 0.1);
  border: 3px solid #00ff00;
  cursor: nwse-resize;
  position: absolute;
  min-width: 50px;
  min-height: 30px;
`;

const lineHandleStyle = css`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #00ff00;
  position: absolute;
  cursor: ew-resize;
  top: calc(50% + 15px);

  &:hover {
    background: #00cc00;
  }
`;

const buttonGroupStyle = css`
  display: flex;
  gap: 10px;
  position: relative;
  z-index: 1;
`;

const buttonStyle = css`
  padding: 12px 24px;
  font-size: 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: #00ff00;
  color: #000;
  font-weight: bold;

  &:hover {
    background: #00cc00;
  }
`;

const resultStyle = css`
  font-size: 20px;
  margin-top: 20px;
  text-align: center;
  color: #00ff00;
`;

const backButtonStyle = css`
  ${buttonStyle}
  background: #888;
  color: #fff;

  &:hover {
    background: #666;
  }
`;

interface RectState {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface LineState {
  x1: number;
  x2: number;
}

interface CalibrationScreenProps {
  onComplete: () => void;
  restoredCanvasState?: CanvasState;
  recalibrating?: boolean;
}

export function CalibrationScreen({ onComplete, restoredCanvasState, recalibrating }: CalibrationScreenProps) {
  const { calibration, setPpi } = useCalibration();
  const [mode, setMode] = useState<CalibrationMode | null>(null);
  const [rect, setRect] = useState<RectState>({
    width: 200,
    height: 126,
    x: CONTAINER_CENTER_X - 100,
    y: CONTAINER_CENTER_Y - 63,
  });
  const [line, setLine] = useState<LineState>({
    x1: 100,
    x2: 300,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [draggingEndpoint, setDraggingEndpoint] = useState<'left' | 'right' | null>(null);
  const [ppi, setPpiLocal] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-load last mode on recalibration
  useEffect(() => {
    if (recalibrating && calibration?.lastMode) {
      setMode(calibration.lastMode);
    }
  }, [recalibrating, calibration?.lastMode]);

  // Initialize credit card with previous PPI or default PPI
  useEffect(() => {
    if (mode === 'credit-card' && containerRef.current) {
      const ppiValue = calibration?.ppi || DEFAULT_PPI;
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const centerX = containerWidth / 2;
      const centerY = containerHeight / 2;

      const newWidth = (CARD_WIDTH_MM / 25.4) * ppiValue;
      const newHeight = (CARD_HEIGHT_MM / 25.4) * ppiValue;

      setRect({
        width: newWidth,
        height: newHeight,
        x: centerX - newWidth / 2,
        y: centerY - newHeight / 2,
      });
    }
  }, [mode, calibration?.previousPpi]);

  // Initialize/pre-fill A4 lines on mode change or recalibration
  useEffect(() => {
    if ((mode === 'a4-short' || mode === 'a4-long') && containerRef.current) {
      const targetMm = mode === 'a4-short' ? A4_SHORT_MM : A4_LONG_MM;
      const ppiValue = calibration?.ppi || DEFAULT_PPI;
      const containerWidth = containerRef.current.clientWidth;
      const centerX = containerWidth / 2;
      const pixelWidth = (targetMm / 25.4) * ppiValue;

      // Constrain line to page width with 20px margin
      const maxWidth = containerWidth - 40;
      const constrainedPixelWidth = Math.min(pixelWidth, maxWidth);

      console.log('[INIT A4]', {
        mode,
        targetMm,
        previousPpi: calibration?.previousPpi,
        ppiValue,
        containerWidth,
        pixelWidth: pixelWidth.toFixed(2),
        maxWidth,
        constrainedPixelWidth: constrainedPixelWidth.toFixed(2),
        x1: (centerX - constrainedPixelWidth / 2).toFixed(2),
        x2: (centerX + constrainedPixelWidth / 2).toFixed(2),
      });

      setLine({
        x1: centerX - constrainedPixelWidth / 2,
        x2: centerX + constrainedPixelWidth / 2,
      });

      // Don't set ppi here - let auto-calc effect calculate it from line positions
      // This avoids oscillation from multiple ppi calculations
    }
  }, [mode, calibration?.previousPpi]);

  const handleCreditCardMouseDown = () => {
    if (mode === 'credit-card') {
      setIsDragging(true);
    }
  };

  const handleCreditCardMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || mode !== 'credit-card' || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const mouseX = e.clientX - containerRect.left;

    const halfWidth = Math.max(25, mouseX - centerX);
    const newWidth = halfWidth * 2;
    const newHeight = (newWidth / CARD_WIDTH_MM) * CARD_HEIGHT_MM;

    setRect({
      width: newWidth,
      height: newHeight,
      x: centerX - halfWidth,
      y: centerY - newHeight / 2,
    });
  };

  const handleLineMouseDown = (endpoint: 'left' | 'right') => {
    if (mode === 'a4-short' || mode === 'a4-long') {
      setIsDragging(true);
      setDraggingEndpoint(endpoint);
    }
  };

  const handleLineMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !draggingEndpoint || !containerRef.current) return;
    if (mode !== 'a4-short' && mode !== 'a4-long') return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRef.current.clientWidth;
    const screenCenter = containerWidth / 2;
    const mouseX = e.clientX - containerRect.left;
    const margin = 20; // margin from page edges

    if (draggingEndpoint === 'left') {
      // When dragging left endpoint, expand both from center
      const distance = screenCenter - mouseX;
      const newX1 = Math.max(margin, screenCenter - Math.abs(distance));
      const newX2 = Math.min(containerWidth - margin, screenCenter + Math.abs(distance));

      setLine({
        x1: newX1,
        x2: newX2,
      });
    } else {
      // When dragging right endpoint, expand both from center
      const distance = mouseX - screenCenter;
      const newX2 = Math.min(containerWidth - margin, screenCenter + Math.abs(distance));
      const newX1 = Math.max(margin, screenCenter - Math.abs(distance));

      setLine({
        x1: newX1,
        x2: newX2,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingEndpoint(null);
  };

  const calculateCreditCardPPI = () => {
    const ppiValue = rect.width / CARD_WIDTH_MM * 25.4;
    setPpiLocal(ppiValue);
  };

  const calculateA4PPI = () => {
    const targetMm = mode === 'a4-short' ? A4_SHORT_MM : A4_LONG_MM;
    const pixelWidth = line.x2 - line.x1;
    const ppiValue = pixelWidth / targetMm * 25.4;
    console.log('[CALC A4 PPI]', { targetMm, pixelWidth: pixelWidth.toFixed(2), ppiValue: ppiValue.toFixed(2) });
    setPpiLocal(ppiValue);
  };

  const handleConfirm = async () => {
    if (ppi && mode) {
      console.log('[CONFIRM]', { mode, ppi: ppi.toFixed(2) });
      await setPpi(ppi, mode);
      onComplete();
    }
  };

  const handleBack = () => {
    setMode(null);
    setPpiLocal(null);
  };

  // Auto-calculate PPI when credit card rect dimensions change
  useEffect(() => {
    if (mode === 'credit-card') {
      calculateCreditCardPPI();
    }
  }, [rect.width]);

  // Auto-calculate PPI when A4 line dimensions change
  useEffect(() => {
    if (mode === 'a4-short' || mode === 'a4-long') {
      console.log('[AUTO-CALC A4] line changed', { x1: line.x1.toFixed(2), x2: line.x2.toFixed(2), width: (line.x2 - line.x1).toFixed(2) });
      calculateA4PPI();
    }
  }, [line.x1, line.x2]);

  // Mode selection view - show when no mode selected (Back button or initial selection)
  if (mode === null) {
    return (
      <div css={containerStyle}>
        <div css={instructionStyle}>
          <h1>Choose Calibration Method</h1>
          <p>Select the reference object you'll use to calibrate the measurement system.</p>
        </div>

        <div css={modeSelectionStyle}>
          <button css={modeButtonStyle} onClick={() => setMode('a4-short')}>
            A4 Paper Short Edge (210 mm)
          </button>
          <button css={modeButtonStyle} onClick={() => setMode('a4-long')}>
            A4 Paper Long Edge (297 mm)
          </button>
          <button css={modeButtonStyle} onClick={() => setMode('credit-card')}>
            Credit Card (85.60 mm × 53.98 mm)
          </button>
        </div>
      </div>
    );
  }

  // Credit card mode
  if (mode === 'credit-card') {
    return (
      <div
        css={containerStyle}
        onMouseMove={handleCreditCardMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div css={instructionStyle}>
          <h1>Calibration: Credit Card</h1>
          <p>
            Resize the green rectangle to match your physical credit card (85.60 mm × 53.98 mm).
            Drag anywhere on the rectangle to resize it from the center.
          </p>
        </div>

        <div css={calibrationAreaStyle} ref={containerRef}>
          <div
            css={resizableRectStyle}
            onMouseDown={handleCreditCardMouseDown}
            style={{
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              left: `${rect.x}px`,
              top: `${rect.y}px`,
            }}
          />
        </div>

        {ppi && (
          <div css={resultStyle}>
            <p>Size: {Math.round(rect.width)} × {Math.round(rect.height)} pixels</p>
            <p>Calculated PPI: {ppi.toFixed(2)} pixels/inch</p>
          </div>
        )}

        <div css={buttonGroupStyle} style={{ marginTop: '20px' }}>
          <button css={backButtonStyle} onClick={handleBack}>
            Back
          </button>
          <button css={buttonStyle} onClick={handleConfirm} disabled={!ppi}>
            Confirm & Continue
          </button>
        </div>
      </div>
    );
  }

  // A4 paper mode
  const a4TargetMm = mode === 'a4-short' ? A4_SHORT_MM : A4_LONG_MM;
  const modeLabel = mode === 'a4-short' ? 'Short Edge (210 mm)' : 'Long Edge (297 mm)';

  return (
    <div
      css={containerStyle}
      onMouseMove={handleLineMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div css={instructionStyle}>
        <h1>Calibration: A4 Paper {modeLabel}</h1>
        <p>
          Drag the line endpoints to match the length of the A4 paper edge ({a4TargetMm} mm).
          The green line shows the current measurement.
        </p>
      </div>

      <div css={calibrationAreaStyle} ref={containerRef}>
        <svg style={{ width: '100%', height: '100%', position: 'absolute' }}>
          <line
            x1={line.x1}
            y1={CONTAINER_CENTER_Y}
            x2={line.x2}
            y2={CONTAINER_CENTER_Y}
            stroke="#00ff00"
            strokeWidth={2}
          />
        </svg>
        <div
          css={lineHandleStyle}
          onMouseDown={() => handleLineMouseDown('left')}
          style={{ left: `${line.x1 - 5}px` }}
        />
        <div
          css={lineHandleStyle}
          onMouseDown={() => handleLineMouseDown('right')}
          style={{ left: `${line.x2 - 5}px` }}
        />
      </div>

      {ppi && (
        <div css={resultStyle}>
          <p>Size: {Math.round(line.x2 - line.x1)} pixels</p>
          <p>Calculated PPI: {ppi.toFixed(2)} pixels/inch</p>
        </div>
      )}

      <div css={buttonGroupStyle} style={{ marginTop: '20px' }}>
        <button css={backButtonStyle} onClick={handleBack}>
          Back
        </button>
        <button css={buttonStyle} onClick={handleConfirm} disabled={!ppi}>
          Confirm & Continue
        </button>
      </div>
    </div>
  );
}
