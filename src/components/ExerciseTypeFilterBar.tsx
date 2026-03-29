export interface ExerciseTypeFilterBarProps {
  distinctTypes: string[];
  selectedTypes: Set<string>;
  onSelectedTypesChange: (types: Set<string>) => void;
}

export function ExerciseTypeFilterBar({
  distinctTypes,
  selectedTypes,
  onSelectedTypesChange,
}: ExerciseTypeFilterBarProps) {
  if (distinctTypes.length === 0) {
    return null;
  }

  const handleSelectAll = () => {
    onSelectedTypesChange(new Set(distinctTypes));
  };

  const handleSelectNone = () => {
    onSelectedTypesChange(new Set());
  };

  const handleToggleType = (type: string) => {
    const newSelection = new Set(selectedTypes);
    if (newSelection.has(type)) {
      newSelection.delete(type);
    } else {
      newSelection.add(type);
    }
    onSelectedTypesChange(newSelection);
  };

  const allSelected = selectedTypes.size === distinctTypes.length;
  const noneSelected = selectedTypes.size === 0;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderBottom: '1px solid rgba(0, 255, 0, 0.2)',
        marginBottom: '12px',
      }}
    >
      <button
        onClick={handleSelectAll}
        disabled={allSelected}
        style={{
          padding: '6px 10px',
          fontSize: '12px',
          backgroundColor: 'rgba(0, 255, 0, 0.1)',
          border: '1px solid #0a0',
          borderRadius: '3px',
          color: '#0f0',
          cursor: allSelected ? 'not-allowed' : 'pointer',
          opacity: allSelected ? 0.5 : 1,
        }}
      >
        All
      </button>

      <button
        onClick={handleSelectNone}
        disabled={noneSelected}
        style={{
          padding: '6px 10px',
          fontSize: '12px',
          backgroundColor: 'rgba(0, 255, 0, 0.1)',
          border: '1px solid #0a0',
          borderRadius: '3px',
          color: '#0f0',
          cursor: noneSelected ? 'not-allowed' : 'pointer',
          opacity: noneSelected ? 0.5 : 1,
        }}
      >
        None
      </button>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        {distinctTypes.map((type) => (
          <label
            key={type}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#0f0',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={selectedTypes.has(type)}
              onChange={() => handleToggleType(type)}
              style={{
                cursor: 'pointer',
                accentColor: '#0f0',
              }}
            />
            {type}
          </label>
        ))}
      </div>
    </div>
  );
}
