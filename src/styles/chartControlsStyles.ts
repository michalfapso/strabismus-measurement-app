// src/styles/chartControlsStyles.ts

import { css } from '@emotion/react';

/**
 * Style for metric checkboxes.
 * Shows bottom border (color legend), no outline border, subtle active background.
 */
export const metricCheckboxStyle = css`
  appearance: none;
  border: none;
  outline: none;
  padding: 6px 12px;
  background-color: transparent;
  cursor: pointer;
  border-bottom: 3px solid currentColor; /* Shows metric color */
  color: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 150ms ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  &:checked {
    background-color: rgba(255, 255, 255, 0.08);
  }
`;

/**
 * Style for Time mode toggle buttons (Absolute / Relative).
 * No border, lighter background on active state.
 */
export const timeModButtonStyle = css`
  appearance: none;
  border: none;
  outline: none;
  padding: 6px 12px;
  background-color: transparent;
  cursor: pointer;
  color: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 150ms ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  &:checked,
  &[aria-pressed="true"] {
    background-color: rgba(255, 255, 255, 0.12); /* 10-15% opacity */
  }
`;

/**
 * Style for metric toggle buttons (e.g., in TrendChart).
 * Same as Time mode button—lighter background for active state.
 */
export const metricButtonStyle = css`
  appearance: none;
  border: none;
  outline: none;
  padding: 6px 12px;
  background-color: transparent;
  cursor: pointer;
  color: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 150ms ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  &:checked,
  &[data-active="true"] {
    background-color: rgba(255, 255, 255, 0.12);
  }
`;
