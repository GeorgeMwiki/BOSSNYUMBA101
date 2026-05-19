/**
 * Entity types for the BOSSNYUMBA-INTERNAL vertical.
 *
 * These are the org-running-itself nouns. They are DELIBERATELY distinct
 * from the property-management entities so the internal-admin chat and
 * the owner-customer chat can never cross-contaminate.
 *
 * The internal-admin sub-MDs run on the SAME substrate, but scope is
 * keyed to BOSSNYUMBA's own departmentId / teamId — not propertyId.
 */

export type InternalEntityType =
  | 'candidate'
  | 'interview-slot'
  | 'recruiter'
  | 'owner-account'
  | 'churn-signal'
  | 'cs-touchpoint'
  | 'employee'
  | 'payroll-run'
  | 'salary-bank-debit'
  | 'internal-vendor'
  | 'internal-invoice'
  | 'internal-payment'
  | 'ops-incident'
  | 'oncall-team';

export const INTERNAL_ENTITY_TYPES: ReadonlyArray<InternalEntityType> = Object.freeze([
  'candidate',
  'interview-slot',
  'recruiter',
  'owner-account',
  'churn-signal',
  'cs-touchpoint',
  'employee',
  'payroll-run',
  'salary-bank-debit',
  'internal-vendor',
  'internal-invoice',
  'internal-payment',
  'ops-incident',
  'oncall-team',
]);

// ─────────────────────────────────────────────────────────────────────
// HR
// ─────────────────────────────────────────────────────────────────────

export type RoleFamily = 'engineering' | 'sales' | 'cs' | 'ops' | 'finance' | 'design';
export type SeniorityBand = 'junior' | 'mid' | 'senior' | 'staff' | 'principal';

export interface CandidateSubmission {
  readonly id: string;
  readonly tenantId: string;
  readonly fullName: string;
  readonly roleApplied: string;
  readonly roleFamily: RoleFamily;
  readonly seniority: SeniorityBand;
  readonly cvSummary: string;
  readonly applicationAtMs: number;
  readonly source: 'inbound-application' | 'referral' | 'sourced';
  readonly yearsExperience: number;
}

export interface RecruiterCandidate {
  readonly id: string;
  readonly displayName: string;
  readonly roleFamily: RoleFamily;
  /** Bandwidth: open slots remaining this week. */
  readonly bandwidth: number;
  readonly avgTimeToFirstScreenHours: number;
}

// ─────────────────────────────────────────────────────────────────────
// Sales / CS — proactive churn surfacing
// ─────────────────────────────────────────────────────────────────────

export type ChurnSignalKind =
  | 'usage-drop'
  | 'payment-failure'
  | 'support-spike'
  | 'csat-drop'
  | 'competitor-mention'
  | 'feature-request-stalled';

export interface OwnerAccount {
  readonly id: string;
  readonly tenantId: string;
  readonly displayName: string;
  readonly seatCount: number;
  readonly arrUsdMinor: number;
  readonly tenureMonths: number;
  readonly lastActiveAtMs: number;
  /**
   * Pre-computed risk score from a feature-store (0..1). The sub-MD
   * may use it directly or recompute from raw signals.
   */
  readonly riskScore?: number;
}

export interface ChurnSignal {
  readonly id: string;
  readonly ownerAccountId: string;
  readonly kind: ChurnSignalKind;
  readonly observedAtMs: number;
  readonly severityScore: number;
  readonly notes: string;
}

// ─────────────────────────────────────────────────────────────────────
// Customer-success compile inputs
// ─────────────────────────────────────────────────────────────────────

export interface CsTouchpoint {
  readonly id: string;
  readonly ownerAccountId: string;
  readonly channel: 'email' | 'sms' | 'call' | 'inbox';
  readonly atMs: number;
  readonly summary: string;
  readonly outcome: 'resolved' | 'pending' | 'escalated';
}

// ─────────────────────────────────────────────────────────────────────
// Payroll
// ─────────────────────────────────────────────────────────────────────

export interface PayrollLedgerRow {
  readonly id: string;
  readonly employeeId: string;
  readonly grossMinor: number;
  readonly netMinor: number;
  readonly currency: string;
  readonly periodStartMs: number;
  readonly periodEndMs: number;
  readonly statutoryDeductions: Readonly<Record<string, number>>;
}

// ─────────────────────────────────────────────────────────────────────
// Vendor reconcile
// ─────────────────────────────────────────────────────────────────────

export interface InternalInvoice {
  readonly id: string;
  readonly vendorId: string;
  readonly issuedAtMs: number;
  readonly amountMinor: number;
  readonly currency: string;
  readonly poRef?: string;
}

export interface InternalPayment {
  readonly id: string;
  readonly vendorId: string;
  readonly settledAtMs: number;
  readonly amountMinor: number;
  readonly currency: string;
  readonly invoiceRef?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Ops incident
// ─────────────────────────────────────────────────────────────────────

export type IncidentSurface =
  | 'api-gateway'
  | 'central-intelligence'
  | 'database'
  | 'payments-ledger'
  | 'frontend-owner'
  | 'frontend-admin'
  | 'connectors';

export interface OpsIncident {
  readonly id: string;
  readonly tenantId: string;
  readonly surface: IncidentSurface;
  readonly observedAtMs: number;
  readonly alertText: string;
  readonly errorRate?: number;
  readonly latencyP95Ms?: number;
  readonly affectedTenantCount: number;
}

export interface OncallTeamMember {
  readonly id: string;
  readonly displayName: string;
  readonly surfaces: ReadonlyArray<IncidentSurface>;
  readonly currentPagedCount: number;
  readonly bandwidth: number;
}
