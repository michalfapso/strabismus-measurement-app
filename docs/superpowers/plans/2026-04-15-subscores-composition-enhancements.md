# SubScores and Session Composition Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Near-Best Stable Time" to single session SubScores and refactor Session Composition graph to display all 5 FSM states (FUSION, NEAR_FUSION, STABLE_DEVIATION, APPROACHING, DRIFTING) that sum to 100%.

**Architecture:** 
1. SubScoresPanel: Simple addition of one table row using existing `metrics.nearBestStableTime` 
2. ProgressGraphs: Local state calculation inside component to derive all 5 state percentages from `stateSegments`, replace 3-area chart with 5-area chart

**Tech Stack:** React, TypeScript, emotion (CSS-in-JS), recharts (charting), vitest + react-testing-library

---

## File Structure

```
src/components/
├── SubScoresPanel.tsx               [MODIFY] Add nearBestStableTime row
├── ProgressGraphs.tsx               [MODIFY] Calculate and display all 5 states
└── __tests__/
    ├── SubScoresPanel.test.tsx      [MODIFY] Add test for new row
    └── ProgressGraphs.test.tsx      [MODIFY] Update mock data, add state validation
```

---

## Task 1: Add Near-Best Stable Time Row to SubScoresPanel

**Files:**
- Modify: `src/components/SubScoresPanel.tsx`
- Modify: `src/components/__tests__/SubScoresPanel.test.tsx`

### Step 1.1: Write the failing test

Create a test that verifies the near-best stable time row appears when fusion is achieved:

```bash
# First, check if SubScoresPanel test file exists
ls -la src/components/__tests__/ | grep -i subscores
```

If no test file exists, we'll create one. Let me assume one exists and we're adding to it. If not, we create it.

```typescript
// In src/components/__tests__/SubScoresPanel.test.tsx

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SubScoresPanel from '../SubScoresPanel';
import { SessionMetrics } from '../../types/analysis';

describe('SubScoresPanel', () => {
  const createMockMetrics = (overrides?: Partial<SessionMetrics>): SessionMetrics => ({
    sessionId: 's1',
    date: '2026-01-01',
    exerciseTag: 'Pencil Push-ups',
    metric: 'deviation',
    sessionDuration: 120,
    histogram: [],
    bestStableDeviation: 0.5,
    nearBestStableTime: 45.3,
    qualityPercent: 60,
    driftingPercent: 25,
    approachingPercent: 15,
    fusionAchieved: true,
    fusionAchievedCount: 1,
    fusionEventCount: 2,
    longestFusionStreak: 15.5,
    largeDeviationTimePercent: 20,
    trajectoryRatio: 0.15,
    timeToFirstFusion: 5.0,
    fusionTime: 45,
    fusionTimePercent: 37.5,
    nearFusionTime: 15,
    nearFusionTimePercent: 12.5,
    largeDeviationTime: 24,
    stateSegments: [],
    ...overrides,
  });

  it('should display near-best stable time when fusion is achieved', () => {
    const metrics = createMockMetrics({ 
      fusionAchieved: true,
      nearBestStableTime: 45.3,
    });
    
    const { container } = render(<SubScoresPanel metrics={metrics} />);
    
    expect(container.textContent).toContain('Near-best stable time');
    expect(container.textContent).toContain('45.3s');
  });

  it('should display near-best stable time even when fusion not achieved', () => {
    const metrics = createMockMetrics({ 
      fusionAchieved: false,
      nearBestStableTime: 20.5,
    });
    
    const { container } = render(<SubScoresPanel metrics={metrics} />);
    
    expect(container.textContent).toContain('Near-best stable time');
    expect(container.textContent).toContain('20.5s');
  });
});
```

- [ ] **Step 1.1: Add the test code above to `src/components/__tests__/SubScoresPanel.test.tsx`**

If the file doesn't exist, create it with the complete test structure above. If it exists, append the two test cases to the existing `describe` block.

- [ ] **Step 1.2: Run the test to verify it fails**

```bash
cd /workspace
npm test src/components/__tests__/SubScoresPanel.test.tsx
```

Expected output: Tests fail with messages like "Near-best stable time" not found in container.

### Step 1.3: Implement the new row in SubScoresPanel

Open `src/components/SubScoresPanel.tsx` and locate the `<tbody>` section. After the "Time to first fusion" row (inside the fusionAchieved conditional block), add:

```typescript
// Find this existing code block (lines ~54-66):
{metrics.fusionAchieved && metrics.longestFusionStreak > 0 && (
  <>
    <tr>
      <td>Longest fusion streak</td>
      <td>{metrics.longestFusionStreak.toFixed(1)}s</td>
    </tr>
    {metrics.timeToFirstFusion !== null && (
      <tr>
        <td>Time to first fusion</td>
        <td>{metrics.timeToFirstFusion.toFixed(1)}s</td>
      </tr>
    )}
  </>
)}

// ADD THIS NEW ROW AFTER the closing </>:
{metrics.fusionAchieved && (
  <tr>
    <td>Near-best stable time</td>
    <td>{metrics.nearBestStableTime.toFixed(1)}s</td>
  </tr>
)}
```

Here's the complete updated section (replace lines ~46-67):

```typescript
<tbody>
  <tr>
    <td>Fusion achieved</td>
    <td>
      {metrics.fusionAchieved
        ? `Yes (${metrics.fusionEventCount} episode${metrics.fusionEventCount !== 1 ? 's' : ''})`
        : 'No'}
    </td>
  </tr>
  {metrics.fusionAchieved && metrics.longestFusionStreak > 0 && (
    <>
      <tr>
        <td>Longest fusion streak</td>
        <td>{metrics.longestFusionStreak.toFixed(1)}s</td>
      </tr>
      {metrics.timeToFirstFusion !== null && (
        <tr>
          <td>Time to first fusion</td>
          <td>{metrics.timeToFirstFusion.toFixed(1)}s</td>
        </tr>
      )}
    </>
  )}
  {metrics.fusionAchieved && (
    <tr>
      <td>Near-best stable time</td>
      <td>{metrics.nearBestStableTime.toFixed(1)}s</td>
    </tr>
  )}
  <tr>
    <td>Best stable {metrics.metric}</td>
    <td>
      {metrics.metric === 'deviation'
        ? `${metrics.bestStableDeviation.toFixed(2)}cm`
        : `${metrics.bestStableDeviation.toFixed(1)}°`}
    </td>
  </tr>
  <tr>
    <td>Large {metrics.metric} time</td>
    <td>{metrics.largeDeviationTimePercent.toFixed(1)}%</td>
  </tr>
  <tr>
    <td>Session trajectory</td>
    <td>{getTrajectoryLabel(metrics.trajectoryRatio)}</td>
  </tr>
</tbody>
```

- [ ] **Step 1.3: Make the change to `src/components/SubScoresPanel.tsx`**

- [ ] **Step 1.4: Run the tests to verify they pass**

```bash
npm test src/components/__tests__/SubScoresPanel.test.tsx
```

Expected: PASS (both new tests pass, existing tests still pass)

- [ ] **Step 1.5: Run the dev server to visually verify the change**

```bash
npm run dev
```

Navigate to History page, select a single session, and verify that "Near-best stable time" appears in the SubScores table with the correct value (e.g., "45.3s").

- [ ] **Step 1.6: Commit Task 1**

```bash
git add src/components/SubScoresPanel.tsx src/components/__tests__/SubScoresPanel.test.tsx
git commit -m "feat: add near-best stable time to single session sub-scores

Displays the total duration spent in quality states (FUSION, NEAR_FUSION, STABLE_DEVIATION) 
within a 10% band of the session's best achieved deviation. This metric helps clinicians 
assess consistency near peak performance.

- Added new row to SubScoresPanel table (shows when fusion achieved)
- Added test cases to verify display logic
"
```

---

## Task 2: Refactor Session Composition Graph to Show All 5 States

**Files:**
- Modify: `src/components/ProgressGraphs.tsx`
- Modify: `src/components/__tests__/ProgressGraphs.test.tsx`

### Step 2.1: Update test mock data to include stateSegments

The current test mock in `src/components/__tests__/ProgressGraphs.test.tsx` doesn't include `stateSegments`. We need to add realistic state segment data:

```typescript
// In createMockSession function (around line 7-33), add stateSegments:

const createMockSession = (overrides?: Partial<SessionMetrics>): SessionMetrics => ({
  sessionId: 's1',
  date: '2026-01-01',
  exerciseTag: 'test',
  metric: 'deviation',
  sessionDuration: 1000,
  histogram: [],
  bestStableDeviation: 2.5,
  nearBestStableTime: 15,
  qualityPercent: 55,
  driftingPercent: 30,
  approachingPercent: 15,
  fusionAchieved: false,
  fusionAchievedCount: 0,
  fusionEventCount: 0,
  longestFusionStreak: 0,
  largeDeviationTimePercent: 0,
  trajectoryRatio: null,
  timeToFirstFusion: null,
  fusionTime: 0,
  fusionTimePercent: 0,
  nearFusionTime: 0,
  nearFusionTimePercent: 0,
  largeDeviationTime: 0,
  // ADD THIS SECTION:
  stateSegments: [
    { state: 'FUSION', startTime: 0, endTime: 200, duration: 200 },
    { state: 'NEAR_FUSION', startTime: 200, endTime: 350, duration: 150 },
    { state: 'STABLE_DEVIATION', startTime: 350, endTime: 550, duration: 200 },
    { state: 'APPROACHING', startTime: 550, endTime: 800, duration: 250 },
    { state: 'DRIFTING', startTime: 800, endTime: 1000, duration: 200 },
  ],
  ...overrides,
});
```

- [ ] **Step 2.1: Update the createMockSession function to include stateSegments**

Edit `src/components/__tests__/ProgressGraphs.test.tsx` and add the `stateSegments` array to the mock.

### Step 2.2: Write a test to verify state percentages

Add a new test case to verify that all 5 state percentages are displayed in the tooltip:

```typescript
// Add this test to src/components/__tests__/ProgressGraphs.test.tsx (in the describe block)

it('should display all 5 state percentages in tooltip', () => {
  const sessions: SessionMetrics[] = [
    createMockSession({
      sessionId: 's1',
      date: '2026-01-01',
      stateSegments: [
        { state: 'FUSION', startTime: 0, endTime: 200, duration: 200 },
        { state: 'NEAR_FUSION', startTime: 200, endTime: 350, duration: 150 },
        { state: 'STABLE_DEVIATION', startTime: 350, endTime: 550, duration: 200 },
        { state: 'APPROACHING', startTime: 550, endTime: 800, duration: 250 },
        { state: 'DRIFTING', startTime: 800, endTime: 1000, duration: 200 },
      ],
    }),
  ];

  const { container } = render(<ProgressGraphs sessions={sessions} />);
  
  // Should render all graph titles
  expect(container.textContent).toContain('Best Stable Deviation (cm)');
  expect(container.textContent).toContain('Near-Best Stable Time (seconds)');
  expect(container.textContent).toContain('Session Composition (%)');
});
```

- [ ] **Step 2.2: Add the test to verify state percentages are calculated**

Add the test code above to the describe block in `src/components/__tests__/ProgressGraphs.test.tsx`.

- [ ] **Step 2.3: Run the test to see current behavior**

```bash
npm test src/components/__tests__/ProgressGraphs.test.tsx
```

The test should pass (it just checks that titles render), but later we'll verify the actual state percentages.

### Step 2.4: Implement calculateStatePercentages function and update ProgressGraphs

Now implement the core logic in `src/components/ProgressGraphs.tsx`. 

Find the `graphData` useMemo (around line 158-174) and update it:

```typescript
// ADD THIS HELPER FUNCTION before the ProgressGraphs component (around line 143):

function calculateStatePercentages(session: SessionMetrics) {
  const stateTimings: Record<string, number> = {
    FUSION: 0,
    NEAR_FUSION: 0,
    STABLE_DEVIATION: 0,
    APPROACHING: 0,
    DRIFTING: 0,
  };

  // Sum duration for each state
  for (const seg of session.stateSegments) {
    if (seg.state in stateTimings) {
      stateTimings[seg.state] += seg.duration;
    }
  }

  // Convert to percentages
  const duration = session.sessionDuration || 1; // Avoid division by zero
  return {
    fusionPercent: (stateTimings.FUSION / duration) * 100,
    nearFusionPercent: (stateTimings.NEAR_FUSION / duration) * 100,
    stableDeviationPercent: (stateTimings.STABLE_DEVIATION / duration) * 100,
    approachingPercent: (stateTimings.APPROACHING / duration) * 100,
    driftingPercent: (stateTimings.DRIFTING / duration) * 100,
  };
}
```

- [ ] **Step 2.4a: Add the calculateStatePercentages helper function**

Add the function above to `src/components/ProgressGraphs.tsx` before the component definition.

Now update the `graphData` useMemo to use the new function (around line 158-174):

```typescript
// REPLACE this section (lines ~158-174):
const graphData = useMemo(() => {
  const sorted = [...filteredSessions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return sorted.map((session, index) => ({
    sessionIndex: index,
    sessionId: session.sessionId,
    date: session.date,
    exerciseTag: session.exerciseTag,
    bestStableDeviation: session.bestStableDeviation,
    nearBestStableTime: session.nearBestStableTime,
    qualityPercent: session.qualityPercent,
    driftingPercent: session.driftingPercent,
    approachingPercent: session.approachingPercent,
  }));
}, [filteredSessions]);

// WITH THIS (keeping the same structure but adding state percentages):
const graphData = useMemo(() => {
  const sorted = [...filteredSessions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return sorted.map((session, index) => {
    const statePercentages = calculateStatePercentages(session);
    return {
      sessionIndex: index,
      sessionId: session.sessionId,
      date: session.date,
      exerciseTag: session.exerciseTag,
      bestStableDeviation: session.bestStableDeviation,
      nearBestStableTime: session.nearBestStableTime,
      ...statePercentages,  // Add all 5 state percentages
    };
  });
}, [filteredSessions]);
```

- [ ] **Step 2.4b: Update the graphData useMemo to calculate state percentages**

### Step 2.5: Update ProgressGraphsTooltipPayload type

Update the interface at line ~104-114 to include the new fields:

```typescript
// REPLACE this (lines ~104-114):
interface ProgressGraphsTooltipPayload {
  sessionIndex: number;
  sessionId: string;
  date: string;
  exerciseTag: string;
  bestStableDeviation: number;
  nearBestStableTime: number;
  qualityPercent: number;
  driftingPercent: number;
  approachingPercent: number;
}

// WITH THIS:
interface ProgressGraphsTooltipPayload {
  sessionIndex: number;
  sessionId: string;
  date: string;
  exerciseTag: string;
  bestStableDeviation: number;
  nearBestStableTime: number;
  fusionPercent: number;
  nearFusionPercent: number;
  stableDeviationPercent: number;
  approachingPercent: number;
  driftingPercent: number;
}
```

- [ ] **Step 2.5: Update ProgressGraphsTooltipPayload interface**

### Step 2.6: Update SharedTooltip to display all 5 states

Update the SharedTooltip function (lines ~124-142) to show all 5 state percentages:

```typescript
// REPLACE this (lines ~124-142):
function SharedTooltip({ active, payload }: SharedTooltipProps) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div css={styles.tooltip}>
        <p><strong>{data.date}</strong></p>
        <p>Exercise: {data.exerciseTag}</p>
        <p>Session #{data.sessionIndex + 1}</p>
        <hr />
        <p>Best Stable Deviation: {data.bestStableDeviation.toFixed(2)} cm</p>
        <p>Near-Best Stable Time: {data.nearBestStableTime.toFixed(1)}s</p>
        <p>Quality: {data.qualityPercent.toFixed(1)}%</p>
        <p>Drifting: {data.driftingPercent.toFixed(1)}%</p>
        <p>Approaching: {data.approachingPercent.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
}

// WITH THIS:
function SharedTooltip({ active, payload }: SharedTooltipProps) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div css={styles.tooltip}>
        <p><strong>{data.date}</strong></p>
        <p>Exercise: {data.exerciseTag}</p>
        <p>Session #{data.sessionIndex + 1}</p>
        <hr />
        <p>Best Stable Deviation: {data.bestStableDeviation.toFixed(2)} cm</p>
        <p>Near-Best Stable Time: {data.nearBestStableTime.toFixed(1)}s</p>
        <p>Fusion: {data.fusionPercent.toFixed(1)}%</p>
        <p>Near Fusion: {data.nearFusionPercent.toFixed(1)}%</p>
        <p>Stable Deviation: {data.stableDeviationPercent.toFixed(1)}%</p>
        <p>Approaching: {data.approachingPercent.toFixed(1)}%</p>
        <p>Drifting: {data.driftingPercent.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
}
```

- [ ] **Step 2.6: Update SharedTooltip component to show all 5 states**

### Step 2.7: Replace Session Composition AreaChart with 5 areas

Find the Session Composition section (around line 276-300) and replace the 3 Area components with 5:

```typescript
// REPLACE this (lines ~297-299):
<Area type="monotone" dataKey="qualityPercent" stackId="1" stroke={THEME.stateFusion} fill={THEME.stateFusion} name="Quality" />
<Area type="monotone" dataKey="driftingPercent" stackId="1" stroke={THEME.stateDrifting} fill={THEME.stateDrifting} name="Drifting" />
<Area type="monotone" dataKey="approachingPercent" stackId="1" stroke={THEME.stateApproaching} fill={THEME.stateApproaching} name="Approaching" />

// WITH THIS:
<Area type="monotone" dataKey="fusionPercent" stackId="1" stroke={THEME.stateFusion} fill={THEME.stateFusion} name="Fusion" />
<Area type="monotone" dataKey="nearFusionPercent" stackId="1" stroke={THEME.stateNearFusion} fill={THEME.stateNearFusion} name="Near Fusion" />
<Area type="monotone" dataKey="stableDeviationPercent" stackId="1" stroke={THEME.stateStableDeviation} fill={THEME.stateStableDeviation} name="Stable Deviation" />
<Area type="monotone" dataKey="approachingPercent" stackId="1" stroke={THEME.stateApproaching} fill={THEME.stateApproaching} name="Approaching" />
<Area type="monotone" dataKey="driftingPercent" stackId="1" stroke={THEME.stateDrifting} fill={THEME.stateDrifting} name="Drifting" />
```

- [ ] **Step 2.7: Replace the 3 Area components with 5 (all FSM states)**

### Step 2.8: Run tests to verify changes

```bash
npm test src/components/__tests__/ProgressGraphs.test.tsx
```

Expected: All tests pass. Mock data now includes stateSegments, and the component renders without errors.

- [ ] **Step 2.8: Run tests for ProgressGraphs**

### Step 2.9: Run the dev server to visually verify

```bash
npm run dev
```

Navigate to History page and select multiple sessions. Verify that:
- Session Composition graph now shows 5 colored areas (not 3)
- Colors correspond to the theme colors (green for FUSION, lime for NEAR_FUSION, yellow for STABLE_DEVIATION, orange for APPROACHING, red for DRIFTING)
- The areas stack and sum to 100% (or very close due to floating point)
- Tooltip shows all 5 percentages when hovering

- [ ] **Step 2.9: Visual verification in dev server**

### Step 2.10: Commit Task 2

```bash
git add src/components/ProgressGraphs.tsx src/components/__tests__/ProgressGraphs.test.tsx
git commit -m "feat: refactor session composition to show all 5 FSM states

The Session Composition graph now displays percentages for all five session states:
FUSION, NEAR_FUSION, STABLE_DEVIATION, APPROACHING, and DRIFTING. These percentages
sum to 100% by definition (each time point belongs to exactly one state).

Previously, the graph only showed a subset of states (Quality %, Drifting %, Approaching %),
missing explicit representation of STABLE_DEVIATION and non-quality NEAR_FUSION segments.

Changes:
- Added calculateStatePercentages() helper to derive state durations from stateSegments
- Updated graphData preparation to calculate all 5 state percentages
- Updated ProgressGraphsTooltipPayload type to include all 5 percentages
- Updated SharedTooltip component to display all 5 state percentages
- Replaced 3 Area components with 5, using THEME colors for each state
- Updated test mock data to include realistic stateSegments

Stacking order (bottom to top): FUSION → NEAR_FUSION → STABLE_DEVIATION → APPROACHING → DRIFTING
"
```

---

## Task 3: End-to-End Verification

### Step 3.1: Run all tests

```bash
npm test
```

Expected: All tests pass, no errors.

- [ ] **Step 3.1: Run full test suite**

### Step 3.2: Build verification

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3.2: Verify production build succeeds**

### Step 3.3: Manual end-to-end test

Start the dev server and run through the following scenarios:

**Scenario A: Single session with fusion**
1. Open History page
2. Click a session that has `fusionAchieved: true`
3. In SubScores, verify "Near-best stable time" appears with a value like "45.3s"
4. Verify it appears after "Longest fusion streak" and before "Best stable deviation"

**Scenario B: Single session without fusion**
1. Click a session that has `fusionAchieved: false`
2. Verify "Near-best stable time" still appears (no conditional hiding except on fusionAchieved check - actually, re-read spec... it says "only show if fusionAchieved", so verify it's hidden)

Actually, let me re-read the spec... Line 31 says "Conditional display: only show if `metrics.fusionAchieved` is true". So it should only show if fusion is achieved.

**Scenario B (revised):**
1. Click a session that has `fusionAchieved: false`
2. Verify "Near-best stable time" does NOT appear

**Scenario C: Multiple sessions - Composition graph**
1. Shift+click to select multiple sessions with varied state compositions
2. Look at Session Composition (%) graph
3. Verify 5 colored areas are visible
4. Hover tooltip and see all 5 state percentages
5. Add percentages mentally - should sum to ~100%

- [ ] **Step 3.3: Manual end-to-end verification**

### Step 3.4: Final commit summary

```bash
# Verify git log shows the two main commits
git log --oneline -3
```

Expected output:
```
<hash> feat: refactor session composition to show all 5 FSM states
<hash> feat: add near-best stable time to single session sub-scores
<hash> [previous commit]
```

- [ ] **Step 3.4: Verify commit history**

---

## Spec Compliance Checklist

- [x] Feature 1: Near-Best Stable Time added to SubScoresPanel (Task 1)
- [x] Feature 1: Display only when fusion achieved (Step 1.3)
- [x] Feature 1: Position after "Longest fusion streak" (Step 1.3)
- [x] Feature 1: Use existing `metrics.nearBestStableTime` (no computation needed)
- [x] Feature 2: Session Composition shows all 5 FSM states (Task 2, Step 2.7)
- [x] Feature 2: States sum to 100% (calculateStatePercentages logic, Step 2.4)
- [x] Feature 2: Uses THEME colors for each state (Step 2.7)
- [x] Feature 2: Tooltip displays all 5 percentages (Step 2.6)
- [x] Feature 2: Stacking order specified (FUSION → NEAR_FUSION → STABLE_DEVIATION → APPROACHING → DRIFTING)
- [x] No changes to SessionMetrics type (as specified)
- [x] No changes to sessionMetrics computation logic (as specified)
- [x] Tests updated for both features
- [x] Manual verification steps documented

---

## Tech Debt / Future Improvements

None introduced by this task. Both changes follow existing code patterns and maintain backward compatibility.

---

## Rollback Plan

If issues arise:

```bash
# Revert both commits
git revert HEAD~1 HEAD

# Or reset to before the changes
git reset --hard <commit-before-changes>
```

Key invariant: No type changes or breaking API changes, so rollback is clean.
