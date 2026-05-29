/**
 * Opportunity Scanner — shared types (real-estate domain).
 *
 * Mr. Mwikila proactively scans the owner's full tenant state every turn
 * for UPSIDE: things the owner could do to save money, grow revenue
 * (vacancy + rent uplift), optimise tax, hit a regulatory window, route
 * capital better, time the rental market, switch a supplier, batch a
 * renewal, claim a subsidy.
 *
 * Ported from Borjie mining domain with real-estate-mapped ScanState
 * (vacancy, rent uplift, maintenance backlog, lease renewals, portfolio
 * growth) replacing mining-specific fields (fuel/BCM/royalty).
 *
 * Tenant isolation: every rule receives only the current tenant's
 * `ScanState` slice — built by the resolver layer using RLS-bound
 * Drizzle reads. No rule reaches across tenants.
 *
 * Never fabricate values. Every `expectedValue` / `savings` is grounded
 * in real resolver data; `null` is fine when the underlying figure is
 * unknown (the FE renders a soft "estimate pending" pill).
 */

import { z } from 'zod';

// ─── Opportunity kinds ──────────────────────────────────────────────

export const OPPORTUNITY_KINDS = [
  'cost_saving',
  'revenue',
  'tax_efficiency',
  'regulatory_window',
  'capital',
  'market_timing',
  'operational_arbitrage',
  'hr',
  'compliance_shortcut',
  'estate_planning',
  'counterparty',
  'peer_best_practice',
] as const;

export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

// ─── Required-action shape (one-click follow-up the FE can fire) ────

export const OpportunityActionSchema = z
  .object({
    action: z.string().min(1).max(80),
    target: z.string().min(1).max(120).optional(),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type OpportunityAction = z.infer<typeof OpportunityActionSchema>;

// ─── Bilingual headline + narrative ─────────────────────────────────

export const BilingualSchema = z
  .object({
    en: z.string().min(1).max(600),
    sw: z.string().min(1).max(600),
  })
  .strict();

export type Bilingual = z.infer<typeof BilingualSchema>;

// ─── Opportunity wire-shape ─────────────────────────────────────────

export const OpportunitySchema = z
  .object({
    id: z.string().min(1).max(80),
    kind: z.enum(OPPORTUNITY_KINDS),
    headline: BilingualSchema,
    narrative: BilingualSchema,
    /** Annualised primary-currency value (savings or revenue). */
    expectedValue: z.number().nonnegative().nullable().optional(),
    /** Discrete primary-currency savings figure (monthly or per-event). */
    savings: z.number().nonnegative().nullable().optional(),
    /** Currency code (TZS by default, KES + USD supported). */
    currencyCode: z.string().min(3).max(8).default('TZS'),
    /** 0 (low) — 1 (high). */
    confidence: z.number().min(0).max(1),
    /** Days the opportunity remains actionable; -1 = open-ended. */
    timeWindowDays: z.number().int(),
    requiresActions: z.array(OpportunityActionSchema).max(3).default([]),
    relatedScopes: z
      .array(z.string().min(1).max(40))
      .max(8)
      .default([]),
    citations: z
      .array(z.string().min(1).max(80))
      .max(8)
      .default([]),
  })
  .strict();

export type Opportunity = z.infer<typeof OpportunitySchema>;

// ─── Scan state — real-estate snapshot every rule inspects ──────────

/**
 * The materialised slice of tenant state the scanner passes to every
 * rule. Sourced lazily by the resolver layer — only the fields a rule
 * actually reads are filled (the rest are `null`).
 *
 * Keep this shape append-only; rules treat any unknown field as
 * `undefined` and degrade gracefully.
 */
export interface ScanState {
  readonly tenantId: string;
  readonly nowIso: string;
  readonly primaryCurrencyCode: string;

  // ── Portfolio + occupancy
  readonly portfolio?: {
    readonly totalUnits: number;
    readonly occupiedUnits: number;
    readonly vacantUnits: number;
    readonly vacancyRatePct: number | null;
    readonly portfolioRolePeerP25VacancyRatePct: number | null;
    readonly totalRentRollMonthly: number | null;
  } | null;

  // ── Rent + market signals
  readonly market?: {
    readonly avgMarketRentPerUnit: number | null;
    readonly portfolioAvgRentPerUnit: number | null;
    readonly tenantRentBelowMarketPct: number | null;
    readonly leasesExpiringIn90dCount: number;
  } | null;

  // ── Tax + regulator (housing authority)
  readonly tax?: {
    readonly traQuarterlyElectionDaysUntilDeadline: number | null;
    readonly currentWithholdingRatePct: number | null;
    readonly altWithholdingRatePct: number | null;
    readonly quarterlyRentReceiptsTax: number | null;
  } | null;

  readonly regulator?: {
    readonly housingAmnestyWindowOpen: boolean;
    readonly housingAmnestyDaysRemaining: number | null;
    readonly tenantQualifiesForAmnesty: boolean;
    readonly estimatedPenaltyAvoided: number | null;
  } | null;

  // ── Estate / portfolio + succession
  readonly estate?: {
    readonly subsidiaryCount: number;
    readonly intercompanySurplus: number | null;
    readonly holdingCoExists: boolean;
    readonly overdueSuccessionReviewCount: number;
  } | null;

  // ── Marketplace + leasing channels
  readonly marketplace?: {
    readonly latestListingViewRate30d: number | null;
    readonly bestPerformingChannelName: string | null;
    readonly worstPerformingChannelName: string | null;
  } | null;

  // ── Vendors (cleaning / repairs / security)
  readonly vendors?: {
    readonly categoriesWithMultipleSuppliers: ReadonlyArray<{
      readonly category: string;
      readonly supplierCount: number;
      readonly annualSpend: number;
    }>;
  } | null;

  // ── Workforce / staff
  readonly workforce?: {
    readonly apprenticeshipEligibleCount: number;
    readonly vetaSubsidyPerApprentice: number | null;
    readonly certExpiringIn60dCount: number;
    readonly perCertFee: number | null;
  } | null;

  // ── Insurance
  readonly insurance?: {
    readonly policyDueWithin60d: boolean;
    readonly currentAnnualPremium: number | null;
    readonly bestMarketQuote: number | null;
  } | null;

  // ── Peer cohort
  readonly peer?: {
    readonly tenantOccupancyPercentile: number | null;
    readonly p75Pattern: string | null;
    readonly tenantUsesP75Pattern: boolean;
  } | null;

  // ── Counterparties (corporate tenants, off-takers)
  readonly counterparties?: {
    readonly newCorporateLeasePremiumOpportunity: {
      readonly counterpartyId: string;
      readonly counterpartyName: string;
      readonly premiumOverMarketPct: number;
      readonly unitsRequested: number;
    } | null;
  } | null;

  // ── Energy + capital
  readonly energy?: {
    readonly currentGridTariffPerKwh: number | null;
    readonly solarHybridPerKwh: number | null;
    readonly monthlyKwhConsumption: number | null;
  } | null;

  readonly capital?: {
    readonly currentLoanRatePct: number | null;
    readonly tibBetterRatePct: number | null;
    readonly loanBalance: number | null;
    readonly cashOnHand: number | null;
    readonly idleCashOver90d: number | null;
    readonly tibillsYieldPct: number | null;
  } | null;

  // ── Operations (maintenance, turnover)
  readonly ops?: {
    readonly maintenanceBacklogCount: number;
    readonly maintenanceBacklogP25: number | null;
    readonly avgMoveOutTurnaroundDays: number | null;
    readonly turnaroundP25Days: number | null;
    readonly arrearsTotalAmount: number | null;
    readonly arrearsPeerP25Amount: number | null;
  } | null;
}

// ─── Scan rule interface ────────────────────────────────────────────

export interface ScanRule {
  readonly id: string;
  readonly kind: OpportunityKind;
  readonly requiresAction: boolean;
  /** Cheap predicate — runs before evaluate(); avoids work when not applicable. */
  detect(state: ScanState): boolean;
  /** Heavy evaluation — returns a full Opportunity. Only called when detect() is true. */
  evaluate(state: ScanState): Opportunity;
}
