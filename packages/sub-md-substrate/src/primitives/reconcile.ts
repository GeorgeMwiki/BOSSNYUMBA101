/**
 * Reconcile<TLeftRight, TMatches> — match two sides + flag deltas.
 *
 * INPUT     two streams (left, right) — invoices/payments, vendor charges
 *           vs internal POs, KRA filings vs tax-engine output, CRM seat
 *           counts vs billing, etc — plus a match-key strategy.
 * OUTPUT    matched pairs, left-only unmatched, right-only unmatched,
 *           amount deltas, suggested actions.
 *
 * Examples:
 *   - vendor.reconcile (internal)        Reconcile<InvoicesVsPayments, Matches>
 *   - kra.filing_assistant.reconcile     Reconcile<TenantBooksVsKraReturn, Deltas>
 *   - leasing.deposit-reconcile          Reconcile<DepositReceived vs LeaseTerms>
 *   - payroll.reconcile                  Reconcile<Salaries vs BankDebits>
 *
 * Reconcile is RIGOROUS by design: every unmatched side is surfaced. The
 * primitive never silently drops a row. The substrate caps LLM calls to
 * zero by default — the strategy is expected to be deterministic.
 */

import { createCapTracker } from '../hooks/autonomy-cap.js';
import { sealLedgerEntry } from '../hooks/ledger-seal.js';
import { decidePermission } from '../hooks/permission-mode.js';
import type {
  PrimitiveContext,
  PrimitiveResult,
} from '../types.js';
import { isInScope } from '../types.js';

export interface ReconcileRow {
  readonly id: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly occurredAtMs: number;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface ReconcileMatch {
  readonly leftId: string;
  readonly rightId: string;
  readonly amountDeltaMinor: number;
  readonly timingDeltaMs: number;
  /** Strategy-assigned confidence (0..1). */
  readonly confidence: number;
}

export interface ReconcileResult {
  readonly matches: ReadonlyArray<ReconcileMatch>;
  readonly leftOnly: ReadonlyArray<ReconcileRow>;
  readonly rightOnly: ReadonlyArray<ReconcileRow>;
  readonly suggestedActions: ReadonlyArray<{
    readonly kind: 'investigate-left-only' | 'investigate-right-only' | 'accept-delta' | 'flag-fraud';
    readonly targetId: string;
    readonly rationale: string;
  }>;
  readonly totalLeft: number;
  readonly totalRight: number;
}

export interface ReconcileStrategy {
  reconcile(args: {
    readonly left: ReadonlyArray<ReconcileRow>;
    readonly right: ReadonlyArray<ReconcileRow>;
    readonly ctx: PrimitiveContext;
  }): Promise<ReconcileResult>;
}

export interface ReconcilePrimitive {
  readonly name: string;
  run(args: {
    readonly left: ReadonlyArray<ReconcileRow>;
    readonly right: ReadonlyArray<ReconcileRow>;
    readonly inputTenantId: string;
    readonly ctx: PrimitiveContext;
  }): Promise<PrimitiveResult<ReconcileResult>>;
}

export interface ReconcileOptions {
  readonly name: string;
  readonly strategy: ReconcileStrategy;
  /** Max rows per side. Defaults 100_000. */
  readonly maxRowsPerSide?: number;
}

export function createReconcile(opts: ReconcileOptions): ReconcilePrimitive {
  const maxRowsPerSide = opts.maxRowsPerSide ?? 100_000;

  const primitive: ReconcilePrimitive = {
    name: opts.name,
    async run({
      left,
      right,
      inputTenantId,
      ctx,
    }: {
      readonly left: ReadonlyArray<ReconcileRow>;
      readonly right: ReadonlyArray<ReconcileRow>;
      readonly inputTenantId: string;
      readonly ctx: PrimitiveContext;
    }): Promise<PrimitiveResult<ReconcileResult>> {
      const inScope = isInScope(inputTenantId, ctx.scope);
      if (!inScope.ok) {
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'reconcile',
          input: { leftCount: left.length, rightCount: right.length },
          output: emptyResult(),
          summary: `reconcile rejected: ${inScope.reason}`,
          status: 'rejected',
          sideEffectCount: 0,
        });
      }

      if (left.length > maxRowsPerSide || right.length > maxRowsPerSide) {
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'reconcile',
          input: { leftCount: left.length, rightCount: right.length },
          output: emptyResult(),
          summary: `reconcile rejected: rows-per-side exceeded (${Math.max(left.length, right.length)} > ${maxRowsPerSide})`,
          status: 'rejected',
          sideEffectCount: 0,
        });
      }

      // Currency homogeneity check.
      const allCurrencies = new Set<string>();
      for (const r of left) allCurrencies.add(r.currency);
      for (const r of right) allCurrencies.add(r.currency);
      if (allCurrencies.size > 1) {
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'reconcile',
          input: { leftCount: left.length, rightCount: right.length },
          output: emptyResult(),
          summary: `reconcile rejected: mixed currencies ${Array.from(allCurrencies).join(',')}`,
          status: 'rejected',
          sideEffectCount: 0,
        });
      }

      const tracker = createCapTracker(ctx.autonomyCap);
      void tracker;
      const result = await opts.strategy.reconcile({ left, right, ctx });

      const permission = decidePermission(ctx);
      return sealLedgerEntry({
        ctx,
        primitiveName: opts.name,
        primitiveKind: 'reconcile',
        input: { leftCount: left.length, rightCount: right.length },
        output: result,
        summary: `reconcile: ${result.matches.length} matched, ${result.leftOnly.length} left-only, ${result.rightOnly.length} right-only`,
        status: permission.ledgerStatus,
        sideEffectCount: 0,
      });
    },
  };
  return Object.freeze(primitive);
}

function emptyResult(): ReconcileResult {
  return {
    matches: [],
    leftOnly: [],
    rightOnly: [],
    suggestedActions: [],
    totalLeft: 0,
    totalRight: 0,
  };
}
