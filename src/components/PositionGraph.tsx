import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface PositionGraphProps {
  data: Array<{
    time: number;
    x: number;
    y: number;
    timeFormatted: string;
  }>;
  multiSession?: boolean;
  title?: string;
}

export function PositionGraph({ data, multiSession = false, title = 'Position Over Time' }: PositionGraphProps) {
  if (!data || data.length === 0) {
    return <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>No data available</div>;
  }

  return (
    <div style={{ width: '100%', height: '300px' }} data-component="PositionGraph">
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
            label={{ value: 'Position (cm)', angle: -90, position: 'insideLeft', fill: '#888' }}
            style={{ fontSize: '12px' }}
            tick={{ fill: '#888' }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #444', borderRadius: '4px' }}
            labelStyle={{ color: '#fff' }}
          />
          <Legend wrapperStyle={{ color: '#fff' }} />
          <Line
            type="monotone"
            dataKey="x"
            stroke="#FF6B6B"
            name="X Position"
            strokeWidth={multiSession ? 1 : 2}
            opacity={multiSession ? 0.6 : 1}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="y"
            stroke="#4ECDC4"
            name="Y Position"
            strokeWidth={multiSession ? 1 : 2}
            opacity={multiSession ? 0.6 : 1}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
