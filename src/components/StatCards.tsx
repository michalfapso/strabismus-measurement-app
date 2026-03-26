import { CSSProperties } from 'react';

export interface StatCardsProps {
  positionRange?: { xMin: number; xMax: number; xRange: number; yMin: number; yMax: number; yRange: number };
  rotationRange?: { rMin: number; rMax: number; range: number };
  duration: number;
  meanDeviation: number;
  exerciseTag?: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const cardStyle: CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px',
  padding: '16px',
  color: '#fff',
};

const labelStyle: CSSProperties = {
  fontSize: '12px',
  color: '#aaa',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const valueStyle: CSSProperties = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#fff',
};

export function StatCards({ positionRange, rotationRange, duration, meanDeviation, exerciseTag }: StatCardsProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '12px',
      width: '100%',
    }}>
      {positionRange && (
        <div style={cardStyle}>
          <div style={labelStyle}>Position Range</div>
          <div style={valueStyle}>
            X: {positionRange.xMin.toFixed(1)} - {positionRange.xMax.toFixed(1)} cm
          </div>
          <div style={{ ...valueStyle, marginTop: '8px' }}>
            Y: {positionRange.yMin.toFixed(1)} - {positionRange.yMax.toFixed(1)} cm
          </div>
          <div style={{ ...labelStyle, marginTop: '8px' }}>Range: {positionRange.xRange.toFixed(1)} × {positionRange.yRange.toFixed(1)}</div>
        </div>
      )}

      {rotationRange && (
        <div style={cardStyle}>
          <div style={labelStyle}>Rotation Range</div>
          <div style={valueStyle}>
            {rotationRange.rMin.toFixed(1)}° to {rotationRange.rMax.toFixed(1)}°
          </div>
          <div style={{ ...labelStyle, marginTop: '12px' }}>Range</div>
          <div style={valueStyle}>{rotationRange.range.toFixed(1)}°</div>
        </div>
      )}

      <div style={cardStyle}>
        <div style={labelStyle}>Duration {exerciseTag && `(${exerciseTag})`}</div>
        <div style={valueStyle}>{formatDuration(duration)}</div>
        {exerciseTag && <div style={{ ...labelStyle, marginTop: '12px' }}>{exerciseTag}</div>}
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Mean Deviation</div>
        <div style={valueStyle}>{meanDeviation.toFixed(2)} cm</div>
        <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>from center</div>
      </div>
    </div>
  );
}
