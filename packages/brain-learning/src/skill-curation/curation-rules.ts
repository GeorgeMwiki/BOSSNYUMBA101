/**
 * Auto-promotion + auto-quarantine rules for K-C Voyager skills.
 *
 * §5 R-LEARNING + N-E spec thresholds:
 *
 *   Promotion candidate iff:
 *     - successfulRuns ≥ 10
 *     - catastrophicFailures = 0
 *     - positiveFeedbackRatio ≥ 0.8
 *   STILL GATED BY M-F HARD HITL (skill-promotion-gate)
 *
 *   Quarantine candidate iff:
 *     - catastrophicFailures ≥ 3 (consecutive)  OR
 *     - confidenceTrend declining > 20% (i.e. trend < -0.2)
 *
 * Pure: stats in, proposed lifecycle out. No I/O.
 */

import type {
  SkillCurationStats,
  SkillCurationVerdict,
  SkillLifecycle,
} from '../types.js';

export const PROMOTION_MIN_RUNS = 10;
export const PROMOTION_MIN_FEEDBACK_RATIO = 0.8;
export const QUARANTINE_CATASTROPHIC_FAILURES = 3;
/** Confidence trend decline percentage (20%). */
export const QUARANTINE_CONFIDENCE_DROP_PCT = 0.2;

export interface SkillEvaluationInput {
  readonly skillId: string;
  readonly tenantId: string;
  readonly currentLifecycle: SkillLifecycle;
  readonly stats: SkillCurationStats;
}

/**
 * Apply the rules. Returns the proposed lifecycle and whether the
 * change requires M-F HITL approval.
 *
 * Decision order:
 *   1. Quarantine wins — catastrophic always quarantines.
 *   2. Confidence drop quarantines.
 *   3. Promotion candidate iff lifecycle == draft AND stats pass.
 *   4. Otherwise no change.
 */
export function evaluateSkill(
  input: SkillEvaluationInput,
): SkillCurationVerdict {
  const { stats, currentLifecycle } = input;

  // ── Quarantine: catastrophic failures ──
  if (stats.catastrophicFailures >= QUARANTINE_CATASTROPHIC_FAILURES) {
    return Object.freeze({
      skillId: input.skillId,
      tenantId: input.tenantId,
      currentLifecycle,
      proposedLifecycle: 'quarantined' as SkillLifecycle,
      reason: `≥ ${QUARANTINE_CATASTROPHIC_FAILURES} consecutive catastrophic failures (${stats.catastrophicFailures})`,
      gatedByHitl: false,
      stats,
    });
  }

  // ── Quarantine: confidence trend declining > 20% ──
  if (stats.confidenceTrend < -QUARANTINE_CONFIDENCE_DROP_PCT) {
    return Object.freeze({
      skillId: input.skillId,
      tenantId: input.tenantId,
      currentLifecycle,
      proposedLifecycle: 'quarantined' as SkillLifecycle,
      reason: `confidence trend declining ${(stats.confidenceTrend * 100).toFixed(1)}% (threshold -${QUARANTINE_CONFIDENCE_DROP_PCT * 100}%)`,
      gatedByHitl: false,
      stats,
    });
  }

  // ── Promotion candidate (draft → promoted) ──
  if (
    currentLifecycle === 'draft' &&
    stats.successfulRuns >= PROMOTION_MIN_RUNS &&
    stats.catastrophicFailures === 0 &&
    stats.positiveFeedbackRatio >= PROMOTION_MIN_FEEDBACK_RATIO
  ) {
    return Object.freeze({
      skillId: input.skillId,
      tenantId: input.tenantId,
      currentLifecycle,
      proposedLifecycle: 'promoted' as SkillLifecycle,
      reason: `≥${PROMOTION_MIN_RUNS} runs · 0 catastrophic · feedback ratio ${stats.positiveFeedbackRatio}`,
      gatedByHitl: true, // M-F HARD HITL — skill-promotion-gate
      stats,
    });
  }

  return Object.freeze({
    skillId: input.skillId,
    tenantId: input.tenantId,
    currentLifecycle,
    proposedLifecycle: currentLifecycle,
    reason: 'no lifecycle change required',
    gatedByHitl: false,
    stats,
  });
}
