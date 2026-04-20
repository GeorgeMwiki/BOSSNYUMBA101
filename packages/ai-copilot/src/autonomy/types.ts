/**
 * Autonomy types — Wave-13 Autonomous Department Mode.
 *
 * The head of estates configures a single AutonomyPolicy per tenant that
 * tells Mr. Mwikila exactly what he may do on his own authority, what he
 * must surface for approval, and who to escalate to when the trail runs
 * out. Every domain has its own rule block so heads can delegate finance
 * aggressively while keeping compliance on tight rails.
 *
 * Shapes mirror the Drizzle schema at
 * `packages/database/src/schemas/autonomy.schema.ts` — the `policyJson`
 * column carries the serialised `AutonomyPolicy` without its tenantId
 * (that lives in the row's primary key).
 */

export type AutonomyDomain =
  | 'finance'
  | 'leasing'
  | 'maintenance'
  | 'compliance'
  | 'communications';

export const AUTONOMY_DOMAINS: readonly AutonomyDomain[] = [
  'finance',
  'leasing',
  'maintenance',
  'compliance',
  'communications',
] as const;

export type AutonomyActionType =
  | 'auto_send'
  | 'auto_approve'
  | 'threshold'
  | 'escalation'
  | 'review_window'
  | 'disabled';

export const AUTONOMY_ACTION_TYPES: readonly AutonomyActionType[] = [
  'auto_send',
  'auto_approve',
  'threshold',
  'escalation',
  'review_window',
  'disabled',
] as const;

/**
 * Finance — collections, receipts, refunds, waivers.
 */
export interface FinancePolicy {
  readonly autoSendReminders: boolean;
  /** Day offsets from invoice due-date at which reminders auto-send. */
  readonly reminderDayOffsets: readonly number[];
  readonly autoApproveRefundsMinorUnits: number;
  readonly autoApproveWaiversMinorUnits: number;
  /** Above this balance an arrears case is escalated instead of auto-actioned. */
  readonly escalateArrearsAboveMinorUnits: number;
}

/**
 * Leasing — applications, renewals, terminations.
 */
export interface LeasingPolicy {
  readonly autoApproveRenewalsSameTerms: boolean;
  readonly maxAutoApproveRentIncreasePct: number;
  readonly autoApproveApplicationScoreMin: number;
  readonly autoSendOfferLetters: boolean;
}

/**
 * Maintenance — work-order approvals.
 */
export interface MaintenancePolicy {
  readonly autoApproveBelowMinorUnits: number;
  readonly autoDispatchTrustedVendors: boolean;
  readonly autoCloseResolvedTickets: boolean;
  readonly escalateSafetyCriticalImmediately: boolean;
}

/**
 * Compliance — licences, notices, regulatory communications.
 */
export interface CompliancePolicy {
  readonly autoDraftNotices: boolean;
  /** Legal notices NEVER auto-send — safety-critical default. */
  readonly autoSendLegalNotices: false;
  readonly autoRenewLicencesBefore: number;
  readonly escalateOnNewRegulation: boolean;
}

/**
 * Communications — tenant / owner messaging tone + templates.
 */
export interface CommunicationsPolicy {
  readonly autoSendRoutineUpdates: boolean;
  readonly autoTranslateToTenantLanguage: boolean;
  readonly escalateNegativeSentimentScoreBelow: number;
  readonly quietHoursStartHour: number;
  readonly quietHoursEndHour: number;
}

export interface EscalationContacts {
  readonly primaryUserId: string | null;
  readonly secondaryUserId: string | null;
  readonly fallbackEmails: readonly string[];
}

/** Full per-tenant policy. Stored as `policyJson` + related row columns. */
export interface AutonomyPolicy {
  readonly tenantId: string;
  readonly autonomousModeEnabled: boolean;
  readonly finance: FinancePolicy;
  readonly leasing: LeasingPolicy;
  readonly maintenance: MaintenancePolicy;
  readonly compliance: CompliancePolicy;
  readonly communications: CommunicationsPolicy;
  readonly escalation: EscalationContacts;
  readonly version: number;
  readonly updatedAt: string;
  readonly updatedBy: string | null;
}

/** What a consumer passes when asking whether an autonomous action is allowed. */
export interface AuthorizeContext {
  readonly amountMinorUnits?: number;
  readonly rentIncreasePct?: number;
  readonly isLegalNotice?: boolean;
  readonly isSafetyCritical?: boolean;
  readonly applicationScore?: number;
  readonly sentimentScore?: number;
  readonly vendorIsTrusted?: boolean;
}

export interface AuthorizationDecision {
  readonly authorized: boolean;
  readonly requiresApproval: boolean;
  readonly escalateTo: string | null;
  readonly reason: string;
  readonly policyRuleMatched: string;
}

export interface AutonomyPolicyRepository {
  get(tenantId: string): Promise<AutonomyPolicy | null>;
  upsert(policy: AutonomyPolicy): Promise<AutonomyPolicy>;
}

/** Inputs accepted by updatePolicy — any subset of domain blocks. */
export interface UpdatePolicyInput {
  readonly autonomousModeEnabled?: boolean;
  readonly finance?: Partial<FinancePolicy>;
  readonly leasing?: Partial<LeasingPolicy>;
  readonly maintenance?: Partial<MaintenancePolicy>;
  readonly compliance?: Partial<CompliancePolicy>;
  readonly communications?: Partial<CommunicationsPolicy>;
  readonly escalation?: Partial<EscalationContacts>;
  readonly updatedBy?: string;
}
