/**
 * Unified dark theme for the application.
 * All colors are defined here to ensure consistency across components.
 */

export const THEME = {
  // Background & Layout
  background: 'rgba(10, 10, 10, 0.98)',
  backgroundLight: 'rgba(20, 20, 20, 0.8)',

  // Text Colors
  textPrimary: '#fff',
  textSecondary: '#aaa',
  textMuted: 'rgba(255, 255, 255, 0.5)',

  // Borders & Dividers
  borderPrimary: 'rgba(255, 255, 255, 0.1)',
  borderSecondary: 'rgba(255, 255, 255, 0.05)',

  // Accents
  accentGreen: '#00ff00',
  accentGreenLight: 'rgba(0, 255, 0, 0.1)',    // Light green for backgrounds
  accentGreenBorder: 'rgba(0, 255, 0, 0.2)',   // Darker green for borders
  accentGreenActive: 'rgba(0, 255, 0, 0.3)',   // Active/pressed state for green
  accentCyan: '#00FFFF',
  accentMagenta: '#FF00FF',
  accentOrange: '#FF9500',
  accentGold: '#FFC107',

  // Metric Colors
  metricDeviation: '#00FFFF',   // cyan
  metricX: '#FF00FF',            // magenta
  metricY: '#FF9500',            // orange
  metricRotation: '#FFC107',     // gold

  // State Colors for Session Timeline
  stateFusion: '#4CAF50',
  stateNearFusion: '#8BC34A',
  stateApproaching: '#FF9800',
  stateStableDeviation: '#FFEB3B',
  stateDrifting: '#F44336',

  // Component-specific
  panelBg: 'rgba(20, 20, 20, 0.6)',
  panelBorder: 'rgba(255, 255, 255, 0.1)',
} as const;

export type Theme = typeof THEME;
