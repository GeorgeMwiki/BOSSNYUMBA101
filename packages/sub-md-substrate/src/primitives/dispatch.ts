/**
 * Dispatch<TClassification, TRouteResult> — pick a counterparty + send.
 *
 * INPUT     a TClassification from Triage + a candidate pool
 * OUTPUT    a TRouteResult (recipient, channel, message id) — and, in
 *           non-dry-run modes, an actual external delivery.
 *
 * Examples:
 *   - maintenance.dispatch.send       Dispatch<Severity+VendorPool, WorkOrder>
 *   - hr.dispatch                     Dispatch<RecruiterPick, InterviewInvite>
 *   - lease.coordinator.send-renewal  Dispatch<RenewalProposal, Email>
 *
 * The substrate's job: enforce cap on external-calls, decide whether the
 * transport-port may actually fire (only in 'auto' mode), seal the entry.
 */

import { createCapTracker } from '../hooks/autonomy-cap.js';
import { sealLedgerEntry } from '../hooks/ledger-seal.js';
import { decidePermission } from '../hooks/permission-mode.js';
import type {
  PrimitiveContext,
  PrimitiveResult,
} from '../types.js';
import { isInScope } from '../types.js';

export interface DispatchCandidate<TId = string> {
  readonly id: TId;
  readonly displayName: string;
  /** Higher = preferred. Substrate-agnostic. */
  readonly score: number;
  readonly channel: 'email' | 'sms' | 'inbox' | 'webhook' | 'voice';
}

export interface DispatchRoute<TId = string> {
  readonly chosen: DispatchCandidate<TId>;
  readonly fallbacks: ReadonlyArray<DispatchCandidate<TId>>;
  /**
   * The message id assigned by the transport. `null` when permission
   * mode forbade an actual send (dry-run / propose / act-on-yes).
   */
  readonly externalMessageId: string | null;
}

export interface DispatchSelector<TClassification, TId = string> {
  pick(args: {
    readonly classification: TClassification;
    readonly candidates: ReadonlyArray<DispatchCandidate<TId>>;
    readonly ctx: PrimitiveContext;
  }): Promise<{
    readonly chosen: DispatchCandidate<TId>;
    readonly fallbacks: ReadonlyArray<DispatchCandidate<TId>>;
  }>;
}

export interface DispatchTransportPort<TId = string> {
  send(args: {
    readonly candidate: DispatchCandidate<TId>;
    readonly ctx: PrimitiveContext;
    readonly payload: Readonly<Record<string, unknown>>;
  }): Promise<{ readonly externalMessageId: string }>;
}

export interface DispatchPrimitive<TClassification, TId = string> {
  readonly name: string;
  run(args: {
    readonly classification: TClassification;
    readonly candidates: ReadonlyArray<DispatchCandidate<TId>>;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly inputTenantId: string;
    readonly ctx: PrimitiveContext;
  }): Promise<PrimitiveResult<DispatchRoute<TId>>>;
}

export interface DispatchOptions<TClassification, TId = string> {
  readonly name: string;
  readonly selector: DispatchSelector<TClassification, TId>;
  readonly transport: DispatchTransportPort<TId>;
  /**
   * Max fallback count surfaced in the route. The substrate doesn't
   * attempt fallback delivery automatically — that's an MD-level decision
   * — but it records the runner-up vendors so the MD can re-dispatch.
   */
  readonly maxFallbacks?: number;
}

export function createDispatch<TClassification, TId = string>(
  opts: DispatchOptions<TClassification, TId>,
): DispatchPrimitive<TClassification, TId> {
  const maxFallbacks = opts.maxFallbacks ?? 3;

  const primitive: DispatchPrimitive<TClassification, TId> = {
    name: opts.name,
    async run({
      classification,
      candidates,
      payload,
      inputTenantId,
      ctx,
    }: {
      readonly classification: TClassification;
      readonly candidates: ReadonlyArray<DispatchCandidate<TId>>;
      readonly payload: Readonly<Record<string, unknown>>;
      readonly inputTenantId: string;
      readonly ctx: PrimitiveContext;
    }): Promise<PrimitiveResult<DispatchRoute<TId>>> {
      const inScope = isInScope(inputTenantId, ctx.scope);
      if (!inScope.ok) {
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'dispatch',
          input: { classification, candidates: candidates.length },
          output: {
            chosen: candidates[0] ?? {
              id: 'none' as unknown as TId,
              displayName: 'none',
              score: 0,
              channel: 'inbox' as const,
            },
            fallbacks: [],
            externalMessageId: null,
          } satisfies DispatchRoute<TId>,
          summary: `dispatch rejected: ${inScope.reason}`,
          status: 'rejected',
          sideEffectCount: 0,
        });
      }

      if (candidates.length === 0) {
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'dispatch',
          input: { classification, candidates: 0 },
          output: {
            chosen: {
              id: 'none' as unknown as TId,
              displayName: 'no-candidates',
              score: 0,
              channel: 'inbox',
            },
            fallbacks: [],
            externalMessageId: null,
          } satisfies DispatchRoute<TId>,
          summary: 'dispatch failed: no candidates supplied',
          status: 'rejected',
          sideEffectCount: 0,
        });
      }

      const tracker = createCapTracker(ctx.autonomyCap);
      const { chosen, fallbacks } = await opts.selector.pick({
        classification,
        candidates,
        ctx,
      });

      const permission = decidePermission(ctx);
      let externalMessageId: string | null = null;
      let sideEffectCount = 0;

      if (permission.allowSideEffect) {
        const consumed = tracker.consume('external-call');
        if (!consumed.ok) {
          return sealLedgerEntry({
            ctx,
            primitiveName: opts.name,
            primitiveKind: 'dispatch',
            input: { classification, candidate: chosen.id },
            output: { chosen, fallbacks: fallbacks.slice(0, maxFallbacks), externalMessageId: null },
            summary: `dispatch cap-blocked: ${consumed.reason}`,
            status: 'rejected',
            sideEffectCount: 0,
          });
        }
        const sent = await opts.transport.send({
          candidate: chosen,
          ctx,
          payload,
        });
        externalMessageId = sent.externalMessageId;
        tracker.consume('side-effect');
        sideEffectCount = 1;
      }

      const route: DispatchRoute<TId> = Object.freeze({
        chosen,
        fallbacks: Object.freeze(fallbacks.slice(0, maxFallbacks)),
        externalMessageId,
      });

      return sealLedgerEntry({
        ctx,
        primitiveName: opts.name,
        primitiveKind: 'dispatch',
        input: { classification, candidate: chosen.id },
        output: route,
        summary: `dispatch → ${chosen.displayName} (${chosen.channel})`,
        status: permission.ledgerStatus,
        sideEffectCount,
      });
    },
  };
  return Object.freeze(primitive);
}
