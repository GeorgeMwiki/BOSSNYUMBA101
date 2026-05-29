/**
 * Mr. Mwikila handler — lease renewal reminder ladder.
 *
 * Looks at leases expiring within the next 90/60/30 day windows and
 * drafts a renewal-reminder cascade (T-90 informational, T-60 propose
 * renewal terms, T-30 propose final notice).
 *
 * Default tier is T1 (propose) — leases are sensitive counterparty
 * touchpoints. Mr. Mwikila never autonomously commits to a renewal
 * price or term; he drafts and the owner approves.
 *
 * Pure-logic shape: ports for expiring-lease listing + most-recent-
 * reminder timing are injected so vitest drives every branch
 * deterministically.
 */

import type {
  MwikilaHandler,
  MwikilaHandlerProposal,
} from '../handler-runtime.js';

export interface ExpiringLeaseRow {
  readonly leaseId: string;
  readonly unitId: string;
  readonly residentName: string;
  readonly monthlyRent: number;
  readonly currencyCode: string;
  readonly endDateIso: string;
}

export const RENEWAL_LADDER_WINDOWS = [90, 60, 30] as const;
export type RenewalLadderWindow = (typeof RENEWAL_LADDER_WINDOWS)[number];

export interface LeaseRenewalPorts {
  listLeasesExpiringWithin(args: {
    readonly tenantId: string;
    readonly daysOut: number;
  }): Promise<ReadonlyArray<ExpiringLeaseRow>>;
  /**
   * Returns the most-recent reminder window (90/60/30) already sent
   * for the lease, or null when none has been sent. The handler picks
   * the next smaller window so reminders never loop.
   */
  mostRecentReminderWindow(args: {
    readonly tenantId: string;
    readonly leaseId: string;
  }): Promise<RenewalLadderWindow | null>;
}

export function pickNextLadderStep(
  lease: ExpiringLeaseRow,
  lastSentWindow: RenewalLadderWindow | null,
  now: Date,
): RenewalLadderWindow | null {
  const endTime = new Date(lease.endDateIso).getTime();
  const daysOut = Math.floor((endTime - now.getTime()) / 86_400_000);
  // Walk the ladder in descending order, pick the first window the
  // lease is INSIDE of, and skip if we've already sent that window.
  for (const window of RENEWAL_LADDER_WINDOWS) {
    if (daysOut <= window) {
      if (lastSentWindow !== null && lastSentWindow <= window) continue;
      return window;
    }
  }
  return null;
}

export function buildLeaseRenewalProposal(
  lease: ExpiringLeaseRow,
  window: RenewalLadderWindow,
): MwikilaHandlerProposal {
  const intent =
    window === 90
      ? 'informational'
      : window === 60
        ? 'propose_renewal_terms'
        : 'final_notice';
  const ladderLabel = `T-${window}`;
  return {
    actionKind: 'lease.renewal_reminder_ladder',
    category: 'lease-renewals',
    summary: `Renewal reminder ${ladderLabel} for ${lease.residentName} (unit ${lease.unitId}).`,
    summarySw: `Kumbusho la upya wa mkataba ${ladderLabel} kwa ${lease.residentName} (kitengo ${lease.unitId}).`,
    rationale:
      `Lease ends ${lease.endDateIso}. ${intent} reminder drafted. ` +
      `Owner reviews and one-tap-approves before any tenant outreach — ` +
      `T1 tier means no counterparty interaction without explicit approval.`,
    payload: {
      leaseId: lease.leaseId,
      unitId: lease.unitId,
      residentName: lease.residentName,
      monthlyRent: lease.monthlyRent,
      currencyCode: lease.currencyCode,
      endDateIso: lease.endDateIso,
      ladderWindow: window,
      intent,
    },
    amount: 0,
    currency: lease.currencyCode,
    targetRelation: 'tenant',
  };
}

export function createLeaseRenewalHandler(
  ports: LeaseRenewalPorts,
): MwikilaHandler {
  return Object.freeze({
    actionKind: 'lease.renewal_reminder_ladder',
    category: 'lease-renewals',
    async propose({ tenantId, now }) {
      const leases = await ports.listLeasesExpiringWithin({
        tenantId,
        daysOut: RENEWAL_LADDER_WINDOWS[0],
      });
      for (const lease of leases) {
        const lastSent = await ports.mostRecentReminderWindow({
          tenantId,
          leaseId: lease.leaseId,
        });
        const window = pickNextLadderStep(lease, lastSent, now);
        if (window !== null) {
          return buildLeaseRenewalProposal(lease, window);
        }
      }
      return null;
    },
  });
}
