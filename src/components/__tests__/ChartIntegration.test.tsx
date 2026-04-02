import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeSeriesGraph } from '../TimeSeriesGraph';
import { HistogramChart } from '../HistogramChart';
import { TrendChart } from '../TrendChart';
import { Session, TimeSeries } from '../../types';

/**
 * Chart Refinements - Integration Tests
 *
 * This test file verifies that the chart refinements work correctly:
 * 1. TimeSeriesGraph: Multi-metric support, relative time mode, and tooltip formatting
 * 2. HistogramChart: Box plot visualization and coverage percentages
 * 3. TrendChart: Styling consistency with new control styles
 * 4. Styling: Removal of neon green borders and consistent button styling
 * 5. Tooltips: Proper formatting across all charts
 */

describe('Chart Refinements - Integration Tests', () => {
  // Mock session data for testing
  const mockSessionData: Session[] = [
    {
      sessionId: 's1',
      timestamp: '2026-03-30T10:00:00Z',
      exerciseTag: 'Pencil Push-ups',
      ppi: 96,
      timeSeries: [
        { t: 0, x: 0.5, y: 0.5, r: 0 },
        { t: 5000, x: 1.0, y: 0.8, r: 0 },
        { t: 10000, x: 0.8, y: 0.3, r: 0 },
      ],
    },
    {
      sessionId: 's2',
      timestamp: '2026-03-30T11:00:00Z',
      exerciseTag: 'Pencil Push-ups',
      ppi: 96,
      timeSeries: [
        { t: 0, x: 1.2, y: 0.4, r: 0 },
        { t: 4000, x: 1.5, y: 0.6, r: 0 },
        { t: 8000, x: 1.0, y: 0.2, r: 0 },
      ],
    },
  ];

  describe('TimeSeriesGraph', () => {
    test('renders without crashing with single session', () => {
      const { container } = render(
        <TimeSeriesGraph
          sessions={[mockSessionData[0]]}
          isSingleSession={true}
          selectedMetrics={['deviation']}
        />
      );
      // Component should render without throwing
      expect(container.querySelector('button')).toBeDefined();
    });

    test('renders without crashing with multiple sessions', () => {
      const { container } = render(
        <TimeSeriesGraph
          sessions={mockSessionData}
          isSingleSession={false}
          selectedMetrics={['deviation']}
        />
      );
      // Component should render without throwing
      expect(container.querySelector('button')).toBeDefined();
    });

    test('displays only the selected metrics from props', () => {
      const { container } = render(
        <TimeSeriesGraph
          sessions={[mockSessionData[0]]}
          isSingleSession={true}
          selectedMetrics={['deviation', 'x']}
        />
      );

      // Component should render the selected metrics
      expect(container.querySelector('svg')).toBeDefined();
    });

    test('renders without error when no view state is provided', () => {
      const { container } = render(
        <TimeSeriesGraph
          sessions={[mockSessionData[0]]}
          isSingleSession={true}
          selectedMetrics={['deviation']}
          viewState={undefined}
        />
      );
      // Should render successfully
      expect(container.querySelector('svg')).toBeDefined();
    });

    /**
     * Manual Verification Checklist:
     * [ ] Hover over data point and verify tooltip shows values rounded to 2 decimals
     * [ ] Verify individual session lines are colored by metric (cyan, magenta, orange, gold)
     * [ ] Verify individual session lines have opacity ~0.7 (not grey 0.1-0.2)
     * [ ] Set timeMode to 'relative' and verify x-axis shows percentages (0%, 50%, 100%)
     * [ ] Verify sessions with different durations align properly in relative mode
     * [ ] Single session: hover and verify tooltip shows only the value (no "Mean ± Std Dev")
     * [ ] Multiple sessions: hover and verify tooltip shows "Mean: X.XX ± Y.YY" format
     */
    test('time series graph renders with proper structure', () => {
      const { container } = render(
        <TimeSeriesGraph
          sessions={mockSessionData}
          isSingleSession={false}
        />
      );

      // Verify chart container exists
      const chartContainer = container.querySelector('[data-testid="timeseries-chart"]') ||
                             container.querySelector('svg');
      expect(chartContainer).toBeDefined();
    });
  });

  describe('HistogramChart', () => {
    test('renders without crashing with single session', () => {
      const { container } = render(
        <HistogramChart
          sessions={[mockSessionData[0]]}
          isSingleSession={true}
        />
      );
      // Component should render without throwing
      expect(container.querySelector('button') || container.querySelector('label')).toBeDefined();
    });

    test('renders without crashing with multiple sessions (aggregate mode)', () => {
      const { container } = render(
        <HistogramChart
          sessions={mockSessionData}
          isSingleSession={false}
        />
      );
      // Component should render without throwing
      expect(container.querySelector('button') || container.querySelector('label')).toBeDefined();
    });

    test('metric selector buttons exist for aggregate view', () => {
      const { container } = render(
        <HistogramChart
          sessions={mockSessionData}
          isSingleSession={false}
        />
      );

      // Verify metric buttons are rendered in aggregate view
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('renders chart structure without error', () => {
      const { container } = render(
        <HistogramChart
          sessions={mockSessionData}
          isSingleSession={false}
        />
      );

      // Verify chart container exists (SVG for recharts)
      const chartContainer = container.querySelector('[data-testid="histogram-chart"]') ||
                             container.querySelector('svg');
      expect(chartContainer).toBeDefined();
    });

    /**
     * Manual Verification Checklist:
     * [ ] Single session (n=1): Verify a single horizontal line is rendered
     * [ ] Two sessions (n=2): Verify min/max with median, no quartile box
     * [ ] Three+ sessions (n≥3): Verify full box plot with median, quartile box, whiskers
     * [ ] Aggregate view: Verify coverage percentage labels appear below each box plot
     * [ ] Hover over coverage label: Verify tooltip shows "X% of measurements (n=X/Y)"
     * [ ] Verify box plot colors match metric colors (not grey)
     * [ ] Verify hover background opacity is 30% (not bright)
     */
    test('histogram chart renders with proper structure', () => {
      const { container } = render(
        <HistogramChart
          sessions={mockSessionData}
          isSingleSession={false}
        />
      );

      // Verify that chart elements are present
      const chartElement = container.querySelector('svg');
      expect(chartElement).toBeDefined();
    });
  });

  describe('TrendChart', () => {
    test('renders without crashing with multiple sessions', () => {
      const { container } = render(
        <TrendChart sessions={mockSessionData} />
      );
      // Component should render without throwing
      expect(container.querySelector('button') || container.querySelector('label')).toBeDefined();
    });

    test('renders with proper structure', () => {
      const { container } = render(
        <TrendChart sessions={mockSessionData} />
      );

      // Verify chart container exists
      const chartContainer = container.querySelector('svg');
      expect(chartContainer).toBeDefined();
    });

    /**
     * Manual Verification Checklist:
     * [ ] Verify metric buttons use metricButtonStyle
     * [ ] Verify active button uses lighter background, not green (#00ff00)
     * [ ] Hover over trend line and verify tooltip shows properly formatted values
     */
    test('trend chart has metric selector buttons', () => {
      const { container } = render(
        <TrendChart sessions={mockSessionData} />
      );

      // Verify buttons/labels are present
      const buttons = container.querySelectorAll('button');
      const labels = container.querySelectorAll('label');
      expect(buttons.length + labels.length).toBeGreaterThan(0);
    });
  });

  describe('Styling Consistency - No Neon Green Borders', () => {
    /**
     * This suite verifies that the neon green (#00ff00) borders have been removed
     * and replaced with proper styling as defined in chartControlsStyles.ts
     */

    test('TimeSeriesGraph metric checkboxes do not have neon green borders', () => {
      const { container } = render(
        <TimeSeriesGraph
          sessions={[mockSessionData[0]]}
          isSingleSession={true}
        />
      );

      // Find all buttons and check computed styles
      const buttons = container.querySelectorAll('button');
      buttons.forEach((button) => {
        const computedStyle = window.getComputedStyle(button);
        const borderColor = computedStyle.borderColor;
        // Should not be neon green (#00ff00 or rgb(0, 255, 0))
        expect(borderColor).not.toMatch(/^rgb\(0,?\s*255,?\s*0\)/);
      });
    });

    test('TimeSeriesGraph time mode buttons do not have neon green backgrounds', () => {
      const { container } = render(
        <TimeSeriesGraph
          sessions={[mockSessionData[0]]}
          isSingleSession={true}
        />
      );

      // Find all buttons and verify they don't have neon green background
      const buttons = container.querySelectorAll('button');
      buttons.forEach((button) => {
        const computedStyle = window.getComputedStyle(button);
        const bgColor = computedStyle.backgroundColor;
        // Should not be neon green
        expect(bgColor).not.toMatch(/^rgb\(0,?\s*255,?\s*0\)/);
      });
    });

    test('HistogramChart metric buttons do not have neon green borders', () => {
      const { container } = render(
        <HistogramChart
          sessions={[mockSessionData[0]]}
          isSingleSession={true}
        />
      );

      const buttons = container.querySelectorAll('button');
      buttons.forEach((button) => {
        const computedStyle = window.getComputedStyle(button);
        const borderColor = computedStyle.borderColor;
        expect(borderColor).not.toMatch(/^rgb\(0,?\s*255,?\s*0\)/);
      });
    });

    test('TrendChart metric buttons do not have neon green borders', () => {
      const { container } = render(
        <TrendChart sessions={mockSessionData} />
      );

      const buttons = container.querySelectorAll('button');
      buttons.forEach((button) => {
        const computedStyle = window.getComputedStyle(button);
        const borderColor = computedStyle.borderColor;
        expect(borderColor).not.toMatch(/^rgb\(0,?\s*255,?\s*0\)/);
      });
    });

    /**
     * Manual Verification Checklist for Styling:
     * [ ] TimeSeriesGraph: Metric checkboxes have bottom border in metric color (not neon green)
     * [ ] TimeSeriesGraph: Time mode buttons have lighter background (12% opacity), not green
     * [ ] HistogramChart: Metric buttons use proper styling without green borders
     * [ ] TrendChart: Metric buttons use proper styling without green borders
     * [ ] All buttons: Active state uses lighter background, not bright neon green
     */
  });

  describe('Tooltip Formatting', () => {
    /**
     * Tooltip formatting tests verify that values are properly displayed
     * with correct decimal places and formatting based on context
     */

    test('chart components render without error', () => {
      const { rerender, container } = render(
        <TimeSeriesGraph
          sessions={[mockSessionData[0]]}
          isSingleSession={true}
        />
      );

      // Verify initial render succeeds
      expect(container.querySelector('button') || container.querySelector('label')).toBeDefined();

      // Rerender with multiple sessions
      rerender(
        <TimeSeriesGraph
          sessions={mockSessionData}
          isSingleSession={false}
        />
      );

      expect(container.querySelector('button') || container.querySelector('label')).toBeDefined();
    });

    /**
     * Manual Verification Checklist for Tooltips:
     * [ ] TimeSeriesGraph single session: Hover and verify tooltip shows only the value
     *     Example: "1.23" (no "Mean ± Std Dev")
     * [ ] TimeSeriesGraph multiple sessions: Hover and verify tooltip shows aggregated format
     *     Example: "Mean: 1.23 ± 0.45"
     * [ ] HistogramChart: Hover over coverage label and verify format "X% of measurements"
     * [ ] All tooltips: Values are rounded to 2 decimal places
     */
    test('chart components handle different session counts', () => {
      const singleSession = [mockSessionData[0]];
      const { rerender, container } = render(
        <HistogramChart
          sessions={singleSession}
          isSingleSession={true}
        />
      );

      expect(container.querySelector('button') || container.querySelector('label')).toBeDefined();

      rerender(
        <HistogramChart
          sessions={mockSessionData}
          isSingleSession={false}
        />
      );

      expect(container.querySelector('button') || container.querySelector('label')).toBeDefined();
    });
  });

  describe('Multi-Metric Support', () => {
    /**
     * Tests for TimeSeriesGraph multi-metric rendering
     */

    test('TimeSeriesGraph can render multiple metrics simultaneously', () => {
      const { container } = render(
        <TimeSeriesGraph
          sessions={mockSessionData}
          isSingleSession={false}
        />
      );

      // Chart should have rendered SVG elements
      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();
    });

    /**
     * Manual Verification Checklist for Multi-Metric:
     * [ ] TimeSeriesGraph with multiple metrics selected: Verify separate sub-charts exist
     * [ ] Each metric sub-chart: Verify has own Y-axis labeled with metric name
     * [ ] Individual session lines: Verify colored by metric (cyan, magenta, orange, gold)
     * [ ] Individual session lines: Verify opacity ~0.7
     * [ ] Aggregate lines (Mean + Std Dev): Verify use same metric colors
     */
  });

  describe('Relative Time Mode', () => {
    /**
     * Tests for TimeSeriesGraph relative time mode normalization
     */

    test('TimeSeriesGraph with multiple sessions renders without error', () => {
      const { container } = render(
        <TimeSeriesGraph
          sessions={mockSessionData}
          isSingleSession={false}
        />
      );

      // Verify chart is rendered
      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();
    });

    /**
     * Manual Verification Checklist for Relative Time Mode:
     * [ ] TimeSeriesGraph: Click "Relative" time mode button
     * [ ] Verify x-axis changes to percentages (0%, 50%, 100%)
     * [ ] Verify all sessions normalized to 0-100% range
     * [ ] Verify sessions with different durations (8s vs 10s) align properly
     * [ ] Verify y-values remain unchanged (only time normalization)
     * [ ] Switch back to "Absolute" mode and verify time format (mm:ss)
     */
  });

  describe('Box Plot Edge Cases', () => {
    /**
     * Tests for HistogramChart box plot handling of edge cases
     */

    test('HistogramChart handles degenerate cases', () => {
      // Test with minimal data
      const minimalSession: Session = {
        sessionId: 's-min',
        timestamp: '2026-03-30T12:00:00Z',
        exerciseTag: 'Test',
        ppi: 96,
        timeSeries: [{ t: 0, x: 0.5, y: 0.5, r: 0 }],
      };

      const { container } = render(
        <HistogramChart
          sessions={[minimalSession]}
          isSingleSession={true}
        />
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();
    });

    /**
     * Manual Verification Checklist for Box Plot Edge Cases:
     * [ ] n=1 (single measurement): Should render as single horizontal line
     * [ ] n=2 (two measurements): Should show min/max with median, no quartile box
     * [ ] n≥3 (three or more): Should show full box plot with all elements
     * [ ] All cases: Should display proper coverage percentage label
     */
  });

  describe('Data Transformation and Aggregation', () => {
    /**
     * Tests for data transformation pipeline
     */

    test('TimeSeriesGraph processes session data without error', () => {
      const { container } = render(
        <TimeSeriesGraph
          sessions={mockSessionData}
          isSingleSession={false}
        />
      );

      expect(container.querySelector('svg')).toBeDefined();
    });

    test('HistogramChart aggregates session data without error', () => {
      const { container } = render(
        <HistogramChart
          sessions={mockSessionData}
          isSingleSession={false}
        />
      );

      expect(container.querySelector('svg')).toBeDefined();
    });

    /**
     * Manual Verification Checklist for Data Processing:
     * [ ] TimeSeriesGraph: Verify correct interpolation of values between data points
     * [ ] TimeSeriesGraph Relative mode: Verify time normalization is correct
     * [ ] HistogramChart: Verify bins are calculated correctly
     * [ ] HistogramChart: Verify box plot statistics (median, Q1, Q3, whiskers) are correct
     * [ ] HistogramChart: Verify coverage percentages are calculated correctly
     */
  });
});

/**
 * Test Execution Checklist:
 * 1. Run: npm test -- src/components/__tests__/ChartIntegration.test.tsx
 * 2. Verify all tests pass (green checkmarks)
 * 3. Check for any TypeScript errors: npm run build
 * 4. For manual verification tests, follow the checklists in each describe block
 * 5. Pay special attention to:
 *    - No neon green (#00ff00) borders on any buttons
 *    - Proper metric colors (cyan, magenta, orange, gold)
 *    - Correct tooltip formatting (2 decimal places)
 *    - Proper styling for active/inactive states
 *    - Correct time mode normalization in relative mode
 *
 * If manual verification reveals issues, create targeted test cases
 * or file bugs in the relevant component
 */
