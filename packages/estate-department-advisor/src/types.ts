/**
 * @bossnyumba/estate-department-advisor — public types.
 *
 * Veteran-expert "head of estate-department" types. Every advisor
 * function receives structured inputs (zod-validated where they cross
 * the package boundary) and returns structured recommendations with
 * a 1-2-sentence rationale + citation.
 *
 * Tenant scoping: every public input carries a `tenantId` so the
 * type system blocks cross-tenant data leak.
 */

import { z } from 'zod';

// -------------------------------------------------------------
// Branding + core primitives
// -------------------------------------------------------------

export type TenantId = string & { readonly __brand: 'TenantId' };

export const tenantIdSchema = z
  .string()
  .min(1)
  .max(64)
  .transform((s) => s as TenantId);

export type Jurisdiction = 'TZ' | 'KE' | 'UG' | 'NG' | 'RW' | 'ZA' | 'US';

export const jurisdictionSchema = z.enum([
  'TZ',
  'KE',
  'UG',
  'NG',
  'RW',
  'ZA',
  'US',
]);

export type AssetClass =
  | 'multifamily'
  | 'office'
  | 'retail'
  | 'industrial'
  | 'hotel'
  | 'mixed-use'
  | 'land';

export const assetClassSchema = z.enum([
  'multifamily',
  'office',
  'retail',
  'industrial',
  'hotel',
  'mixed-use',
  'land',
]);

// EA-simplified asset class (residential / commercial / mixed / industrial)
export type EaAssetClass =
  | 'residential'
  | 'commercial'
  | 'mixed-use'
  | 'industrial';

// -------------------------------------------------------------
// Portfolio + property snapshot
// -------------------------------------------------------------

export interface PropertySnapshot {
  readonly propertyId: string;
  readonly name: string;
  readonly assetClass: AssetClass;
  readonly jurisdiction: Jurisdiction;
  readonly city: string;
  readonly subMarket: string;
  readonly doors: number; // unit count (multifamily) or 1
  readonly rentableSf: number;
  readonly marketValueUsd: number;
  readonly mortgageBalanceUsd: number;
  readonly annualNoiUsd: number;
  readonly annualOpexUsd: number;
  readonly annualRevenueUsd: number;
  readonly occupancyRate: number; // 0..1
  readonly avgLeaseEndsAtMs: number; // weighted avg
  readonly anchorTenantSharePct: number; // 0..1; top tenant share of rent
  readonly entryCapRate: number; // at acquisition
  readonly currentMarketCapRate: number;
  readonly basisUsd: number; // depreciable basis
}

export interface PortfolioSnapshot {
  readonly tenantId: TenantId;
  readonly snapshotAtMs: number;
  readonly properties: ReadonlyArray<PropertySnapshot>;
  readonly cashReserveUsd: number;
  readonly annualPayrollUsd: number;
  readonly fteHeadcount: ReadonlyArray<HeadcountByRole>;
  readonly insurancePolicies: ReadonlyArray<InsurancePolicy>;
  readonly vendors: ReadonlyArray<VendorSpend>;
  readonly ownerArchetype: OwnerArchetype;
  readonly ownerEquityUsd: number;
  readonly holdingHurdleIrr: number; // e.g. 0.12 = 12 %
}

// -------------------------------------------------------------
// Org / staffing
// -------------------------------------------------------------

export type Role =
  | 'property-manager'
  | 'senior-pm'
  | 'regional-pm'
  | 'director-ops'
  | 'asset-manager'
  | 'leasing-agent'
  | 'leasing-manager'
  | 'accounting-manager'
  | 'accountant'
  | 'maintenance-tech'
  | 'maintenance-supervisor'
  | 'admin';

export const roleSchema = z.enum([
  'property-manager',
  'senior-pm',
  'regional-pm',
  'director-ops',
  'asset-manager',
  'leasing-agent',
  'leasing-manager',
  'accounting-manager',
  'accountant',
  'maintenance-tech',
  'maintenance-supervisor',
  'admin',
]);

export interface HeadcountByRole {
  readonly role: Role;
  readonly fte: number; // can be fractional
  readonly avgSalaryUsd: number;
  readonly avgBonusPct: number;
  readonly avgTenureMonths: number;
}

// -------------------------------------------------------------
// Vendors
// -------------------------------------------------------------

export type VendorCategory =
  | 'janitorial'
  | 'landscaping'
  | 'hvac'
  | 'plumbing'
  | 'electrical'
  | 'security'
  | 'legal'
  | 'accounting'
  | 'insurance'
  | 'it'
  | 'major-capex'
  | 'pest-control'
  | 'other';

export const vendorCategorySchema = z.enum([
  'janitorial',
  'landscaping',
  'hvac',
  'plumbing',
  'electrical',
  'security',
  'legal',
  'accounting',
  'insurance',
  'it',
  'major-capex',
  'pest-control',
  'other',
]);

export interface VendorSpend {
  readonly vendorId: string;
  readonly vendorName: string;
  readonly category: VendorCategory;
  readonly annualSpendUsd: number;
  readonly contractType: 'fixed-bid' | 't-and-m' | 'warranty' | 'performance-based' | 'hourly';
  readonly responseTimeP50Hours: number;
  readonly firstTimeFixRate: number; // 0..1
  readonly costVariancePct: number; // signed
  readonly qualityScore: number; // 0..5
  readonly contractEndsAtMs: number;
}

// -------------------------------------------------------------
// Insurance
// -------------------------------------------------------------

export type CoverageAxis =
  | 'all-risk-property'
  | 'business-interruption'
  | 'ordinance-and-law'
  | 'equipment-breakdown'
  | 'general-liability'
  | 'umbrella'
  | 'cyber'
  | 'epli'
  | 'd-and-o'
  | 'terrorism';

export interface InsurancePolicy {
  readonly policyId: string;
  readonly axis: CoverageAxis;
  readonly carrier: string;
  readonly perOccurrenceLimitUsd: number;
  readonly aggregateLimitUsd: number;
  readonly deductibleUsd: number;
  readonly annualPremiumUsd: number;
  readonly expiresAtMs: number;
  readonly replacementCostBased: boolean;
}

// -------------------------------------------------------------
// Owner relations
// -------------------------------------------------------------

export type OwnerArchetype =
  | 'cashflow-first'
  | 'growth-acquisitive'
  | 'exit-prep'
  | 'preservation-legacy'
  | 'institutional'
  | 'passive-landlord'
  | 'active-investor'
  | 'distressed-forced-sale';

export const ownerArchetypeSchema = z.enum([
  'cashflow-first',
  'growth-acquisitive',
  'exit-prep',
  'preservation-legacy',
  'institutional',
  'passive-landlord',
  'active-investor',
  'distressed-forced-sale',
]);

export type CommCadence = 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annual' | 'ad-hoc';

export interface OwnerCommsPattern {
  readonly archetype: OwnerArchetype;
  readonly cadence: CommCadence;
  readonly mustInclude: ReadonlyArray<string>;
  readonly avoid: ReadonlyArray<string>;
  readonly rationale: string;
  readonly citation: string;
}

// -------------------------------------------------------------
// Reports + recommendations
// -------------------------------------------------------------

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type RecommendationKind =
  | 'portfolio'
  | 'operations'
  | 'org-staffing'
  | 'vendor'
  | 'risk-insurance'
  | 'tax'
  | 'owner-relations'
  | 'tenant-strategy'
  | 'crisis'
  | 'regulatory-compliance';

export interface Recommendation {
  readonly id: string;
  readonly kind: RecommendationKind;
  readonly severity: Severity;
  readonly headline: string; // one-line action
  readonly rationale: string; // 1-2 sentences WHY
  readonly citation: string;
  readonly estimatedIrrPct?: number;
  readonly estimatedCostUsd?: number;
  readonly dueByMs?: number;
  readonly ownerRole?: Role;
  readonly strategicScore: number; // 0..1 fit with owner intent
  readonly urgencyScore: number; // 0..1
  readonly composite: number; // 0.45·strategic + 0.30·IRR_n + 0.25·urgency
}

export interface OpsExcellenceReport {
  readonly tenantId: TenantId;
  readonly opexPerSfActual: number;
  readonly opexPerSfPeerP50: number;
  readonly opexPerSfPeerP25: number;
  readonly opexPerSfPeerP75: number;
  readonly percentile: number; // where this portfolio sits
  readonly controllableGapPct: number; // signed
  readonly uncontrollableGapPct: number; // signed
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly citations: ReadonlyArray<string>;
}

export interface StaffingAdvice {
  readonly tenantId: TenantId;
  readonly currentDoorsPerPmFte: number;
  readonly targetDoorsPerPmFte: number;
  readonly currentSfPerMaintFte: number;
  readonly targetSfPerMaintFte: number;
  readonly spanOfControlFlags: ReadonlyArray<string>;
  readonly compDriftByRole: ReadonlyArray<{
    role: Role;
    actualBase: number;
    benchmarkP50: number;
    deltaPct: number;
  }>;
  readonly recommendations: ReadonlyArray<Recommendation>;
}

export interface RiskGap {
  readonly axis: CoverageAxis;
  readonly required: boolean;
  readonly covered: boolean;
  readonly limitGapUsd: number;
  readonly notes: string;
  readonly severity: Severity;
}

export interface RiskReport {
  readonly tenantId: TenantId;
  readonly gaps: ReadonlyArray<RiskGap>;
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly captiveRecommended: boolean;
  readonly catastropheExposures: ReadonlyArray<string>;
}

export interface TaxOpportunity {
  readonly id: string;
  readonly kind: 'cost-seg' | '1031' | 'appeal' | 'structure';
  readonly headline: string;
  readonly estimatedSavingsUsd: number;
  readonly windowEndsAtMs?: number;
  readonly rationale: string;
  readonly citation: string;
  readonly jurisdiction: Jurisdiction;
}

export interface CrisisPlaybook {
  readonly incident: CrisisIncident;
  readonly triageMatrix: ReadonlyArray<TriageEntry>;
  readonly first72Hours: ReadonlyArray<PlaybookAction>;
  readonly day30Recovery: ReadonlyArray<PlaybookAction>;
  readonly postMortemTemplate: ReadonlyArray<string>; // section headings
  readonly citation: string;
}

export type CrisisIncident =
  | 'fire'
  | 'flood'
  | 'eviction-mass'
  | 'lawsuit-served'
  | 'loan-default'
  | 'fraud-discovered'
  | 'ransomware'
  | 'employee-misconduct';

export interface TriageEntry {
  readonly conditionLabel: string;
  readonly severity: Severity;
  readonly immediateOwner: Role | 'external-counsel' | 'external-ir-firm';
  readonly notifyWithinHours: number;
}

export interface PlaybookAction {
  readonly orderInSequence: number;
  readonly action: string;
  readonly owner: Role | 'external-counsel' | 'external-ir-firm' | 'insurer' | 'lender';
  readonly slaHours: number;
}

export interface RegulatoryCalendarEntry {
  readonly id: string;
  readonly jurisdiction: Jurisdiction;
  readonly filingName: string;
  readonly cadence: 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'per-event';
  readonly windowOpensIso: string; // MM-DD or relative description
  readonly windowClosesIso: string;
  readonly authority: string;
  readonly citation: string;
}

export interface DepartmentHealthReport {
  readonly tenantId: TenantId;
  readonly generatedAtMs: number;
  readonly headline: ReadonlyArray<string>; // 3 bullets — veteran-director voice
  readonly sections: ReadonlyArray<HealthSection>;
  readonly topRecommendations: ReadonlyArray<Recommendation>; // top 5 by composite
  readonly narrative?: string; // optional LLM-synthesised
}

export interface HealthSection {
  readonly kind: RecommendationKind;
  readonly title: string;
  readonly summary: string;
  readonly recommendations: ReadonlyArray<Recommendation>;
}

// -------------------------------------------------------------
// LLM port (optional narrative)
// -------------------------------------------------------------

export interface MultiLLMSynthesizer {
  synthesize(input: {
    readonly tenantId: TenantId;
    readonly report: DepartmentHealthReport;
    readonly tone: 'veteran-director' | 'investor-deck' | 'crisis-brief';
  }): Promise<string>;
}

// -------------------------------------------------------------
// Pure validators
// -------------------------------------------------------------

export const propertySnapshotSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1),
  assetClass: assetClassSchema,
  jurisdiction: jurisdictionSchema,
  city: z.string().min(1),
  subMarket: z.string().min(1),
  doors: z.number().int().nonnegative(),
  rentableSf: z.number().nonnegative(),
  marketValueUsd: z.number().nonnegative(),
  mortgageBalanceUsd: z.number().nonnegative(),
  annualNoiUsd: z.number(),
  annualOpexUsd: z.number().nonnegative(),
  annualRevenueUsd: z.number().nonnegative(),
  occupancyRate: z.number().min(0).max(1),
  avgLeaseEndsAtMs: z.number().nonnegative(),
  anchorTenantSharePct: z.number().min(0).max(1),
  entryCapRate: z.number(),
  currentMarketCapRate: z.number(),
  basisUsd: z.number().nonnegative(),
});
