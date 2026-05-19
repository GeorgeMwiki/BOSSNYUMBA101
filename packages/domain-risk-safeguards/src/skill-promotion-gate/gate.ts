/**
 * Skill-promotion HARD gate.
 *
 * K-C ships the Voyager-style skill curator: candidate skills are
 * proposed by the brain, and after evidence accumulates they become
 * "active". The Voyager-runaway risk (OWASP LLM06 — excessive agency)
 * is auto-promotion. This module enforces a HARD human-in-the-loop gate.
 *
 * Promotion REQUIRES the conjunction of three conditions:
 *   1. ≥ 10 successful runs
 *   2. 0 catastrophic failures
 *   3. Owner feedback is `positive` (or scope is platform AND no
 *      negative feedback from any tenant)
 *
 * AND a matching human approval:
 *   - Platform-scoped skill → `platform-admin` approver.
 *   - Tenant-scoped skill   → `tenant-owner` approver (matching tenantId).
 *
 * Demotion side: any skill with > 3 catastrophic failures auto-quarantines.
 * This pairs with K-C's existing quarantine engine; this module returns the
 * `quarantine` verdict so K-C / the orchestrator can act on it.
 *
 * The gate is HARD — no auto-promotion regardless of metrics.
 */

import type {
  SkillPromotionApproval,
  SkillPromotionApprovalPort,
  SkillPromotionCandidate,
  SkillPromotionVerdict,
} from '../types.js';

const REQUIRED_SUCCESSFUL_RUNS = 10;
const MAX_CATASTROPHIC_FAILURES_FOR_PROMOTION = 0;
const QUARANTINE_THRESHOLD = 3;

/**
 * Evaluate a skill-promotion candidate.
 *
 * Returns a verdict — consumers must inspect `verdict.kind` and act:
 *   - `approve`   → call K-C `promote(skillId)` and write audit record
 *   - `deny-*`    → log + surface to proposer; do nothing else
 *   - `quarantine`→ call K-C `quarantine(skillId)` immediately
 */
export async function evaluateSkillPromotion(
  args: {
    readonly candidate: SkillPromotionCandidate;
    readonly approvals: SkillPromotionApprovalPort;
  },
): Promise<SkillPromotionVerdict> {
  const { candidate, approvals } = args;

  // 1) Hard quarantine check fires FIRST — overrides everything else.
  if (candidate.catastrophicFailures > QUARANTINE_THRESHOLD) {
    return Object.freeze({
      kind: 'quarantine',
      skillId: candidate.skillId,
      reason: `Catastrophic failures (${candidate.catastrophicFailures}) exceed threshold ${QUARANTINE_THRESHOLD}. Auto-quarantine.`,
    });
  }

  // 2) Metric-threshold gate.
  if (candidate.successfulRuns < REQUIRED_SUCCESSFUL_RUNS) {
    return Object.freeze({
      kind: 'deny-metric-threshold',
      skillId: candidate.skillId,
      reason: `Successful runs ${candidate.successfulRuns} < required ${REQUIRED_SUCCESSFUL_RUNS}.`,
    });
  }
  if (candidate.catastrophicFailures > MAX_CATASTROPHIC_FAILURES_FOR_PROMOTION) {
    return Object.freeze({
      kind: 'deny-metric-threshold',
      skillId: candidate.skillId,
      reason: `Catastrophic failures ${candidate.catastrophicFailures} > allowed ${MAX_CATASTROPHIC_FAILURES_FOR_PROMOTION}.`,
    });
  }
  if (candidate.ownerFeedback === 'negative') {
    return Object.freeze({
      kind: 'deny-metric-threshold',
      skillId: candidate.skillId,
      reason: 'Owner feedback is `negative` — promotion blocked.',
    });
  }
  if (candidate.ownerFeedback === 'none' && candidate.scope === 'tenant') {
    return Object.freeze({
      kind: 'deny-metric-threshold',
      skillId: candidate.skillId,
      reason: 'Tenant-scoped skill requires explicit owner feedback before promotion.',
    });
  }

  // 3) Human approval lookup.
  const approval = await approvals.findApproval({
    skillId: candidate.skillId,
    proposedAt: candidate.proposedAt,
  });

  if (approval === null) {
    return Object.freeze({
      kind: 'deny-missing-human-approval',
      skillId: candidate.skillId,
      reason: 'No human approval found. Skill-promotion is a HARD human-in-loop gate (L3 #10, OWASP LLM06).',
    });
  }

  // 4) Scope match.
  const scopeMatches = checkScopeMatch(candidate, approval);
  if (!scopeMatches.ok) {
    return Object.freeze({
      kind: 'deny-scope-mismatch',
      skillId: candidate.skillId,
      reason: scopeMatches.reason,
    });
  }

  return Object.freeze({
    kind: 'approve',
    skillId: candidate.skillId,
    approval,
  });
}

function checkScopeMatch(
  candidate: SkillPromotionCandidate,
  approval: SkillPromotionApproval,
): { ok: true } | { ok: false; reason: string } {
  if (candidate.scope === 'platform') {
    if (approval.approverRole !== 'platform-admin') {
      return {
        ok: false,
        reason: `Platform-scoped skill requires platform-admin approver, got ${approval.approverRole}.`,
      };
    }
    return { ok: true };
  }
  // candidate.scope === 'tenant'
  if (approval.approverRole !== 'tenant-owner') {
    return {
      ok: false,
      reason: `Tenant-scoped skill requires tenant-owner approver, got ${approval.approverRole}.`,
    };
  }
  if (approval.approverScope !== 'tenant') {
    return {
      ok: false,
      reason: `Tenant-scoped skill requires tenant approver-scope, got ${approval.approverScope}.`,
    };
  }
  return { ok: true };
}
