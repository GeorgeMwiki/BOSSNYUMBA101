/**
 * vendor.reconcile — Reconcile<InvoicesVsPayments, Matches>
 *
 * Matches BOSSNYUMBA's internal vendor INVOICES against PAYMENTS
 * settled by the finance team. Surfaces:
 *
 *   - matched pairs (within amount + timing tolerance)
 *   - invoices we owe (unpaid)
 *   - payments we made but can't find an invoice for (likely
 *     duplicate / fraud / misposted)
 *   - amount deltas (e.g. invoice 100 but paid 95 — short-pay)
 *
 * Strategy: exact match on (vendorId, invoiceRef) first; then fuzzy
 * match by (vendorId, amount within ±2%) within a 14d window.
 */

import {
  createReconcile,
  type ReconcileMatch,
  type ReconcilePrimitive,
  type ReconcileResult,
  type ReconcileRow,
  type ReconcileStrategy,
} from '../../primitives/reconcile.js';

export interface VendorReconcileStrategyOptions {
  /** Max relative amount delta to still call a match. Defaults 0.02 (2%). */
  readonly amountToleranceFraction?: number;
  /** Max timing delta (ms) for a fuzzy match. Defaults 14 days. */
  readonly timingToleranceMs?: number;
}

export function createVendorReconcileStrategy(
  opts: VendorReconcileStrategyOptions = {},
): ReconcileStrategy {
  const amountTol = opts.amountToleranceFraction ?? 0.02;
  const timingTol = opts.timingToleranceMs ?? 14 * 86_400_000;

  return {
    async reconcile({ left, right }) {
      const consumedLeft = new Set<string>();
      const consumedRight = new Set<string>();
      const matches: ReconcileMatch[] = [];

      // Phase 1 — exact match on metadata.invoiceRef (right) → left.id.
      for (const r of right) {
        const ref = r.metadata['invoiceRef'];
        if (ref === undefined) continue;
        const l = left.find((ll) => !consumedLeft.has(ll.id) && ll.id === ref);
        if (l !== undefined && l.metadata['vendorId'] === r.metadata['vendorId']) {
          matches.push({
            leftId: l.id,
            rightId: r.id,
            amountDeltaMinor: r.amountMinor - l.amountMinor,
            timingDeltaMs: r.occurredAtMs - l.occurredAtMs,
            confidence: 1.0,
          });
          consumedLeft.add(l.id);
          consumedRight.add(r.id);
        }
      }

      // Phase 2 — fuzzy on (vendorId, amount ±tol, time ±tol).
      for (const l of left) {
        if (consumedLeft.has(l.id)) continue;
        const vendorId = l.metadata['vendorId'];
        if (vendorId === undefined) continue;
        const candidate = right.find((r) => {
          if (consumedRight.has(r.id)) return false;
          if (r.metadata['vendorId'] !== vendorId) return false;
          const amtRel = Math.abs(r.amountMinor - l.amountMinor) / Math.max(1, l.amountMinor);
          if (amtRel > amountTol) return false;
          if (Math.abs(r.occurredAtMs - l.occurredAtMs) > timingTol) return false;
          return true;
        });
        if (candidate !== undefined) {
          matches.push({
            leftId: l.id,
            rightId: candidate.id,
            amountDeltaMinor: candidate.amountMinor - l.amountMinor,
            timingDeltaMs: candidate.occurredAtMs - l.occurredAtMs,
            confidence: 0.8,
          });
          consumedLeft.add(l.id);
          consumedRight.add(candidate.id);
        }
      }

      const leftOnly = left.filter((l) => !consumedLeft.has(l.id));
      const rightOnly = right.filter((r) => !consumedRight.has(r.id));

      const suggestedActions: ReconcileResult['suggestedActions'] = [
        ...leftOnly.map((l) => ({
          kind: 'investigate-left-only' as const,
          targetId: l.id,
          rationale: `unpaid invoice ${l.id} amount ${l.amountMinor} ${l.currency}`,
        })),
        ...rightOnly.map((r) => ({
          kind: 'investigate-right-only' as const,
          targetId: r.id,
          rationale: `payment ${r.id} with no matching invoice — possible duplicate or fraud`,
        })),
        ...matches
          .filter((m) => m.amountDeltaMinor !== 0)
          .map((m) => ({
            kind: 'accept-delta' as const,
            targetId: m.leftId,
            rationale: `amount delta ${m.amountDeltaMinor}`,
          })),
      ];

      const totalLeft = left.reduce((s, r) => s + r.amountMinor, 0);
      const totalRight = right.reduce((s, r) => s + r.amountMinor, 0);

      return {
        matches,
        leftOnly,
        rightOnly,
        suggestedActions,
        totalLeft,
        totalRight,
      };
    },
  };
}

export interface VendorReconcileSubMd {
  readonly name: string;
  readonly reconcile: ReconcilePrimitive;
}

export function createVendorReconcile(
  opts: VendorReconcileStrategyOptions = {},
): VendorReconcileSubMd {
  return Object.freeze({
    name: 'vendor.reconcile',
    reconcile: createReconcile({
      name: 'vendor.reconcile.match',
      strategy: createVendorReconcileStrategy(opts),
      maxRowsPerSide: 50_000,
    }),
  });
}

export type { ReconcileRow };
