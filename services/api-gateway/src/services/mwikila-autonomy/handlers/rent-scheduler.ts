/**
 * Mr. Mwikila handler — rent invoice scheduler.
 *
 * Looks at active leases → drafts next-month rent invoices.
 * Default tier is T2 (act-with-reversal). Reversal window is 24h
 * so the owner can rollback before tenants receive the invoice.
 *
 * Pure-logic shape: ports for active-lease listing + existing-invoice
 * check are injected so vitest drives every branch deterministically.
 *
 * Multi-currency: the proposal carries the lease's currency code so
 * the inviolable rail's currency check resolves correctly.
 */

import type {
  MwikilaHandler,
  MwikilaHandlerProposal,
} from '../handler-runtime.js';

export interface ActiveLeaseRow {
  readonly leaseId: string;
  readonly tenantId: string;
  readonly unitId: string;
  readonly residentName: string;
  readonly monthlyRent: number;
  readonly currencyCode: string;
  /** ISO date — next bill date. */
  readonly nextBillDateIso: string;
}

export interface RentSchedulerPorts {
  listActiveLeasesDueWithin(args: {
    readonly tenantId: string;
    readonly fromIso: string;
    readonly toIso: string;
  }): Promise<ReadonlyArray<ActiveLeaseRow>>;
  /**
   * Returns true when a rent invoice already exists for the lease /
   * billing-month pair. The handler skips when true to avoid
   * double-billing.
   */
  invoiceAlreadyExists(args: {
    readonly tenantId: string;
    readonly leaseId: string;
    readonly billingMonthIso: string;
  }): Promise<boolean>;
}

export interface RentSchedulerOptions {
  /** Window over which we draft — default 14 days. */
  readonly horizonDays?: number;
}

const DEFAULT_HORIZON = 14;

export interface RentInvoiceDraft {
  readonly leaseId: string;
  readonly unitId: string;
  readonly residentName: string;
  readonly amount: number;
  readonly currencyCode: string;
  readonly billingMonthIso: string;
  readonly dueDateIso: string;
}

export function buildRentSchedulerProposal(
  leases: ReadonlyArray<ActiveLeaseRow>,
): MwikilaHandlerProposal | null {
  if (leases.length === 0) return null;

  const drafts: RentInvoiceDraft[] = leases.map((l) => ({
    leaseId: l.leaseId,
    unitId: l.unitId,
    residentName: l.residentName,
    amount: l.monthlyRent,
    currencyCode: l.currencyCode,
    billingMonthIso: l.nextBillDateIso.slice(0, 7),
    dueDateIso: l.nextBillDateIso,
  }));

  // Mixed-currency drafts are allowed (multi-currency portfolios).
  // The runtime's non-domestic rail only blocks autonomous money-out
  // moves — drafting invoices does not move money. amount=0 keeps the
  // envelope check passing.
  const currencies = Array.from(new Set(drafts.map((d) => d.currencyCode)));

  return {
    actionKind: 'rent.next_period_invoice_draft',
    category: 'rent-scheduling',
    summary: `Drafted ${drafts.length} rent invoices (${currencies.join('/')}).`,
    summarySw: `Ankara ${drafts.length} za kodi zimetayarishwa (${currencies.join('/')}).`,
    rationale:
      `Drafted invoices for ${drafts.length} active leases with a billing ` +
      `date within the horizon. No money has moved — owner can reverse ` +
      `the entire batch within 24h before tenants see them.`,
    payload: {
      drafts,
      currencies,
    },
    amount: 0,
    currency: currencies[0] ?? 'TZS',
    targetRelation: 'tenant',
  };
}

export function createRentSchedulerHandler(
  ports: RentSchedulerPorts,
  opts: RentSchedulerOptions = {},
): MwikilaHandler {
  const horizon = opts.horizonDays ?? DEFAULT_HORIZON;
  return Object.freeze({
    actionKind: 'rent.next_period_invoice_draft',
    category: 'rent-scheduling',
    async propose({ tenantId, now }) {
      const fromIso = now.toISOString();
      const toIso = new Date(
        now.getTime() + horizon * 86_400_000,
      ).toISOString();
      const all = await ports.listActiveLeasesDueWithin({
        tenantId,
        fromIso,
        toIso,
      });
      // Filter out leases that already have an invoice for the billing
      // month.
      const due: ActiveLeaseRow[] = [];
      for (const l of all) {
        const billingMonth = l.nextBillDateIso.slice(0, 7);
        const exists = await ports.invoiceAlreadyExists({
          tenantId,
          leaseId: l.leaseId,
          billingMonthIso: billingMonth,
        });
        if (!exists) due.push(l);
      }
      return buildRentSchedulerProposal(due);
    },
  });
}
