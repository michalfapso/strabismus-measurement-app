import React, { useState, useRef } from 'react';
import { useCalibration } from '../hooks/useCalibration';
import { CalibrationMode, CanvasState } from '../types';
import { css } from '@emotion/react';

const CARD_WIDTH_MM = 85.60;
const CARD_HEIGHT_MM = 53.98;
const A4_SHORT_MM = 210;
const A4_LONG_MM = 297;
const CONTAINER_CENTER_X = 200; // half of 400px container
const CONTAINER_CENTER_Y = 150; // half of 300px container

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

const canvasContainerStyle = css`
  border: 2px solid #00ff00;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 400px;
  height: 300px;
  position: relative;
  margin-bottom: 30px;
`;

const resizableRectStyle = css`
  background: rgba(255, 0, 0, 0.2);
  border: 3px dashed #ff0000;
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
  top: 50%;
  transform: translateY(-50%);

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

const lengthDisplayStyle = css`
  font-size: 16px;
  color: #00ff00;
  text-align: center;
  margin-top: 10px;
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
}

export function CalibrationScreen({ onComplete, restoredCanvasState }: CalibrationScreenProps) {
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

  // Initialize credit card with previous PPI if available
  React.useEffect(() => {
    if (mode === 'credit-card' && calibration?.previousPpi) {
      const previousPixelWidth = CARD_WIDTH_MM * calibration.previousPpi;
      const newHeight = previousPixelWidth * (CARD_HEIGHT_MM / CARD_WIDTH_MM);
      setRect({
        width: previousPixelWidth,
        height: newHeight,
        x: CONTAINER_CENTER_X - previousPixelWidth / 2,
        y: CONTAINER_CENTER_Y - newHeight / 2,
      });
    }
  }, [mode, calibration]);

  const handleCreditCardMouseDown = () => {
    if (mode === 'credit-card') {
      setIsDragging(true);
    }
  };

  const handleCreditCardMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || mode !== 'credit-card' || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;

    const halfWidth = Math.max(25, mouseX - CONTAINER_CENTER_X);
    const newWidth = halfWidth * 2;
    const newHeight = newWidth * (CARD_HEIGHT_MM / CARD_WIDTH_MM);

    setRect({
      width: newWidth,
      height: newHeight,
      x: CONTAINER_CENTER_X - halfWidth,
      y: CONTAINER_CENTER_Y - newHeight / 2,
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
    const mouseX = e.clientX - containerRect.left;

    if (draggingEndpoint === 'left') {
      setLine((prev) => ({
        x1: Math.max(10, Math.min(mouseX, prev.x2 - 50)),
        x2: prev.x2,
      }));
    } else {
      setLine((prev) => ({
        x1: prev.x1,
        x2: Math.min(390, Math.max(mouseX, prev.x1 + 50)),
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingEndpoint(null);
  };

  const calculateCreditCardPpi = () => {
    const ppiValue = rect.width / CARD_WIDTH_MM * 25.4;
    setPpiLocal(ppiValue);
  };

  const calculateA4Ppi = () => {
    const targetMm = mode === 'a4-short' ? A4_SHORT_MM : A4_LONG_MM;
    const pixelWidth = line.x2 - line.x1;
    const ppiValue = pixelWidth / targetMm * 25.4;
    setPpiLocal(ppiValue);
  };

  const handleConfirm = async () => {
    if (ppi) {
      await setPpi(ppi);
      onComplete();
    }
  };

  const handleBack = () => {
    setMode(null);
    setPpiLocal(null);
  };

  // Mode selection view
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
            Resize the red rectangle to match your physical credit card (85.60 mm × 53.98 mm).
            Drag anywhere on the rectangle to resize it from the center.
          </p>
        </div>

        <div css={canvasContainerStyle} ref={containerRef}>
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

        <div css={buttonGroupStyle}>
          <button css={backButtonStyle} onClick={handleBack}>
            Back
          </button>
          <button css={buttonStyle} onClick={calculateCreditCardPpi}>
            Calculate PPI
          </button>
        </div>

        {ppi && (
          <div css={resultStyle}>
            <p>PPI: {ppi.toFixed(2)} pixels/inch</p>
            <button css={buttonStyle} onClick={handleConfirm} style={{ marginTop: '20px' }}>
              Confirm & Continue
            </button>
          </div>
        )}
      </div>
    );
  }

  // A4 paper mode
  const a4TargetMm = mode === 'a4-short' ? A4_SHORT_MM : A4_LONG_MM;
  const modeLabel = mode === 'a4-short' ? 'Short Edge (210 mm)' : 'Long Edge (297 mm)';
  const currentPixelWidth = line.x2 - line.x1;
  const currentLengthMm = currentPixelWidth / ((ppi || 1) / 25.4);

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

      <div css={canvasContainerStyle} ref={containerRef}>
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

      <div css={lengthDisplayStyle}>
        <p>Current width: {currentPixelWidth}px</p>
        {ppi && <p>Calculated length: {currentLengthMm.toFixed(1)} mm</p>}
      </div>

      <div css={buttonGroupStyle}>
        <button css={backButtonStyle} onClick={handleBack}>
          Back
        </button>
        <button css={buttonStyle} onClick={calculateA4Ppi}>
          Calculate PPI
        </button>
      </div>

      {ppi && (
        <div css={resultStyle}>
          <p>PPI: {ppi.toFixed(2)} pixels/inch</p>
          <button css={buttonStyle} onClick={handleConfirm} style={{ marginTop: '20px' }}>
            Confirm & Continue
          </button>
        </div>
      )}
    </div>
  );
}
