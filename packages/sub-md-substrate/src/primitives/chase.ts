/**
 * Chase<TTarget, TEscalation> — multi-step follow-up with escalation ladder.
 *
 * INPUT     a TTarget (debtor, churn-risk owner, candidate awaiting reply,
 *           overdue work-order) + a ChaseHistory of prior touches
 * OUTPUT    a TEscalation decision: which rung of the ladder to fire,
 *           which channel, optional message draft hint, optional handoff.
 *
 * The substrate enforces:
 *   - cooldown: never re-touch a target within a per-rung cooldown
 *   - escalation: monotonically increasing severity, never regresses
 *   - handoff: if the ladder reaches its top rung, the primitive emits
 *     a 'handoff' decision that the MD routes to a human
 *
 * Examples:
 *   - arrears.chaser                 Chase<DelinquentRent, EscalationRung>
 *   - lease.renewal.chaser           Chase<UnsignedRenewal, NudgeRung>
 *   - sales.churn-chase (internal)   Chase<ChurnRiskOwner, OutreachRung>
 *   - hr.candidate-chase             Chase<UnrespondingCandidate, Rung>
 */

import { createCapTracker } from '../hooks/autonomy-cap.js';
import { sealLedgerEntry } from '../hooks/ledger-seal.js';
import { decidePermission } from '../hooks/permission-mode.js';
import type {
  PrimitiveContext,
  PrimitiveResult,
} from '../types.js';
import { isInScope } from '../types.js';

export interface ChaseHistoryEntry {
  readonly rungAtTouch: number;
  readonly channel: 'email' | 'sms' | 'voice' | 'inbox' | 'in-person';
  readonly atMs: number;
  readonly responded: boolean;
}

export interface ChaseDecision {
  readonly action:
    | 'wait-in-cooldown'
    | 'send-this-rung'
    | 'escalate-rung'
    | 'handoff-to-human';
  readonly rung: number;
  readonly channel: ChaseHistoryEntry['channel'];
  readonly draftHint?: string;
  readonly nextEligibleAtMs?: number;
  readonly handoffReason?: string;
}

export interface ChaseLadderRung {
  /** Rung index, 0-based. */
  readonly index: number;
  readonly label: string;
  readonly channel: ChaseHistoryEntry['channel'];
  /** Minimum dwell time before re-touching at THIS rung or escalating. */
  readonly cooldownMs: number;
  /** Optional draft hint a downstream Draft primitive should respect. */
  readonly draftHint?: string;
}

export interface ChaseLadder {
  readonly rungs: ReadonlyArray<ChaseLadderRung>;
  readonly handoffAtRung: number;
}

export interface ChasePrimitive<TTarget> {
  readonly name: string;
  run(args: {
    readonly target: TTarget;
    readonly inputTenantId: string;
    readonly history: ReadonlyArray<ChaseHistoryEntry>;
    readonly ctx: PrimitiveContext;
  }): Promise<PrimitiveResult<ChaseDecision>>;
}

export interface ChaseOptions<TTarget> {
  readonly name: string;
  readonly ladder: ChaseLadder;
  /**
   * Optional predicate — when true the chase TERMINATES (e.g. debt
   * settled, candidate replied, owner re-engaged). Substrate emits a
   * sealed entry with action='wait-in-cooldown' and rung=last to keep
   * the audit trail consistent.
   */
  readonly isTargetResolved?: (target: TTarget) => boolean;
}

export function createChase<TTarget>(
  opts: ChaseOptions<TTarget>,
): ChasePrimitive<TTarget> {
  if (opts.ladder.rungs.length === 0) {
    throw new Error(`Chase "${opts.name}": ladder must have at least one rung`);
  }

  const primitive: ChasePrimitive<TTarget> = {
    name: opts.name,
    async run({
      target,
      inputTenantId,
      history,
      ctx,
    }: {
      readonly target: TTarget;
      readonly inputTenantId: string;
      readonly history: ReadonlyArray<ChaseHistoryEntry>;
      readonly ctx: PrimitiveContext;
    }): Promise<PrimitiveResult<ChaseDecision>> {
      const inScope = isInScope(inputTenantId, ctx.scope);
      if (!inScope.ok) {
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'chase',
          input: { target, historyCount: history.length },
          output: {
            action: 'wait-in-cooldown',
            rung: 0,
            channel: opts.ladder.rungs[0]!.channel,
          } satisfies ChaseDecision,
          summary: `chase rejected: ${inScope.reason}`,
          status: 'rejected',
          sideEffectCount: 0,
        });
      }

      const tracker = createCapTracker(ctx.autonomyCap);
      // Reading data only — no LLM, no external. Chase is a state machine.
      void tracker;

      if (opts.isTargetResolved?.(target) ?? false) {
        const lastRung = opts.ladder.rungs[opts.ladder.rungs.length - 1]!;
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'chase',
          input: { target, historyCount: history.length },
          output: {
            action: 'wait-in-cooldown',
            rung: lastRung.index,
            channel: lastRung.channel,
          } satisfies ChaseDecision,
          summary: 'chase terminated: target resolved',
          status: 'sealed',
          sideEffectCount: 0,
        });
      }

      // Determine the current rung from history.
      const lastTouch = history.length > 0 ? history[history.length - 1]! : null;
      const currentRungIdx = lastTouch ? lastTouch.rungAtTouch : -1;
      const nextRungIdx = Math.min(
        currentRungIdx + 1,
        opts.ladder.rungs.length - 1,
      );

      // Cooldown check on the CURRENT rung — never below.
      if (lastTouch && currentRungIdx >= 0) {
        const currentRung = opts.ladder.rungs[currentRungIdx]!;
        const dwellMs = ctx.nowMs - lastTouch.atMs;
        if (dwellMs < currentRung.cooldownMs) {
          return sealLedgerEntry({
            ctx,
            primitiveName: opts.name,
            primitiveKind: 'chase',
            input: { target, historyCount: history.length },
            output: {
              action: 'wait-in-cooldown',
              rung: currentRungIdx,
              channel: currentRung.channel,
              nextEligibleAtMs: lastTouch.atMs + currentRung.cooldownMs,
            } satisfies ChaseDecision,
            summary: `chase in cooldown rung=${currentRungIdx}, ${currentRung.cooldownMs - dwellMs}ms remaining`,
            status: 'sealed',
            sideEffectCount: 0,
          });
        }
      }

      // Handoff once we hit the top rung.
      if (
        currentRungIdx >= opts.ladder.handoffAtRung ||
        nextRungIdx >= opts.ladder.handoffAtRung
      ) {
        const topRung = opts.ladder.rungs[opts.ladder.handoffAtRung]!;
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'chase',
          input: { target, historyCount: history.length },
          output: {
            action: 'handoff-to-human',
            rung: topRung.index,
            channel: topRung.channel,
            handoffReason: `reached top rung ${topRung.label}`,
          } satisfies ChaseDecision,
          summary: `chase handoff: rung ${topRung.label}`,
          status: 'awaiting-owner',
          sideEffectCount: 0,
        });
      }

      // Otherwise advance to next rung.
      const action = currentRungIdx === -1 ? 'send-this-rung' : 'escalate-rung';
      const rung = opts.ladder.rungs[nextRungIdx]!;
      const permission = decidePermission(ctx);

      const decision: ChaseDecision = Object.freeze({
        action,
        rung: rung.index,
        channel: rung.channel,
        ...(rung.draftHint !== undefined ? { draftHint: rung.draftHint } : {}),
      });

      return sealLedgerEntry({
        ctx,
        primitiveName: opts.name,
        primitiveKind: 'chase',
        input: { target, historyCount: history.length },
        output: decision,
        summary: `chase ${action} → rung ${rung.label}`,
        status: permission.ledgerStatus,
        sideEffectCount: 0,
      });
    },
  };
  return Object.freeze(primitive);
}
