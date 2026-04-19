import React from 'react';
import { PREDEFINED_EXERCISES, ExerciseType } from '../types';
import { css } from '@emotion/react';

const selectStyle = css`
  padding: 10px;
  font-size: 16px;
  border: 2px solid #00ff00;
  background: #1a1a1a;
  color: #00ff00;
  border-radius: 4px;
  cursor: pointer;

  option {
    background: #1a1a1a;
    color: #00ff00;
  }

  &:focus {
    outline: none;
    background: #2a2a2a;
  }
`;

export function ExerciseSelector({
  value,
  onChange,
}: {
  value: ExerciseType;
  onChange: (exercise: ExerciseType) => void;
}) {
  return (
    <select
      css={selectStyle}
      value={value}
      onChange={(e) => onChange(e.target.value as ExerciseType)}
      data-component="ExerciseSelector"
    >
      {PREDEFINED_EXERCISES.map((exercise) => (
        <option key={exercise} value={exercise}>
          {exercise}
        </option>
      ))}
    </select>
  );
}
