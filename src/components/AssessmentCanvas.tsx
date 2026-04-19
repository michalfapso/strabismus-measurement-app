import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Group } from 'react-konva';
import Konva from 'konva';
import { useCalibration } from '../hooks/useCalibration';
import { CanvasState } from '../types';
import { css } from '@emotion/react';

const canvasWrapperStyle = css`
  position: fixed;
  inset: 0;
  background: #000;
`;

const DEFAULT_PPI = 96; // Standard screen DPI

// ── Rotation sensitivity ──────────────────────────────────────────────────────
// Degrees of rotation produced per pixel of mouse movement while right-dragging.
// Increase to rotate faster, decrease to rotate slower.
const ROTATION_DEG_PER_PX = 0.25;
// Degrees of rotation produced per wheel notch (deltaY of 100 ≈ one notch).
// Increase to rotate faster on scroll, decrease to rotate slower.
const ROTATION_DEG_PER_WHEEL_NOTCH = 1.0;

interface CrossState {
  x: number;
  y: number;
  rotation: number;
}

export function AssessmentCanvas({
  onPositionChange,
  restoredState,
  onStateRestored,
}: {
  onPositionChange: (x: number, y: number, r: number) => void;
  restoredState?: { x: number; y: number; rotation: number };
  onStateRestored?: () => void;
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
  // Mirrors userCross for use inside event handlers (avoids stale closures)
  const userCrossRef = useRef(userCross);
  useEffect(() => { userCrossRef.current = userCross; }, [userCross]);

  // Restore canvas state when returning from calibration
  useEffect(() => {
    if (restoredState) {
      const cmToPx = (calibration?.ppi ?? DEFAULT_PPI) / 2.54;
      const centerX = size.width / 2;
      const centerY = size.height / 2;

      // Convert from cm to pixels: x_px = center + x_cm * cmToPx
      const pixelX = centerX + restoredState.x * cmToPx;
      const pixelY = centerY - restoredState.y * cmToPx;

      setUserCross({
        x: pixelX,
        y: pixelY,
        rotation: restoredState.rotation,
      });

      if (onStateRestored) {
        onStateRestored();
      }
    }
  }, [restoredState, calibration, size, onStateRestored]);
  // Snapshot taken at right-mousedown: press position, starting rotation, and the
  // tangent direction (perpendicular to center→press, in CW screen orientation).
  // On each mousemove the total displacement from pressPos is projected onto this
  // tangent to get a signed distance → rotation with no per-frame accumulation.
  const rotStartRef = useRef<{
    pressPos: { x: number; y: number };
    startRotation: number;
    tangentX: number;
    tangentY: number;
  } | null>(null);

  const ppi = calibration?.ppi ?? DEFAULT_PPI;
  const cmToPx = ppi / 2.54;

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
    if (e.evt.button === 2) {
      setIsRotating(true);
      const pos = stageRef.current?.getPointerPosition();
      if (pos) {
        const { x: cx, y: cy, rotation } = userCrossRef.current;
        const toPressX = pos.x - cx;
        const toPressY = pos.y - cy;
        const len = Math.sqrt(toPressX * toPressX + toPressY * toPressY);
        // Tangent = 90° CW rotation of center→press, normalised.
        // Falls back to rightward (1, 0) if pressed exactly on the center.
        rotStartRef.current = {
          pressPos: { x: pos.x, y: pos.y },
          startRotation: rotation,
          tangentX: len > 0 ? toPressY / len : 1,
          tangentY: len > 0 ? -toPressX / len : 0,
        };
      }
    }
  };

  const handleMouseMove = (_e: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    if (isMoving) {
      setUserCross((prev) => ({ ...prev, x: pos.x, y: pos.y }));
    } else if (isRotating && rotStartRef.current) {
      const { pressPos, startRotation, tangentX, tangentY } = rotStartRef.current;
      // Project total displacement from press onto the tangent → signed distance
      const signedDist = (pos.x - pressPos.x) * tangentX + (pos.y - pressPos.y) * tangentY;
      setUserCross((prev) => ({
        ...prev,
        rotation: startRotation + signedDist * ROTATION_DEG_PER_PX,
      }));
    }
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 0) setIsMoving(false);
    if (e.evt.button === 2) setIsRotating(false);
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const delta = (e.evt.deltaY / 100) * ROTATION_DEG_PER_WHEEL_NOTCH;
    setUserCross((prev) => ({ ...prev, rotation: prev.rotation + delta }));
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
    <div css={canvasWrapperStyle} data-component="AssessmentCanvas">
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
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
