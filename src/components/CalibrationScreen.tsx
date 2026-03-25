import React, { useState, useRef } from 'react';
import { useCalibration } from '../hooks/useCalibration';
import { css } from '@emotion/react';

const CARD_WIDTH_MM = 85.60;

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

const buttonGroupStyle = css`
  display: flex;
  gap: 10px;
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

interface RectState {
  width: number;
  height: number;
  x: number;
  y: number;
}

export function CalibrationScreen({ onComplete }: { onComplete: () => void }) {
  const { setPpmm } = useCalibration();
  const [rect, setRect] = useState<RectState>({
    width: 200,
    height: 126,
    x: 100,
    y: 87,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [ppmm, setPpmmLocal] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left;

    const newWidth = Math.max(50, x);
    const newHeight = Math.max(30, newWidth * (53.98 / 85.60));

    setRect((prev) => ({
      ...prev,
      width: newWidth,
      height: newHeight,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const calculatePPMM = () => {
    const ppmmValue = rect.width / CARD_WIDTH_MM;
    setPpmmLocal(ppmmValue);
  };

  const handleConfirm = async () => {
    if (ppmm) {
      await setPpmm(ppmm);
      onComplete();
    }
  };

  return (
    <div css={containerStyle} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div css={instructionStyle}>
        <h1>Calibration: Align with Credit Card</h1>
        <p>
          Resize the red rectangle to match your physical credit card (85.60 mm × 53.98 mm).
          Drag the bottom-right corner to adjust the size.
        </p>
      </div>

      <div css={canvasContainerStyle} ref={containerRef}>
        <div
          css={resizableRectStyle}
          onMouseDown={handleMouseDown}
          style={{
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            left: `${rect.x}px`,
            top: `${rect.y}px`,
          }}
        />
      </div>

      <div css={buttonGroupStyle}>
        <button css={buttonStyle} onClick={calculatePPMM}>
          Calculate PPMM
        </button>
      </div>

      {ppmm && (
        <div css={resultStyle}>
          <p>PPMM: {ppmm.toFixed(2)} pixels/mm</p>
          <button css={buttonStyle} onClick={handleConfirm} style={{ marginTop: '20px' }}>
            Confirm & Continue
          </button>
        </div>
      )}
    </div>
  );
}
