import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface RotationGraphProps {
  data: Array<{ time: number; r: number; timeFormatted: string }>;
  title?: string;
}

export function RotationGraph({ data, title = 'Rotation Over Time' }: RotationGraphProps) {
  if (!data || data.length === 0) {
    return <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>No data available</div>;
  }

  return (
    <div style={{ width: '100%', height: '300px' }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#fff' }}>{title}</h3>
      <ResponsiveContainer width="100%" height={270}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="timeFormatted"
            stroke="#888"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#888' }}
          />
          <YAxis
            stroke="#888"
            label={{ value: 'Rotation (degrees)', angle: -90, position: 'insideLeft', fill: '#888' }}
            style={{ fontSize: '12px' }}
            tick={{ fill: '#888' }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #444', borderRadius: '4px' }}
            labelStyle={{ color: '#fff' }}
            formatter={(value: any) => (typeof value === 'number' ? value.toFixed(1) : value)}
          />
          <Legend wrapperStyle={{ color: '#fff' }} />
          <Line
            type="monotone"
            dataKey="r"
            stroke="#FFD93D"
            name="Rotation"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
