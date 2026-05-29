/**
 * Mr. Mwikila handler — regulatory-filing prep.
 *
 * Looks at the regulatory calendar → drafts the next quarterly /
 * annual filing for the jurisdiction's housing / rental authority.
 * Default tier is T1 (propose) — owner approves before any submission
 * reaches the regulator.
 *
 * Pure-logic shape: ports for upcoming-filings + portfolio-snapshot
 * are injected so vitest drives every branch deterministically.
 */

import type {
  MwikilaHandler,
  MwikilaHandlerProposal,
} from '../handler-runtime.js';

export interface UpcomingFilingRow {
  readonly filingId: string;
  readonly filingKind: string;
  readonly authorityCode: string;
  readonly periodLabel: string;
  readonly dueDateIso: string;
  readonly jurisdictionCode: string;
}

export interface PortfolioSnapshotForFiling {
  readonly totalUnits: number;
  readonly occupiedUnits: number;
  readonly grossRentCollected: number;
  readonly currencyCode: string;
}

export interface RegulatoryFilingPorts {
  listUpcomingFilingsWithin(args: {
    readonly tenantId: string;
    readonly fromIso: string;
    readonly toIso: string;
  }): Promise<ReadonlyArray<UpcomingFilingRow>>;
  snapshotPortfolioForFiling(args: {
    readonly tenantId: string;
    readonly periodStartIso: string;
    readonly periodEndIso: string;
  }): Promise<PortfolioSnapshotForFiling>;
}

export interface RegulatoryFilingOptions {
  /** Lookahead horizon for filings — default 30 days. */
  readonly horizonDays?: number;
}

const DEFAULT_HORIZON = 30;

export interface RegulatoryFilingDraft {
  readonly filingId: string;
  readonly filingKind: string;
  readonly authorityCode: string;
  readonly jurisdictionCode: string;
  readonly periodLabel: string;
  readonly dueDateIso: string;
  readonly snapshot: PortfolioSnapshotForFiling;
}

export function buildRegulatoryFilingProposal(
  filing: UpcomingFilingRow,
  snapshot: PortfolioSnapshotForFiling,
): MwikilaHandlerProposal {
  const draft: RegulatoryFilingDraft = {
    filingId: filing.filingId,
    filingKind: filing.filingKind,
    authorityCode: filing.authorityCode,
    jurisdictionCode: filing.jurisdictionCode,
    periodLabel: filing.periodLabel,
    dueDateIso: filing.dueDateIso,
    snapshot,
  };
  return {
    actionKind: 'regulatory.quarterly_filing_prep',
    category: 'regulatory-filings',
    summary: `Prepared ${filing.filingKind} for ${filing.authorityCode} (${filing.periodLabel}).`,
    summarySw: `Hati ya ${filing.filingKind} kwa ${filing.authorityCode} (${filing.periodLabel}) imetayarishwa.`,
    rationale:
      `Snapshot pulled for the filing's reporting window. Owner reviews ` +
      `and one-tap-approves before submission — T1 tier means no ` +
      `regulator interaction without explicit approval.`,
    payload: { draft },
    amount: 0,
    currency: snapshot.currencyCode,
    targetRelation: 'counterparty',
  };
}

export function createRegulatoryFilingHandler(
  ports: RegulatoryFilingPorts,
  opts: RegulatoryFilingOptions = {},
): MwikilaHandler {
  const horizon = opts.horizonDays ?? DEFAULT_HORIZON;
  return Object.freeze({
    actionKind: 'regulatory.quarterly_filing_prep',
    category: 'regulatory-filings',
    async propose({ tenantId, now }) {
      const fromIso = now.toISOString();
      const toIso = new Date(
        now.getTime() + horizon * 86_400_000,
      ).toISOString();
      const upcoming = await ports.listUpcomingFilingsWithin({
        tenantId,
        fromIso,
        toIso,
      });
      if (upcoming.length === 0) return null;
      const first = upcoming[0];
      if (!first) return null;
      // Snapshot the portfolio for the reporting period.
      const periodStartIso = new Date(
        new Date(first.dueDateIso).getTime() - 90 * 86_400_000,
      ).toISOString();
      const snapshot = await ports.snapshotPortfolioForFiling({
        tenantId,
        periodStartIso,
        periodEndIso: first.dueDateIso,
      });
      return buildRegulatoryFilingProposal(first, snapshot);
    },
  });
}
