export interface DateFilterBarProps {
  onDateChange: (from: Date, to: Date) => void;
  currentRange: { from: Date; to: Date };
}

export function DateFilterBar({ onDateChange, currentRange }: DateFilterBarProps) {
  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    onDateChange(date, currentRange.to);
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    onDateChange(currentRange.from, date);
  };

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const setPreset = (days: number | null) => {
    const to = new Date();
    const from = new Date(to);
    if (days !== null) {
      from.setDate(from.getDate() - days);
    } else {
      from.setFullYear(2000);
    }
    onDateChange(from, to);
  };

  const inputStyle = {
    marginLeft: '8px',
    padding: '6px 8px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '3px',
    color: '#fff',
    fontSize: '12px',
    width: '120px',
  };

  const presetButtonStyle = {
    padding: '6px 10px',
    fontSize: '12px',
    backgroundColor: 'rgba(0,255,0,0.1)',
    border: '1px solid #0a0',
    borderRadius: '3px',
    color: '#0f0',
    cursor: 'pointer',
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'center',
      padding: '12px',
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderRadius: '4px',
    }} data-component="DateFilterBar">
      <label style={{ fontSize: '12px', color: '#aaa' }}>
        From:
        <input
          type="date"
          value={formatDateForInput(currentRange.from)}
          onChange={handleFromChange}
          style={inputStyle}
        />
      </label>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{ fontSize: '12px', color: '#aaa' }}>
          To:
          <input
            type="date"
            value={formatDateForInput(currentRange.to)}
            onChange={handleToChange}
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setPreset(7)} style={presetButtonStyle}>7d</button>
          <button onClick={() => setPreset(30)} style={presetButtonStyle}>30d</button>
          <button onClick={() => setPreset(null)} style={presetButtonStyle}>All</button>
        </div>
      </div>
    </div>
  );
}
