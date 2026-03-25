import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Group } from 'react-konva';
import Konva from 'konva';
import { useCalibration } from '../hooks/useCalibration';
import { css } from '@emotion/react';

const canvasWrapperStyle = css`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
`;

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 900;
const HALF_WIDTH = CANVAS_WIDTH / 2;
const HALF_HEIGHT = CANVAS_HEIGHT / 2;
const DEFAULT_CM_TO_PX = 37.8;

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
  const [userCross, setUserCross] = useState<CrossState>({
    x: HALF_WIDTH,
    y: HALF_HEIGHT,
    rotation: 0,
  });
  const [isRotating, setIsRotating] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);
  const groupRef = useRef<Konva.Group>(null);

  const ppmm = calibration?.ppmm || DEFAULT_CM_TO_PX / 10;
  const cmToPx = ppmm * 10; // ppmm * 10 = pixels per cm

  useEffect(() => {
    const xCm = (userCross.x - HALF_WIDTH) / cmToPx;
    const yCm = (HALF_HEIGHT - userCross.y) / cmToPx;
    onPositionChange(xCm, yCm, userCross.rotation);
  }, [userCross, cmToPx]);

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) {
      setIsRotating(true);
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!stageRef.current || !isRotating || !groupRef.current) return;

    const pointerPos = stageRef.current.getPointerPosition();
    if (!pointerPos) return;

    const groupPos = groupRef.current.getAbsolutePosition();
    const dx = pointerPos.x - groupPos.x;
    const dy = pointerPos.y - groupPos.y;

    const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
    setUserCross((prev) => ({ ...prev, rotation }));
  };

  const handleMouseUp = () => {
    setIsRotating(false);
  };

  const handleDragEnd = () => {
    if (!groupRef.current) return;
    const pos = groupRef.current.getAbsolutePosition();
    setUserCross((prev) => ({
      ...prev,
      x: pos.x,
      y: pos.y,
    }));
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

  const gridSpacing = cmToPx;

  return (
    <div css={canvasWrapperStyle}>
      <Stage
        ref={stageRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        {/* Background Layer — static red cross with cm ticks */}
        <Layer>
          {/* Vertical axis */}
          <Line
            points={[HALF_WIDTH, 0, HALF_WIDTH, CANVAS_HEIGHT]}
            stroke="#ff0000"
            strokeWidth={2}
          />
          {/* Horizontal axis */}
          <Line
            points={[0, HALF_HEIGHT, CANVAS_WIDTH, HALF_HEIGHT]}
            stroke="#ff0000"
            strokeWidth={2}
          />

          {/* Vertical ticks */}
          {Array.from({ length: Math.floor(CANVAS_HEIGHT / gridSpacing) + 1 }).map((_, i) => {
            const offset = (i - Math.floor(CANVAS_HEIGHT / gridSpacing / 2)) * gridSpacing;
            return (
              <Line
                key={`h-tick-${i}`}
                points={[HALF_WIDTH - 5, HALF_HEIGHT + offset, HALF_WIDTH + 5, HALF_HEIGHT + offset]}
                stroke="#ff0000"
                strokeWidth={1}
              />
            );
          })}

          {/* Horizontal ticks */}
          {Array.from({ length: Math.floor(CANVAS_WIDTH / gridSpacing) + 1 }).map((_, i) => {
            const offset = (i - Math.floor(CANVAS_WIDTH / gridSpacing / 2)) * gridSpacing;
            return (
              <Line
                key={`v-tick-${i}`}
                points={[HALF_WIDTH + offset, HALF_HEIGHT - 5, HALF_WIDTH + offset, HALF_HEIGHT + 5]}
                stroke="#ff0000"
                strokeWidth={1}
              />
            );
          })}
        </Layer>

        {/* User-Controlled Layer — green draggable/rotatable cross */}
        <Layer>
          <Group
            ref={groupRef}
            x={userCross.x}
            y={userCross.y}
            draggable
            onDragEnd={handleDragEnd}
            rotation={userCross.rotation}
          >
            <Line
              points={[0, -50, 0, 50]}
              stroke="#00ff00"
              strokeWidth={2}
            />
            <Line
              points={[-50, 0, 50, 0]}
              stroke="#00ff00"
              strokeWidth={2}
            />
            <Circle x={0} y={0} radius={5} fill="#00ff00" />
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
