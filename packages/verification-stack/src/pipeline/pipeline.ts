/**
 * Verification pipeline composer.
 *
 * Composition order (sequential — earlier modules' results feed
 * later modules' context):
 *
 *   1. CoVe              (always — if factualDraft present, else skipped)
 *   2. Self-Refine       (if messageDraft present)
 *   3. Self-Consistency  (if numericValue / numericPrompt present)
 *   4. Constitutional    (always for destructive; 5% sampled for non-destructive)
 *   5. Debate            (if action class in DEBATE_REQUIRED_ACTIONS)
 *
 * Skip rules — a module is added to `skipped[]` (not run) when:
 *   - Its required inputs are absent.
 *   - For Constitutional non-destructive: when the sampling roll misses.
 *   - For Debate: when action class is not in the required set.
 *
 * Aggregate verdict:
 *   - `fail`  if any module emitted `fail`
 *   - `defer` if any module emitted `defer` (and no fail)
 *   - `flag`  if any module emitted `flag` (and no fail/defer)
 *   - `pass`  otherwise
 *
 * Every run appends one sovereign-ledger entry per module + one
 * aggregate entry for the pipeline.
 *
 * Closes L1 #4, #5, #7, #9, #11 and L3 #4, #7, #8, #12.
 */

import type {
  PipelineAction,
  VerificationResult,
  Verdict,
  VerifiedDraft,
  RefinedMessage,
  ConstitutionalGateResult,
  ConsistencyResult,
  DebateResult,
} from '../types.js';
import { systemClock, type Clock } from '../ports/clock.js';
import {
  type SovereignLedgerPort,
  InMemorySovereignLedger,
} from '../ports/sovereign-ledger.js';
import { chainOfVerification, type CoveDeps } from '../cove/chain-of-verification.js';
import { selfRefine, type SelfRefineDeps } from '../self-refine/self-refine.js';
import {
  type ConstitutionalGate,
} from '../constitutional-gate/gate.js';
import {
  consistentCompute,
  type ConsistentComputeDeps,
} from '../self-consistency/self-consistency.js';
import {
  runDebate,
  debateRequired,
  type DebateDeps,
} from '../debate/debate.js';

export interface PipelineDeps {
  readonly cove: CoveDeps;
  readonly selfRefine: SelfRefineDeps;
  readonly constitutional: ConstitutionalGate;
  readonly consistency: ConsistentComputeDeps;
  readonly debate: DebateDeps;
  readonly ledger?: SovereignLedgerPort;
  readonly clock?: Clock;
  /**
   * Sample rate for Constitutional gate on NON-DESTRUCTIVE actions.
   * Spec: 5%. Range 0..1.
   */
  readonly nonDestructiveConstitutionalSampleRate?: number;
  /**
   * Optional injection for deterministic sampling (tests).
   */
  readonly random?: () => number;
}

const DEFAULTS = {
  nonDestructiveConstitutionalSampleRate: 0.05,
} as const;

/**
 * Run the full verification pipeline on an action.
 */
export async function verifyBeforeAction(
  action: PipelineAction,
  deps: PipelineDeps,
): Promise<VerificationResult> {
  const clock = deps.clock ?? systemClock;
  const ledger = deps.ledger ?? new InMemorySovereignLedger();
  const random = deps.random ?? Math.random;
  const sampleRate =
    deps.nonDestructiveConstitutionalSampleRate ??
    DEFAULTS.nonDestructiveConstitutionalSampleRate;

  const start = clock.monotonicMs();
  const skipped: string[] = [];

  // 1. CoVe
  let verifiedDraft: VerifiedDraft | null = null;
  if (action.factualDraft && action.factualDraft.length > 0) {
    verifiedDraft = await chainOfVerification(
      action.factualDraft,
      action.factClass ?? 'general',
      deps.cove,
    );
    await ledger.append({
      id: `${action.id}.cove`,
      timestamp: clock.now().toISOString(),
      tenantId: action.tenantId,
      actionClass: action.actionClass,
      module: 'cove',
      verdict: verifiedDraft.verdict,
      summary: `CoVe ${verifiedDraft.verdict}: ${verifiedDraft.claims.length} claims, ${verifiedDraft.unverifiedClaims.length} unverified`,
      detail: { factClass: verifiedDraft.factClass, elapsedMs: verifiedDraft.elapsedMs },
    });
  } else {
    skipped.push('cove');
  }

  // 2. Self-Refine
  let refinedMessage: RefinedMessage | null = null;
  if (action.messageDraft && action.messageDraft.length > 0) {
    const tenantJurisdiction = typeof action.context?.['tenantJurisdiction'] === 'string'
      ? (action.context['tenantJurisdiction'] as string)
      : undefined;
    refinedMessage = await selfRefine(
      {
        initialDraft: action.messageDraft,
        actionClass: action.actionClass,
        originalContext: JSON.stringify(action.context ?? {}),
        ...(tenantJurisdiction !== undefined ? { tenantJurisdiction } : {}),
      },
      deps.selfRefine,
    );
    await ledger.append({
      id: `${action.id}.self-refine`,
      timestamp: clock.now().toISOString(),
      tenantId: action.tenantId,
      actionClass: action.actionClass,
      module: 'self-refine',
      verdict: refinedMessage.verdict,
      summary: `Self-Refine ${refinedMessage.verdict}: ${refinedMessage.iterations.length} iterations, accepted=${refinedMessage.accepted}`,
      detail: { elapsedMs: refinedMessage.elapsedMs },
    });
  } else {
    skipped.push('self-refine');
  }

  // 3. Self-Consistency
  let consistency: ConsistencyResult | null = null;
  if (action.numericPrompt && action.numericPrompt.length > 0) {
    consistency = await consistentCompute(
      { prompt: action.numericPrompt, ...(action.context !== undefined ? { context: action.context } : {}) },
      deps.consistency,
    );
    await ledger.append({
      id: `${action.id}.self-consistency`,
      timestamp: clock.now().toISOString(),
      tenantId: action.tenantId,
      actionClass: action.actionClass,
      module: 'self-consistency',
      verdict: consistency.verdict,
      summary: `Self-Consistency ${consistency.verdict}: value=${consistency.value}, confidence=${consistency.confidence.toFixed(2)} (${consistency.winningCount}/${consistency.n})`,
      detail: { elapsedMs: consistency.elapsedMs },
    });
  } else {
    skipped.push('self-consistency');
  }

  // 4. Constitutional
  let constitutional: ConstitutionalGateResult | null = null;
  const shouldRunConstitutional =
    action.destructive || random() < sampleRate;
  if (shouldRunConstitutional) {
    const draftToCheck =
      action.messageDraft ?? action.factualDraft ?? JSON.stringify(action.context ?? {});
    constitutional = await deps.constitutional.check({
      actionId: action.id,
      actionClass: action.actionClass,
      tenantId: action.tenantId,
      draft: draftToCheck,
      ...(action.context !== undefined ? { context: action.context } : {}),
    });
    await ledger.append({
      id: `${action.id}.constitutional`,
      timestamp: clock.now().toISOString(),
      tenantId: action.tenantId,
      actionClass: action.actionClass,
      module: 'constitutional',
      verdict: constitutional.verdict,
      summary: `Constitutional ${constitutional.verdict}: ${constitutional.violations.length} violation(s), score=${constitutional.overallScore.toFixed(2)}, deferred=${constitutional.deferred}`,
      detail: { elapsedMs: constitutional.elapsedMs },
    });
  } else {
    skipped.push('constitutional');
  }

  // 5. Debate
  let debate: DebateResult | null = null;
  if (debateRequired(action.actionClass)) {
    debate = await runDebate(
      {
        actionClass: action.actionClass,
        actionDescription:
          action.messageDraft ??
          action.factualDraft ??
          `action ${action.id}`,
        context: action.context ?? {},
      },
      deps.debate,
    );
    await ledger.append({
      id: `${action.id}.debate`,
      timestamp: clock.now().toISOString(),
      tenantId: action.tenantId,
      actionClass: action.actionClass,
      module: 'debate',
      verdict: debate.verdict,
      summary: `Debate ${debate.verdict}: ${debate.decision} → ${debate.recommendation} (${debate.rationale})`,
      detail: { elapsedMs: debate.elapsedMs, rounds: debate.rounds },
    });
  } else {
    skipped.push('debate');
  }

  // Aggregate verdict
  const verdicts: Verdict[] = [
    verifiedDraft?.verdict,
    refinedMessage?.verdict,
    consistency?.verdict,
    constitutional?.verdict,
    debate?.verdict,
  ].filter((v): v is Verdict => v !== undefined && v !== null);

  const verdict: Verdict = aggregateVerdict(verdicts);
  const elapsedMs = clock.monotonicMs() - start;

  await ledger.append({
    id: `${action.id}.pipeline`,
    timestamp: clock.now().toISOString(),
    tenantId: action.tenantId,
    actionClass: action.actionClass,
    module: 'pipeline',
    verdict,
    summary: `Pipeline ${verdict}: ${verdicts.length} modules ran, ${skipped.length} skipped`,
    detail: { elapsedMs, skipped, verdicts },
  });

  return {
    action,
    verdict,
    verifiedDraft,
    refinedMessage,
    constitutional,
    consistency,
    debate,
    skipped,
    elapsedMs,
  };
}

function aggregateVerdict(verdicts: ReadonlyArray<Verdict>): Verdict {
  if (verdicts.includes('fail')) return 'fail';
  if (verdicts.includes('defer')) return 'defer';
  if (verdicts.includes('flag')) return 'flag';
  return 'pass';
}
