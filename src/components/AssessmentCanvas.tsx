import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Group } from 'react-konva';
import Konva from 'konva';
import { useCalibration } from '../hooks/useCalibration';
import { css } from '@emotion/react';

const canvasWrapperStyle = css`
  position: fixed;
  inset: 0;
  background: #000;
`;

const DEFAULT_PPMM = 3.78;

interface CrossState {
  x: number;
  y: number;
  rotation: number;
}

export function AssessmentCanvas({
  onPositionChange,
}: {
  onPositionChange: (x: number, y: number, r: number) => void;
}) {
  const { calibration } = useCalibration();
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [userCross, setUserCross] = useState<CrossState>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    rotation: 0,
  });
  const [isMoving, setIsMoving] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);

  const ppmm = calibration?.ppmm ?? DEFAULT_PPMM;
  const cmToPx = ppmm * 10;

  useEffect(() => {
    const handleResize = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const xCm = (userCross.x - size.width / 2) / cmToPx;
    const yCm = (size.height / 2 - userCross.y) / cmToPx;
    onPositionChange(xCm, yCm, userCross.rotation);
  }, [userCross, cmToPx, size]);

  // Left-button down/drag → move cross; right-button drag → rotate cross
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 0) {
      setIsMoving(true);
      const pos = stageRef.current?.getPointerPosition();
      if (pos) setUserCross((prev) => ({ ...prev, x: pos.x, y: pos.y }));
    }
    if (e.evt.button === 2) setIsRotating(true);
  };

  const handleMouseMove = (_e: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    if (isMoving) {
      setUserCross((prev) => ({ ...prev, x: pos.x, y: pos.y }));
    } else if (isRotating) {
      const dx = pos.x - userCross.x;
      const dy = pos.y - userCross.y;
      setUserCross((prev) => ({
        ...prev,
        rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
      }));
    }
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 0) setIsMoving(false);
    if (e.evt.button === 2) setIsRotating(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const step = cmToPx * 0.1;
      setUserCross((prev) => {
        const next = { ...prev };
        if (e.key === 'ArrowUp') next.y -= step;
        if (e.key === 'ArrowDown') next.y += step;
        if (e.key === 'ArrowLeft') next.x -= step;
        if (e.key === 'ArrowRight') next.x += step;
        return next;
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cmToPx]);

  const halfW = size.width / 2;
  const halfH = size.height / 2;
  const gridSpacing = cmToPx;
  // Extend lines well beyond visible canvas so they always appear infinite
  const lineExtent = Math.max(size.width, size.height) * 2;

  return (
    <div css={canvasWrapperStyle}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        {/* Static red cross with cm tick marks */}
        <Layer>
          <Line points={[halfW, 0, halfW, size.height]} stroke="#ff0000" strokeWidth={2} />
          <Line points={[0, halfH, size.width, halfH]} stroke="#ff0000" strokeWidth={2} />

          {Array.from({ length: Math.floor(size.height / gridSpacing) + 2 }).map((_, i) => {
            const offset = (i - Math.floor(size.height / gridSpacing / 2) - 1) * gridSpacing;
            return (
              <Line key={`ht-${i}`}
                points={[halfW - 5, halfH + offset, halfW + 5, halfH + offset]}
                stroke="#ff0000" strokeWidth={1} />
            );
          })}

          {Array.from({ length: Math.floor(size.width / gridSpacing) + 2 }).map((_, i) => {
            const offset = (i - Math.floor(size.width / gridSpacing / 2) - 1) * gridSpacing;
            return (
              <Line key={`vt-${i}`}
                points={[halfW + offset, halfH - 5, halfW + offset, halfH + 5]}
                stroke="#ff0000" strokeWidth={1} />
            );
          })}
        </Layer>

        {/* Green cross — infinite lines, rotatable via right-drag */}
        <Layer>
          <Group x={userCross.x} y={userCross.y} rotation={userCross.rotation}>
            <Line points={[0, -lineExtent, 0, lineExtent]} stroke="#00ff00" strokeWidth={2} />
            <Line points={[-lineExtent, 0, lineExtent, 0]} stroke="#00ff00" strokeWidth={2} />
            <Circle x={0} y={0} radius={4} fill="#00ff00" />
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
