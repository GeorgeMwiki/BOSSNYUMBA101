/**
 * Mr. Mwikila autonomous handlers — public surface (real-estate).
 *
 * Each handler is a pure-logic module: ports are injected so vitest
 * drives every branch without a real Postgres. Composition root wires
 * the Drizzle-backed ports.
 *
 * Five canonical handlers map onto the five most owner-anxious
 * recurring property-management tasks:
 *
 *   1. rent_scheduler        — next-period invoice drafting
 *   2. regulatory_filing     — quarterly housing-authority filings
 *   3. lease_renewal         — T-90/T-60/T-30 renewal ladder
 *   4. payroll_prep          — monthly batch prep
 *   5. listing_counter_offer — marketplace counter price drafts
 */

export {
  buildRentSchedulerProposal,
  createRentSchedulerHandler,
  type ActiveLeaseRow,
  type RentSchedulerPorts,
  type RentSchedulerOptions,
  type RentInvoiceDraft,
} from './rent-scheduler.js';

export {
  buildRegulatoryFilingProposal,
  createRegulatoryFilingHandler,
  type UpcomingFilingRow,
  type PortfolioSnapshotForFiling,
  type RegulatoryFilingPorts,
  type RegulatoryFilingOptions,
  type RegulatoryFilingDraft,
} from './regulatory-filing.js';

export {
  pickNextLadderStep,
  buildLeaseRenewalProposal,
  createLeaseRenewalHandler,
  RENEWAL_LADDER_WINDOWS,
  type ExpiringLeaseRow,
  type LeaseRenewalPorts,
  type RenewalLadderWindow,
} from './lease-renewal.js';

export {
  computePayrollRow,
  buildPayrollProposal,
  createPayrollHandler,
  type PayrollStaffRow,
  type AttendanceRow,
  type PayrollPorts,
  type PayrollComputedRow,
} from './payroll-prep.js';

export {
  computeCounterPrice,
  buildCounterOfferProposal,
  createListingCounterOfferHandler,
  type OpenBidRow,
  type SellerTargets,
  type ListingCounterOfferPorts,
} from './listing-counter-offer.js';
