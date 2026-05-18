/**
 * Cap evaluator — pure function answering "is this proposed action
 * within the tenant's autonomy envelope?"
 *
 * The evaluator is pure: no I/O, no clock, no mutation. State + cap +
 * action go in; a `CapVerdict` comes out. All side effects (loading the
 * cap, persisting the verdict to the sovereign-action-ledger) belong to
 * the kernel-side adapter that calls this.
 */

import type {
  AutonomyRollingState,
  CapVerdict,
  CapVerdictKind,
  ProposedAutonomousAction,
  TenantAutonomyCap,
} from '../types.js';

/**
 * Pure decision function. Caller passes the cap, the rolling state, and
 * the proposed action; gets back a verdict.
 *
 * Decision order:
 *   1. Tool-tier cap exact-zero — hard block.
 *   2. Per-sub-MD mutation/cost ceiling.
 *   3. Tenant-wide mutation/cost ceiling.
 *   4. Anything else — allow.
 *
 * Each ceiling check has two thresholds:
 *   - hardStopAt (e.g. 1.0) — `deny-cap-exceeded`
 *   - slowdownAt (e.g. 0.8) — `slowdown-ask-owner`
 */
export function evaluateAutonomyCap(
  cap: TenantAutonomyCap,
  proposedAction: ProposedAutonomousAction,
  rollingState: AutonomyRollingState,
): CapVerdict {
  if (cap.tenantId !== rollingState.tenantId) {
    return Object.freeze({
      kind: 'deny-cap-exceeded' satisfies CapVerdictKind,
      reason: `tenantId mismatch: cap=${cap.tenantId} state=${rollingState.tenantId}`,
      trippedEnvelope: null,
      headroomPct: 0,
    });
  }

  // ── 1. Per-tool-tier hard cap (e.g. destroy: 0) ──
  const tierCap = cap.perToolTierCaps[proposedAction.tier];
  if (tierCap === 0) {
    return Object.freeze({
      kind: 'deny-tier-blocked' satisfies CapVerdictKind,
      reason: `tier '${proposedAction.tier}' is hard-capped at 0`,
      trippedEnvelope: 'tool-tier',
      headroomPct: 0,
    });
  }
  if (typeof tierCap === 'number') {
    const used = rollingState.perToolTier[proposedAction.tier] ?? 0;
    if (used + 1 > tierCap) {
      return Object.freeze({
        kind: 'deny-cap-exceeded' satisfies CapVerdictKind,
        reason: `tier '${proposedAction.tier}' would exceed cap ${tierCap} (used ${used})`,
        trippedEnvelope: 'tool-tier',
        headroomPct: 0,
      });
    }
  }

  // ── 2. Per-sub-MD envelope ──
  const subMdCap = cap.perSubMdCaps[proposedAction.subMd];
  if (subMdCap) {
    const subMdState = rollingState.perSubMd[proposedAction.subMd] ?? {
      mutationsToday: 0,
      costUsdCentsToday: 0,
    };

    const subMutationsAfter = subMdState.mutationsToday + 1;
    const subCostAfter =
      subMdState.costUsdCentsToday + proposedAction.estimatedCostUsdCents;

    const subMutVerdict = applyThreshold({
      after: subMutationsAfter,
      ceiling: subMdCap.maxMutationsPerDay,
      slowdownAt: cap.slowdownAt,
      hardStopAt: cap.hardStopAt,
      envelope: 'sub-md-mutations',
      label: `sub-md '${proposedAction.subMd}' mutations`,
    });
    if (subMutVerdict) return subMutVerdict;

    const subCostVerdict = applyThreshold({
      after: subCostAfter,
      ceiling: subMdCap.maxCostUsdCentsPerDay,
      slowdownAt: cap.slowdownAt,
      hardStopAt: cap.hardStopAt,
      envelope: 'sub-md-cost',
      label: `sub-md '${proposedAction.subMd}' cost`,
    });
    if (subCostVerdict) return subCostVerdict;
  }

  // ── 3. Tenant-wide envelope ──
  const mutationsAfter = rollingState.mutationsToday + 1;
  const costAfter =
    rollingState.costUsdCentsToday + proposedAction.estimatedCostUsdCents;

  const tenantMutVerdict = applyThreshold({
    after: mutationsAfter,
    ceiling: cap.maxAutonomousMutationsPerDay,
    slowdownAt: cap.slowdownAt,
    hardStopAt: cap.hardStopAt,
    envelope: 'tenant-mutations',
    label: 'tenant mutations',
  });
  if (tenantMutVerdict) return tenantMutVerdict;

  const tenantCostVerdict = applyThreshold({
    after: costAfter,
    ceiling: cap.maxAutonomousCostUsdCentsPerDay,
    slowdownAt: cap.slowdownAt,
    hardStopAt: cap.hardStopAt,
    envelope: 'tenant-cost',
    label: 'tenant cost',
  });
  if (tenantCostVerdict) return tenantCostVerdict;

  // ── 4. Allow. Headroom = 1 - max(usage-ratio across envelopes). ──
  const headroomPct = computeHeadroom(cap, rollingState);
  return Object.freeze({
    kind: 'allow' satisfies CapVerdictKind,
    reason: 'within all envelopes',
    trippedEnvelope: null,
    headroomPct,
  });
}

interface ThresholdArgs {
  readonly after: number;
  readonly ceiling: number;
  readonly slowdownAt: number;
  readonly hardStopAt: number;
  readonly envelope: NonNullable<CapVerdict['trippedEnvelope']>;
  readonly label: string;
}

function applyThreshold(args: ThresholdArgs): CapVerdict | null {
  if (args.ceiling <= 0) {
    return Object.freeze({
      kind: 'deny-cap-exceeded' satisfies CapVerdictKind,
      reason: `${args.label} ceiling is 0`,
      trippedEnvelope: args.envelope,
      headroomPct: 0,
    });
  }
  const ratio = args.after / args.ceiling;
  if (ratio > args.hardStopAt) {
    return Object.freeze({
      kind: 'deny-cap-exceeded' satisfies CapVerdictKind,
      reason: `${args.label} would reach ${args.after}/${args.ceiling} (hardStop ${args.hardStopAt})`,
      trippedEnvelope: args.envelope,
      headroomPct: Math.max(0, 1 - ratio),
    });
  }
  if (ratio >= args.slowdownAt) {
    return Object.freeze({
      kind: 'slowdown-ask-owner' satisfies CapVerdictKind,
      reason: `${args.label} at ${args.after}/${args.ceiling} (slowdown ${args.slowdownAt})`,
      trippedEnvelope: args.envelope,
      headroomPct: Math.max(0, 1 - ratio),
    });
  }
  return null;
}

function computeHeadroom(
  cap: TenantAutonomyCap,
  state: AutonomyRollingState,
): number {
  const mutRatio =
    cap.maxAutonomousMutationsPerDay > 0
      ? state.mutationsToday / cap.maxAutonomousMutationsPerDay
      : 0;
  const costRatio =
    cap.maxAutonomousCostUsdCentsPerDay > 0
      ? state.costUsdCentsToday / cap.maxAutonomousCostUsdCentsPerDay
      : 0;
  const maxRatio = Math.max(mutRatio, costRatio);
  return Math.max(0, 1 - maxRatio);
}
