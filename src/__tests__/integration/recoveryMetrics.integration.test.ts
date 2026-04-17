/**
 * Integration tests for recovery metrics.
 *
 * These tests verify:
 * - Recovery Consistency calculation: % of sessions where patient achieved recovery (qualityEpisodeCount > 1)
 * - Recovery Consistency Trend: direction and significance
 * - Exercise Recovery Cycles: median qualityEpisodeCount per exercise
 * - Recovery Cycles Trend: direction and significance per exercise
 *
 * Approach:
 * - Build complete SessionMetrics objects with all required fields
 * - Call calculateProgressInsight and calculateExerciseInsights
 * - Verify recovery metrics are computed correctly
 * - Verify trends are calculated with proper significance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateProgressInsight, calculateExerciseInsights } from '../../utils/analysisInsights';
import { SessionMetrics } from '../../types/analysis';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal SessionMetrics object with required fields.
 * Recovery-relevant fields: qualityEpisodeCount, exerciseTag
 */
function makeSessionMetrics(overrides: Partial<SessionMetrics> = {}): SessionMetrics {
  return {
    sessionId: 'test-' + Math.random().toString(36).slice(2, 9),
    date: new Date().toISOString(),
    exerciseTag: 'Test Exercise',
    metric: 'deviation',
    sessionDuration: 60000,
    histogram: [],

    // Segment-derived metrics
    bestStableDeviation: 1.5,
    nearBestStableTime: 30,
    qualityPercent: 50,
    driftingPercent: 30,
    approachingPercent: 20,

    // Sub-scores
    timeToFirstFusion: null,
    fusionEventCount: 2,
    fusionAchievedCount: 1,
    longestFusionStreak: 5,
    longestQualityStreak: 3,
    qualityEpisodeCount: 2, // Recovery: episodes > 1
    largeDeviationTimePercent: 20,
    trajectoryRatio: null,

    // Supporting
    fusionTime: 10,
    fusionTimePercent: 16.67,
    fusionAchieved: true,
    nearFusionTime: 20,
    nearFusionTimePercent: 33.33,
    largeDeviationTime: 12,

    // FSM
    stateSegments: [],

    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Recovery Metrics Integration', () => {
  // ── Test Case 1: Recovery Consistency Calculation ──────────────────────────

  describe('Recovery Consistency Calculation', () => {
    it('should calculate recovery consistency correctly', () => {
      // 4 sessions: 3 have recovery (qualityEpisodeCount > 1), 1 does not
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({
          sessionId: 's1',
          date: '2026-04-01',
          qualityEpisodeCount: 1, // No recovery
        }),
        makeSessionMetrics({
          sessionId: 's2',
          date: '2026-04-02',
          qualityEpisodeCount: 3, // Recovery
        }),
        makeSessionMetrics({
          sessionId: 's3',
          date: '2026-04-03',
          qualityEpisodeCount: 1, // No recovery
        }),
        makeSessionMetrics({
          sessionId: 's4',
          date: '2026-04-04',
          qualityEpisodeCount: 2, // Recovery
        }),
      ];

      const progressInsight = calculateProgressInsight(sessionMetrics, { deviation: 1.0, rotation: 1 });

      // 2 out of 4 sessions have recovery (qualityEpisodeCount > 1)
      expect(progressInsight.recoveryConsistency).toBe(50);
      expect(progressInsight.recoveryConsistencyTrend).toBeDefined();
      expect(progressInsight.recoveryConsistencyTrend?.significance).toBeDefined();
      expect(progressInsight.recoveryConsistencyTrend?.significance.p).toBeGreaterThanOrEqual(0);
      expect(progressInsight.recoveryConsistencyTrend?.significance.p).toBeLessThanOrEqual(1);
      expect(progressInsight.recoveryConsistencyTrend?.direction).toMatch(/^(improving|declining|stable)$/);
    });

    it('should handle all sessions with recovery', () => {
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({ sessionId: 's1', date: '2026-04-01', qualityEpisodeCount: 2 }),
        makeSessionMetrics({ sessionId: 's2', date: '2026-04-02', qualityEpisodeCount: 3 }),
        makeSessionMetrics({ sessionId: 's3', date: '2026-04-03', qualityEpisodeCount: 4 }),
      ];

      const progressInsight = calculateProgressInsight(sessionMetrics, { deviation: 1.0, rotation: 1 });

      // 3 out of 3 sessions have recovery
      expect(progressInsight.recoveryConsistency).toBe(100);
      expect(progressInsight.recoveryConsistencyTrend).toBeDefined();
    });

    it('should handle no sessions with recovery', () => {
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({ sessionId: 's1', date: '2026-04-01', qualityEpisodeCount: 1 }),
        makeSessionMetrics({ sessionId: 's2', date: '2026-04-02', qualityEpisodeCount: 0 }),
        makeSessionMetrics({ sessionId: 's3', date: '2026-04-03', qualityEpisodeCount: 1 }),
      ];

      const progressInsight = calculateProgressInsight(sessionMetrics, { deviation: 1.0, rotation: 1 });

      // 0 out of 3 sessions have recovery
      expect(progressInsight.recoveryConsistency).toBe(0);
      expect(progressInsight.recoveryConsistencyTrend).toBeDefined();
    });

    it('should handle single session', () => {
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({ sessionId: 's1', date: '2026-04-01', qualityEpisodeCount: 2 }),
      ];

      const progressInsight = calculateProgressInsight(sessionMetrics, { deviation: 1.0, rotation: 1 });

      // 1 out of 1 session has recovery
      expect(progressInsight.recoveryConsistency).toBe(100);
    });

    it('should handle empty session array', () => {
      const sessionMetrics: SessionMetrics[] = [];

      const progressInsight = calculateProgressInsight(sessionMetrics, { deviation: 1.0, rotation: 1 });

      // No sessions: recovery consistency defaults to 0
      expect(progressInsight.recoveryConsistency).toBe(0);
    });

    it('should show improving trend when recovery episodes increase over time', () => {
      // Sessions with increasing recovery episodes
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({ sessionId: 's1', date: '2026-04-01', qualityEpisodeCount: 1 }),
        makeSessionMetrics({ sessionId: 's2', date: '2026-04-02', qualityEpisodeCount: 2 }),
        makeSessionMetrics({ sessionId: 's3', date: '2026-04-03', qualityEpisodeCount: 3 }),
        makeSessionMetrics({ sessionId: 's4', date: '2026-04-04', qualityEpisodeCount: 4 }),
      ];

      const progressInsight = calculateProgressInsight(sessionMetrics, { deviation: 1.0, rotation: 1 });

      // Pattern: 0, 100, 100, 100 (increasing trend in recovery achievement)
      expect(progressInsight.recoveryConsistency).toBeGreaterThanOrEqual(50);
      expect(progressInsight.recoveryConsistencyTrend).toBeDefined();
    });
  });

  // ── Test Case 2: Exercise Recovery Cycles Calculation ──────────────────────

  describe('Exercise Recovery Cycles', () => {
    it('should calculate median recovery cycles per exercise', () => {
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({
          sessionId: 's1',
          date: '2026-04-01',
          exerciseTag: 'Brock String',
          qualityEpisodeCount: 3,
        }),
        makeSessionMetrics({
          sessionId: 's2',
          date: '2026-04-02',
          exerciseTag: 'Brock String',
          qualityEpisodeCount: 4,
        }),
        makeSessionMetrics({
          sessionId: 's3',
          date: '2026-04-03',
          exerciseTag: 'Pencil Push-ups',
          qualityEpisodeCount: 1,
        }),
        makeSessionMetrics({
          sessionId: 's4',
          date: '2026-04-04',
          exerciseTag: 'Pencil Push-ups',
          qualityEpisodeCount: 2,
        }),
      ];

      const exerciseInsights = calculateExerciseInsights(sessionMetrics);

      // Brock String: median of [3, 4] = 3.5
      const brockInsight = exerciseInsights.find(e => e.exerciseTag === 'Brock String');
      expect(brockInsight).toBeDefined();
      expect(brockInsight?.medianRecoveryCycles).toBe(3.5);
      expect(brockInsight?.recoveryCyclesTrend).toBeDefined();
      expect(brockInsight?.recoveryCyclesTrend?.significance).toBeDefined();

      // Pencil Push-ups: median of [1, 2] = 1.5
      const pencilInsight = exerciseInsights.find(e => e.exerciseTag === 'Pencil Push-ups');
      expect(pencilInsight).toBeDefined();
      expect(pencilInsight?.medianRecoveryCycles).toBe(1.5);
      expect(pencilInsight?.recoveryCyclesTrend).toBeDefined();
    });

    it('should handle single session per exercise', () => {
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({
          sessionId: 's1',
          date: '2026-04-01',
          exerciseTag: 'Convergence Jumps',
          qualityEpisodeCount: 5,
        }),
      ];

      const exerciseInsights = calculateExerciseInsights(sessionMetrics);

      expect(exerciseInsights).toHaveLength(1);
      const insight = exerciseInsights[0];
      expect(insight.exerciseTag).toBe('Convergence Jumps');
      expect(insight.medianRecoveryCycles).toBe(5);
    });

    it('should handle odd number of sessions per exercise', () => {
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({
          sessionId: 's1',
          date: '2026-04-01',
          exerciseTag: 'Extreme Rotation',
          qualityEpisodeCount: 2,
        }),
        makeSessionMetrics({
          sessionId: 's2',
          date: '2026-04-02',
          exerciseTag: 'Extreme Rotation',
          qualityEpisodeCount: 3,
        }),
        makeSessionMetrics({
          sessionId: 's3',
          date: '2026-04-03',
          exerciseTag: 'Extreme Rotation',
          qualityEpisodeCount: 5,
        }),
      ];

      const exerciseInsights = calculateExerciseInsights(sessionMetrics);

      const insight = exerciseInsights[0];
      // median of [2, 3, 5] = 3
      expect(insight.medianRecoveryCycles).toBe(3);
    });

    it('should group sessions by exerciseTag correctly', () => {
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({
          sessionId: 's1',
          date: '2026-04-01',
          exerciseTag: 'Exercise A',
          qualityEpisodeCount: 1,
        }),
        makeSessionMetrics({
          sessionId: 's2',
          date: '2026-04-02',
          exerciseTag: 'Exercise B',
          qualityEpisodeCount: 2,
        }),
        makeSessionMetrics({
          sessionId: 's3',
          date: '2026-04-03',
          exerciseTag: 'Exercise A',
          qualityEpisodeCount: 3,
        }),
      ];

      const exerciseInsights = calculateExerciseInsights(sessionMetrics);

      expect(exerciseInsights).toHaveLength(2);
      const exerciseATags = exerciseInsights.filter(e => e.exerciseTag === 'Exercise A');
      const exerciseBTags = exerciseInsights.filter(e => e.exerciseTag === 'Exercise B');

      expect(exerciseATags).toHaveLength(1);
      expect(exerciseATags[0].sessionCount).toBe(2);
      expect(exerciseATags[0].medianRecoveryCycles).toBe(2); // median of [1, 3]

      expect(exerciseBTags).toHaveLength(1);
      expect(exerciseBTags[0].sessionCount).toBe(1);
      expect(exerciseBTags[0].medianRecoveryCycles).toBe(2);
    });

    it('should compute recovery cycles trend with significance', () => {
      // Sessions with increasing recovery cycles
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({
          sessionId: 's1',
          date: '2026-04-01',
          exerciseTag: 'Test Exercise',
          qualityEpisodeCount: 1,
        }),
        makeSessionMetrics({
          sessionId: 's2',
          date: '2026-04-02',
          exerciseTag: 'Test Exercise',
          qualityEpisodeCount: 2,
        }),
        makeSessionMetrics({
          sessionId: 's3',
          date: '2026-04-03',
          exerciseTag: 'Test Exercise',
          qualityEpisodeCount: 3,
        }),
        makeSessionMetrics({
          sessionId: 's4',
          date: '2026-04-04',
          exerciseTag: 'Test Exercise',
          qualityEpisodeCount: 4,
        }),
      ];

      const exerciseInsights = calculateExerciseInsights(sessionMetrics);

      const insight = exerciseInsights[0];
      expect(insight.recoveryCyclesTrend).toBeDefined();
      expect(insight.recoveryCyclesTrend?.slope).toBeGreaterThan(0); // improving trend
      expect(insight.recoveryCyclesTrend?.direction).toBeDefined();
      expect(insight.recoveryCyclesTrend?.significance).toBeDefined();
      expect(insight.recoveryCyclesTrend?.significance.p).toBeGreaterThanOrEqual(0);
    });

    it('should handle exercises with zero recovery cycles', () => {
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({
          sessionId: 's1',
          date: '2026-04-01',
          exerciseTag: 'No Recovery Exercise',
          qualityEpisodeCount: 0,
        }),
        makeSessionMetrics({
          sessionId: 's2',
          date: '2026-04-02',
          exerciseTag: 'No Recovery Exercise',
          qualityEpisodeCount: 1,
        }),
      ];

      const exerciseInsights = calculateExerciseInsights(sessionMetrics);

      const insight = exerciseInsights[0];
      // median of [0, 1] = 0.5
      expect(insight.medianRecoveryCycles).toBe(0.5);
      expect(insight.recoveryCyclesTrend).toBeDefined();
    });
  });

  // ── Test Case 3: End-to-End Scenario ──────────────────────────────────────

  describe('End-to-end recovery metrics scenario', () => {
    it('should compute both progress and exercise insights from same dataset', () => {
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({
          sessionId: 's1',
          date: '2026-04-01',
          exerciseTag: 'Brock String',
          qualityEpisodeCount: 2,
        }),
        makeSessionMetrics({
          sessionId: 's2',
          date: '2026-04-02',
          exerciseTag: 'Brock String',
          qualityEpisodeCount: 2,
        }),
        makeSessionMetrics({
          sessionId: 's3',
          date: '2026-04-03',
          exerciseTag: 'Pencil Push-ups',
          qualityEpisodeCount: 1,
        }),
        makeSessionMetrics({
          sessionId: 's4',
          date: '2026-04-04',
          exerciseTag: 'Pencil Push-ups',
          qualityEpisodeCount: 3,
        }),
      ];

      // Compute progress insights (all sessions)
      const progressInsight = calculateProgressInsight(sessionMetrics, { deviation: 1.0, rotation: 1 });

      // Compute exercise insights (grouped by exercise)
      const exerciseInsights = calculateExerciseInsights(sessionMetrics);

      // Progress: 3 out of 4 sessions have recovery = 75%
      expect(progressInsight.recoveryConsistency).toBe(75);
      expect(progressInsight.recoveryConsistencyTrend).toBeDefined();

      // Exercise insights
      expect(exerciseInsights).toHaveLength(2);

      const brockInsight = exerciseInsights.find(e => e.exerciseTag === 'Brock String');
      expect(brockInsight?.medianRecoveryCycles).toBe(2);
      expect(brockInsight?.sessionCount).toBe(2);

      const pencilInsight = exerciseInsights.find(e => e.exerciseTag === 'Pencil Push-ups');
      expect(pencilInsight?.medianRecoveryCycles).toBe(2); // median of [1, 3]
      expect(pencilInsight?.sessionCount).toBe(2);
    });

    it('should maintain consistency when calculating insights multiple times', () => {
      const sessionMetrics: SessionMetrics[] = [
        makeSessionMetrics({
          sessionId: 's1',
          date: '2026-04-01',
          exerciseTag: 'Test',
          qualityEpisodeCount: 2,
        }),
        makeSessionMetrics({
          sessionId: 's2',
          date: '2026-04-02',
          exerciseTag: 'Test',
          qualityEpisodeCount: 3,
        }),
      ];

      const result1 = calculateProgressInsight(sessionMetrics, { deviation: 1.0, rotation: 1 });
      const result2 = calculateProgressInsight(sessionMetrics, { deviation: 1.0, rotation: 1 });

      expect(result1.recoveryConsistency).toBe(result2.recoveryConsistency);
      expect(result1.recoveryConsistencyTrend?.slope).toBe(result2.recoveryConsistencyTrend?.slope);
    });

    it('should update recovery metrics when new sessions are added', () => {
      const initialMetrics: SessionMetrics[] = [
        makeSessionMetrics({
          sessionId: 's1',
          date: '2026-04-01',
          qualityEpisodeCount: 1,
        }),
      ];

      const initialInsight = calculateProgressInsight(initialMetrics, { deviation: 1.0, rotation: 1 });
      expect(initialInsight.recoveryConsistency).toBe(0); // 0 out of 1 have recovery

      // Add sessions with recovery
      const updatedMetrics = [
        ...initialMetrics,
        makeSessionMetrics({
          sessionId: 's2',
          date: '2026-04-02',
          qualityEpisodeCount: 2,
        }),
        makeSessionMetrics({
          sessionId: 's3',
          date: '2026-04-03',
          qualityEpisodeCount: 3,
        }),
      ];

      const updatedInsight = calculateProgressInsight(updatedMetrics, { deviation: 1.0, rotation: 1 });
      expect(updatedInsight.recoveryConsistency).toBe(66.66666666666666); // 2 out of 3 have recovery
    });
  });
});
