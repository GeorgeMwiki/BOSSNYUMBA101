/**
 * Mwikila autonomous handlers — pure-logic unit tests.
 *
 * Drives every branch of the five canonical handlers with deterministic
 * inputs and fake ports. The handler-runtime + inviolable-rails are
 * exercised separately in handler-runtime.test.ts.
 */

import { describe, expect, it } from 'vitest';

import {
  buildRentSchedulerProposal,
  createRentSchedulerHandler,
} from '../handlers/rent-scheduler.js';
import {
  buildRegulatoryFilingProposal,
  createRegulatoryFilingHandler,
} from '../handlers/regulatory-filing.js';
import {
  pickNextLadderStep,
  buildLeaseRenewalProposal,
  createLeaseRenewalHandler,
  RENEWAL_LADDER_WINDOWS,
} from '../handlers/lease-renewal.js';
import {
  computePayrollRow,
  buildPayrollProposal,
  createPayrollHandler,
} from '../handlers/payroll-prep.js';
import {
  computeCounterPrice,
  buildCounterOfferProposal,
  createListingCounterOfferHandler,
} from '../handlers/listing-counter-offer.js';

const TENANT = 'tnt-1';
const ACTOR = 'usr-owner';
const NOW = new Date('2026-05-29T12:00:00Z');

describe('rent_scheduler — buildRentSchedulerProposal', () => {
  it('returns null on empty due-lease list', () => {
    const out = buildRentSchedulerProposal([]);
    expect(out).toBeNull();
  });

  it('drafts invoices and aggregates currencies', () => {
    const out = buildRentSchedulerProposal([
      {
        leaseId: 'l-1',
        tenantId: TENANT,
        unitId: 'u-1',
        residentName: 'Mary',
        monthlyRent: 45_000,
        currencyCode: 'TZS',
        nextBillDateIso: '2026-06-01',
      },
      {
        leaseId: 'l-2',
        tenantId: TENANT,
        unitId: 'u-2',
        residentName: 'James',
        monthlyRent: 1_200,
        currencyCode: 'KES',
        nextBillDateIso: '2026-06-01',
      },
    ]);
    expect(out).not.toBeNull();
    expect(out!.category).toBe('rent-scheduling');
    expect(out!.amount).toBe(0); // drafting doesn't move money
    expect(out!.payload['currencies']).toEqual(['TZS', 'KES']);
  });
});

describe('rent_scheduler — createRentSchedulerHandler skip path', () => {
  it('skips leases that already have an invoice for the billing month', async () => {
    const handler = createRentSchedulerHandler({
      async listActiveLeasesDueWithin() {
        return [
          {
            leaseId: 'l-1',
            tenantId: TENANT,
            unitId: 'u-1',
            residentName: 'Mary',
            monthlyRent: 45_000,
            currencyCode: 'TZS',
            nextBillDateIso: '2026-06-01',
          },
        ];
      },
      async invoiceAlreadyExists() {
        return true;
      },
    });
    const out = await handler.propose({
      tenantId: TENANT,
      actingOnUserId: ACTOR,
      now: NOW,
    });
    expect(out).toBeNull();
  });
});

describe('regulatory_filing — buildRegulatoryFilingProposal', () => {
  it('composes a draft with the snapshot', () => {
    const out = buildRegulatoryFilingProposal(
      {
        filingId: 'f-1',
        filingKind: 'rental_income_quarterly',
        authorityCode: 'KRA',
        periodLabel: 'Q1 2026',
        dueDateIso: '2026-04-15',
        jurisdictionCode: 'KE',
      },
      {
        totalUnits: 24,
        occupiedUnits: 21,
        grossRentCollected: 1_050_000,
        currencyCode: 'KES',
      },
    );
    expect(out.category).toBe('regulatory-filings');
    expect(out.payload['draft']).toMatchObject({
      filingKind: 'rental_income_quarterly',
      authorityCode: 'KRA',
    });
    expect(out.currency).toBe('KES');
    expect(out.targetRelation).toBe('counterparty');
  });
});

describe('lease_renewal — pickNextLadderStep', () => {
  const lease = {
    leaseId: 'l-1',
    unitId: 'u-1',
    residentName: 'Mary',
    monthlyRent: 45_000,
    currencyCode: 'TZS',
    endDateIso: '2026-08-01T00:00:00Z',
  };

  it('returns null when lease is > 90 days out', () => {
    const out = pickNextLadderStep(lease, null, new Date('2026-01-01'));
    expect(out).toBeNull();
  });

  it('picks 90 first when no prior reminder', () => {
    const out = pickNextLadderStep(lease, null, new Date('2026-05-29'));
    expect(out).toBe(90);
  });

  it('skips already-sent window', () => {
    const out = pickNextLadderStep(lease, 90, new Date('2026-06-15'));
    expect(out).toBe(60);
  });

  it('returns 30 when both 90 and 60 already sent and within T-30', () => {
    const closeLease = {
      ...lease,
      endDateIso: '2026-06-15T00:00:00Z',
    };
    const out = pickNextLadderStep(closeLease, 60, new Date('2026-06-01'));
    expect(out).toBe(30);
  });

  it('exposes the canonical ladder', () => {
    expect([...RENEWAL_LADDER_WINDOWS]).toEqual([90, 60, 30]);
  });
});

describe('lease_renewal — buildLeaseRenewalProposal', () => {
  it('chooses intent per window', () => {
    const lease = {
      leaseId: 'l-1',
      unitId: 'u-1',
      residentName: 'Mary',
      monthlyRent: 45_000,
      currencyCode: 'TZS',
      endDateIso: '2026-08-01T00:00:00Z',
    };
    expect(buildLeaseRenewalProposal(lease, 90).payload['intent']).toBe(
      'informational',
    );
    expect(buildLeaseRenewalProposal(lease, 60).payload['intent']).toBe(
      'propose_renewal_terms',
    );
    expect(buildLeaseRenewalProposal(lease, 30).payload['intent']).toBe(
      'final_notice',
    );
  });
});

describe('lease_renewal — createLeaseRenewalHandler', () => {
  it('returns the first lease needing a reminder', async () => {
    const handler = createLeaseRenewalHandler({
      async listLeasesExpiringWithin() {
        return [
          {
            leaseId: 'l-1',
            unitId: 'u-1',
            residentName: 'Mary',
            monthlyRent: 45_000,
            currencyCode: 'TZS',
            endDateIso: '2026-07-15T00:00:00Z',
          },
        ];
      },
      async mostRecentReminderWindow() {
        return null;
      },
    });
    const out = await handler.propose({
      tenantId: TENANT,
      actingOnUserId: ACTOR,
      now: NOW,
    });
    expect(out).not.toBeNull();
    expect(out!.actionKind).toBe('lease.renewal_reminder_ladder');
  });
});

describe('payroll_prep — computePayrollRow', () => {
  it('computes base + overtime', () => {
    const out = computePayrollRow(
      {
        staffId: 's-1',
        fullName: 'John',
        role: 'caretaker',
        baseSalary: 200_000,
        currencyCode: 'TZS',
        hourlyOvertimeRate: 2000,
      },
      { staffId: 's-1', hoursWorked: 160, overtimeHours: 5 },
    );
    expect(out.overtimePay).toBe(10_000);
    expect(out.totalPay).toBe(210_000);
  });

  it('treats missing attendance as zero overtime', () => {
    const out = computePayrollRow(
      {
        staffId: 's-1',
        fullName: 'John',
        role: 'caretaker',
        baseSalary: 200_000,
        currencyCode: 'TZS',
        hourlyOvertimeRate: 2000,
      },
      null,
    );
    expect(out.totalPay).toBe(200_000);
  });
});

describe('payroll_prep — buildPayrollProposal', () => {
  it('aggregates totals per currency', () => {
    const out = buildPayrollProposal(
      [
        {
          staffId: 's-1',
          fullName: 'John',
          role: 'caretaker',
          baseSalary: 200_000,
          currencyCode: 'TZS',
          hourlyOvertimeRate: 2000,
        },
        {
          staffId: 's-2',
          fullName: 'Mary',
          role: 'maintenance',
          baseSalary: 240_000,
          currencyCode: 'TZS',
          hourlyOvertimeRate: 1500,
        },
      ],
      [],
      '2026-04-01',
      '2026-04-30',
    );
    expect(out).not.toBeNull();
    expect(out!.payload['totalsByCurrency']).toEqual({ TZS: 440_000 });
    expect(out!.amount).toBe(440_000);
    expect(out!.targetRelation).toBe('staff');
  });

  it('returns null when no staff', () => {
    expect(buildPayrollProposal([], [], '2026-04-01', '2026-04-30')).toBeNull();
  });
});

describe('payroll_prep — handler skip path', () => {
  it('skips when batch already exists', async () => {
    const handler = createPayrollHandler({
      async listActiveStaff() {
        return [];
      },
      async listAttendanceFor() {
        return [];
      },
      async batchAlreadyExists() {
        return true;
      },
    });
    const out = await handler.propose({
      tenantId: TENANT,
      actingOnUserId: ACTOR,
      now: NOW,
    });
    expect(out).toBeNull();
  });
});

describe('listing_counter_offer — computeCounterPrice', () => {
  const targets = {
    listingId: 'lst-1',
    reservePrice: 1_000_000,
    idealPrice: 1_400_000,
    currencyCode: 'TZS',
  };

  it('returns null when bid is too low (< 70% of reserve)', () => {
    const out = computeCounterPrice(
      {
        bidId: 'b-1',
        listingId: 'lst-1',
        listingTitle: 'Westlands Apt #3B',
        buyerName: 'Buyer A',
        bidAmount: 500_000,
        currencyCode: 'TZS',
        openedAtIso: '2026-05-28',
      },
      targets,
    );
    expect(out).toBeNull();
  });

  it('counters at 60/40 weighted price within reserve..ideal', () => {
    const out = computeCounterPrice(
      {
        bidId: 'b-2',
        listingId: 'lst-1',
        listingTitle: 'Westlands Apt #3B',
        buyerName: 'Buyer B',
        bidAmount: 900_000,
        currencyCode: 'TZS',
        openedAtIso: '2026-05-28',
      },
      targets,
    );
    expect(out).toBe(Math.round(1_000_000 * 0.6 + 1_400_000 * 0.4));
  });

  it('accepts the bid when at-or-above ideal', () => {
    const out = computeCounterPrice(
      {
        bidId: 'b-3',
        listingId: 'lst-1',
        listingTitle: 'Westlands Apt #3B',
        buyerName: 'Buyer C',
        bidAmount: 1_500_000,
        currencyCode: 'TZS',
        openedAtIso: '2026-05-28',
      },
      targets,
    );
    expect(out).toBe(1_500_000);
  });

  it('never counters below reserve', () => {
    const lowTargets = {
      listingId: 'lst-1',
      reservePrice: 1_000_000,
      idealPrice: 1_010_000,
      currencyCode: 'TZS',
    };
    const out = computeCounterPrice(
      {
        bidId: 'b-4',
        listingId: 'lst-1',
        listingTitle: 'Westlands Apt #3B',
        buyerName: 'Buyer D',
        bidAmount: 800_000,
        currencyCode: 'TZS',
        openedAtIso: '2026-05-28',
      },
      lowTargets,
    );
    expect(out).toBeGreaterThanOrEqual(1_000_000);
  });
});

describe('listing_counter_offer — handler skip + first-eligible flow', () => {
  it('skips bids already countered', async () => {
    const handler = createListingCounterOfferHandler({
      async listOpenBids() {
        return [
          {
            bidId: 'b-1',
            listingId: 'lst-1',
            listingTitle: 'Westlands Apt #3B',
            buyerName: 'Buyer A',
            bidAmount: 1_100_000,
            currencyCode: 'TZS',
            openedAtIso: '2026-05-28',
          },
        ];
      },
      async hasAlreadyCountered() {
        return true;
      },
      async getSellerTargets() {
        return null;
      },
    });
    const out = await handler.propose({
      tenantId: TENANT,
      actingOnUserId: ACTOR,
      now: NOW,
    });
    expect(out).toBeNull();
  });

  it('builds a counter for the first eligible bid', async () => {
    const handler = createListingCounterOfferHandler({
      async listOpenBids() {
        return [
          {
            bidId: 'b-1',
            listingId: 'lst-1',
            listingTitle: 'Westlands Apt #3B',
            buyerName: 'Buyer A',
            bidAmount: 1_100_000,
            currencyCode: 'TZS',
            openedAtIso: '2026-05-28',
          },
        ];
      },
      async hasAlreadyCountered() {
        return false;
      },
      async getSellerTargets() {
        return {
          listingId: 'lst-1',
          reservePrice: 1_000_000,
          idealPrice: 1_400_000,
          currencyCode: 'TZS',
        };
      },
    });
    const out = await handler.propose({
      tenantId: TENANT,
      actingOnUserId: ACTOR,
      now: NOW,
    });
    expect(out).not.toBeNull();
    expect(out!.category).toBe('listing-counter-offers');
    expect(out!.payload['counterPrice']).toBeGreaterThan(1_000_000);
  });
});

describe('counter-offer — builds a proposal directly', () => {
  it('records both prices in payload and human-readable strings bilingual', () => {
    const out = buildCounterOfferProposal(
      {
        bidId: 'b-1',
        listingId: 'lst-1',
        listingTitle: 'Westlands Apt #3B',
        buyerName: 'Buyer A',
        bidAmount: 1_100_000,
        currencyCode: 'TZS',
        openedAtIso: '2026-05-28',
      },
      {
        listingId: 'lst-1',
        reservePrice: 1_000_000,
        idealPrice: 1_400_000,
        currencyCode: 'TZS',
      },
      1_160_000,
    );
    expect(out.summary).toContain('1,160,000');
    expect(out.summarySw).toContain('Bei mbadala');
    expect(out.payload['counterPrice']).toBe(1_160_000);
  });
});

describe('rent_scheduler — handler emits proposal when due', () => {
  it('passes the lease through to the proposal', async () => {
    const handler = createRentSchedulerHandler({
      async listActiveLeasesDueWithin() {
        return [
          {
            leaseId: 'l-1',
            tenantId: TENANT,
            unitId: 'u-1',
            residentName: 'Mary',
            monthlyRent: 45_000,
            currencyCode: 'TZS',
            nextBillDateIso: '2026-06-01',
          },
        ];
      },
      async invoiceAlreadyExists() {
        return false;
      },
    });
    const out = await handler.propose({
      tenantId: TENANT,
      actingOnUserId: ACTOR,
      now: NOW,
    });
    expect(out).not.toBeNull();
    expect(out!.actionKind).toBe('rent.next_period_invoice_draft');
  });
});

describe('regulatory_filing — handler emits null when no upcoming', () => {
  it('returns null when no filing is due', async () => {
    const handler = createRegulatoryFilingHandler({
      async listUpcomingFilingsWithin() {
        return [];
      },
      async snapshotPortfolioForFiling() {
        return {
          totalUnits: 0,
          occupiedUnits: 0,
          grossRentCollected: 0,
          currencyCode: 'TZS',
        };
      },
    });
    const out = await handler.propose({
      tenantId: TENANT,
      actingOnUserId: ACTOR,
      now: NOW,
    });
    expect(out).toBeNull();
  });
});
