/**
 * @bossnyumba/domain-risk-safeguards — public types.
 *
 * Substrate types for BOSSNYUMBA-specific domain-risk safeguards. The
 * package is wire-agnostic: every external dependency is a Port (suffix
 * `Port`), and verdicts are plain frozen objects so consumers can route
 * them through any I/O layer.
 */

// ---------------------------------------------------------------------------
// Disparate-Impact Audit (HUD May-2024 + EU AI Act + SafeRent settlement)
// ---------------------------------------------------------------------------

/**
 * Action class that an MD-tier decision belongs to. Disparate-impact audit
 * only fires on classes that touch HUD-protected outcomes.
 */
export type ScreeningActionClass =
  | 'tenant-screening-approve'
  | 'tenant-screening-deny'
  | 'lease-renewal'
  | 'lease-non-renewal'
  | 'rent-adjustment'
  | 'security-deposit-amount';

/**
 * Protected-class proxies BOSSNYUMBA tracks. We track *proxies* — we do not
 * collect protected-class data directly without consent. Quarterly audits
 * compare outcome distributions across proxy buckets.
 *
 * - `tz-protected-class-act-2010` — Tanzanian Persons with Disabilities Act
 *   2010 + UN-charter-aligned protected classes.
 * - `gender-from-name` — name-derived gender proxy (low confidence, audit only).
 * - `nationality-from-id` — ID-prefix-derived nationality.
 * - `age-bucket` — age decade (under-25, 25-34, 35-44, 45-54, 55-64, 65+).
 * - `disability-flag` — declared via accessibility-request channel.
 * - `single-parent-flag` — declared via tenant profile.
 *
 * NOTE: explicit consent must precede storage of any of these. The audit
 * runs on aggregate counts, never on identifiable records.
 */
export type ProtectedClassProxy =
  | 'tz-protected-class-act-2010'
  | 'gender-from-name'
  | 'nationality-from-id'
  | 'age-bucket'
  | 'disability-flag'
  | 'single-parent-flag';

/**
 * A single decision record fed to the DI audit. Holds the action class +
 * the (anonymous) protected-class bucket + the outcome (approve/deny).
 */
export interface DecisionRecord {
  readonly decisionId: string;
  readonly tenantId: string;
  readonly actionClass: ScreeningActionClass;
  readonly proxy: ProtectedClassProxy;
  readonly bucket: string;
  readonly outcome: 'approve' | 'deny';
  readonly decidedAt: string; // ISO timestamp
}

/**
 * Output of a 4/5ths-rule check on a single (actionClass, proxy) cohort.
 */
export interface FourFifthsResult {
  readonly proxy: ProtectedClassProxy;
  readonly actionClass: ScreeningActionClass;
  readonly bucketRates: ReadonlyArray<{
    readonly bucket: string;
    readonly approveRate: number;
    readonly totalDecisions: number;
  }>;
  readonly highestRate: number;
  readonly lowestRate: number;
  readonly impactRatio: number;
  readonly passes: boolean;
}

/**
 * Output of a Chi-squared independence test on outcome × bucket.
 */
export interface ChiSquaredResult {
  readonly proxy: ProtectedClassProxy;
  readonly actionClass: ScreeningActionClass;
  readonly degreesOfFreedom: number;
  readonly chiSquared: number;
  readonly criticalAt0p05: number;
  readonly rejectsNull: boolean;
}

/**
 * Output of a Cohen's d effect-size measure on approve-rate differences.
 */
export interface CohensDResult {
  readonly proxy: ProtectedClassProxy;
  readonly actionClass: ScreeningActionClass;
  readonly d: number;
  readonly magnitude: 'small' | 'medium' | 'large' | 'negligible';
}

/**
 * Composite verdict — a (action, proxy) cohort either passes or surfaces a
 * disparate-impact concern.
 */
export interface DisparateImpactVerdict {
  readonly tenantId: string;
  readonly actionClass: ScreeningActionClass;
  readonly proxy: ProtectedClassProxy;
  readonly fourFifths: FourFifthsResult;
  readonly chiSquared: ChiSquaredResult;
  readonly cohensD: CohensDResult;
  readonly verdict: 'pass' | 'concern' | 'breach';
  readonly mitigationCitations: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Skill-Promotion HARD Gate (Voyager runaway prevention)
// ---------------------------------------------------------------------------

/**
 * A skill candidate that Voyager / the K-C skill curator is asking to
 * promote from "candidate" to "active" status.
 */
export interface SkillPromotionCandidate {
  readonly skillId: string;
  readonly scope: 'platform' | 'tenant';
  readonly tenantId: string | null;
  readonly successfulRuns: number;
  readonly catastrophicFailures: number;
  readonly ownerFeedback: 'positive' | 'neutral' | 'negative' | 'none';
  readonly proposedBy: string;
  readonly proposedAt: string;
}

/**
 * Human approver record — the gate REQUIRES one of these to promote.
 */
export interface SkillPromotionApproval {
  readonly approverId: string;
  readonly approverRole: 'platform-admin' | 'tenant-owner';
  readonly approverScope: 'platform' | 'tenant';
  readonly approvedAt: string;
  readonly approvalNote: string;
}

/**
 * The HARD gate's verdict. `approve` requires *both* metric thresholds
 * AND a human approval record matching the candidate's scope.
 */
export type SkillPromotionVerdict =
  | { readonly kind: 'approve'; readonly skillId: string; readonly approval: SkillPromotionApproval }
  | { readonly kind: 'deny-metric-threshold'; readonly skillId: string; readonly reason: string }
  | { readonly kind: 'deny-missing-human-approval'; readonly skillId: string; readonly reason: string }
  | { readonly kind: 'deny-scope-mismatch'; readonly skillId: string; readonly reason: string }
  | { readonly kind: 'quarantine'; readonly skillId: string; readonly reason: string };

// ---------------------------------------------------------------------------
// Klarna-Pattern Human-in-Loop Wrap
// ---------------------------------------------------------------------------

/**
 * Action classes that the Klarna-pattern wrap intercepts. Each class is
 * judgement-heavy and historically the Klarna-failure category. MD draftss
 * + routes, but NEVER auto-executes.
 */
export type KlarnaActionClass =
  | 'rent-dispute-resolution'
  | 'late-fee-waiver'
  | 'partial-refund'
  | 'lease-amendment'
  | 'eviction-decision';

/**
 * Who the actor is — if they ARE the tenant owner, the gate routes to
 * BOSSNYUMBA support tier instead. Klarna lesson: owner cannot be both
 * actor and approver.
 */
export type KlarnaActor =
  | { readonly kind: 'md-on-behalf-of-owner'; readonly ownerId: string }
  | { readonly kind: 'md-on-behalf-of-tenant-owner-customer'; readonly ownerId: string }
  | { readonly kind: 'md-on-behalf-of-system'; readonly systemId: string };

/**
 * The action attempt the MD wants to perform.
 */
export interface KlarnaActionAttempt {
  readonly attemptId: string;
  readonly tenantId: string;
  readonly actor: KlarnaActor;
  readonly actionClass: KlarnaActionClass;
  readonly draft: string;
  readonly evidence: ReadonlyArray<string>;
  readonly proposedAt: string;
}

/**
 * Routing destination. The wrap NEVER returns `executed` — it can only
 * return one of two routes.
 */
export type KlarnaRouting =
  | { readonly kind: 'route-to-tenant-owner'; readonly ownerId: string; readonly slaHours: number }
  | { readonly kind: 'route-to-bossnyumba-support'; readonly tier: 'tier-1' | 'tier-2' | 'tier-3'; readonly slaHours: number };

/**
 * The wrap's verdict. Sierra outcome-based posture: success only when
 * human confirms — the wrap NEVER calls success on its own.
 */
export interface KlarnaVerdict {
  readonly attemptId: string;
  readonly verdict: 'routed-not-executed';
  readonly routing: KlarnaRouting;
  readonly auditCitations: ReadonlyArray<string>;
  readonly draftPreserved: string;
  readonly routedAt: string;
}

// ---------------------------------------------------------------------------
// Jurisdictional-Creep Class Scanner
// ---------------------------------------------------------------------------

/**
 * A single finding from the jurisdictional-creep scanner.
 */
export interface JurisdictionalCreepFinding {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
  readonly kind:
    | 'literal-tz-outside-rules'
    | 'switch-jurisdiction-no-default'
    | 'country-or-tz-silent-fallback';
  readonly severity: 'fail';
}

/**
 * The scanner's verdict on a single file.
 */
export interface JurisdictionalCreepScanResult {
  readonly file: string;
  readonly passes: boolean;
  readonly findings: ReadonlyArray<JurisdictionalCreepFinding>;
}

// ---------------------------------------------------------------------------
// Tenant-Privacy Threat-Model Enforcement
// ---------------------------------------------------------------------------

/**
 * The four PII channels with BOSSNYUMBA-specific threat-model coverage.
 */
export type PiiChannel =
  | 'biometric-smartlock'
  | 'chat-transcript'
  | 'mpesa-sms'
  | 'lease-pdf';

/**
 * Channel-specific declaration. Each channel must declare:
 *   - retention period (days)
 *   - access-control role-list
 *   - egress-audit endpoint
 */
export interface PiiChannelDeclaration {
  readonly channel: PiiChannel;
  readonly retentionDays: number;
  readonly accessControlRoles: ReadonlyArray<string>;
  readonly egressAuditEndpoint: string;
  readonly lawfulBasisCitations: ReadonlyArray<string>;
}

/**
 * A retention-sweep event — the cron found a record past its retention
 * period and either deleted it or flagged it for owner review.
 */
export interface RetentionSweepEvent {
  readonly sweepId: string;
  readonly tenantId: string;
  readonly channel: PiiChannel;
  readonly recordsExamined: number;
  readonly recordsDeleted: number;
  readonly recordsFlagged: number;
  readonly sweptAt: string;
}

/**
 * An egress-audit event — a record was transmitted off-tenant or off-platform.
 */
export interface EgressAuditEvent {
  readonly eventId: string;
  readonly tenantId: string;
  readonly channel: PiiChannel;
  readonly recordId: string;
  readonly destination: string;
  readonly actorId: string;
  readonly purpose: string;
  readonly emittedAt: string;
}

// ---------------------------------------------------------------------------
// Quarterly Compliance Report
// ---------------------------------------------------------------------------

/**
 * A quarter identifier — ISO-style "2026-Q1", "2026-Q2", …
 */
export type QuarterId = `${number}-Q${1 | 2 | 3 | 4}`;

/**
 * Aggregated per-quarter compliance numbers per tenant.
 */
export interface QuarterlyComplianceReport {
  readonly quarter: QuarterId;
  readonly scope: 'tenant' | 'platform';
  readonly tenantId: string | null;
  readonly generatedAt: string;
  readonly disparateImpact: {
    readonly cohortsExamined: number;
    readonly concerns: number;
    readonly breaches: number;
    readonly topBreach: DisparateImpactVerdict | null;
  };
  readonly skillPromotion: {
    readonly proposals: number;
    readonly approvals: number;
    readonly denials: number;
    readonly quarantines: number;
  };
  readonly klarnaPattern: {
    readonly routes: number;
    readonly executes: number; // MUST be 0 — surfaced as breach if non-zero
  };
  readonly jurisdictionalCreep: {
    readonly filesScanned: number;
    readonly findings: number;
    readonly classBreakdown: Readonly<Record<JurisdictionalCreepFinding['kind'], number>>;
  };
  readonly tenantPrivacy: {
    readonly retentionSweeps: number;
    readonly recordsDeleted: number;
    readonly egressAudits: number;
    readonly perChannel: Readonly<Record<PiiChannel, { sweeps: number; egress: number }>>;
  };
}

// ---------------------------------------------------------------------------
// Shared port surfaces (consumers wire these up)
// ---------------------------------------------------------------------------

export interface DecisionRecordPort {
  readonly listSince: (
    args: { readonly tenantId: string; readonly since: string; readonly until: string },
  ) => Promise<ReadonlyArray<DecisionRecord>>;
}

export interface SkillPromotionApprovalPort {
  readonly findApproval: (
    args: { readonly skillId: string; readonly proposedAt: string },
  ) => Promise<SkillPromotionApproval | null>;
}

export interface KlarnaRoutingPort {
  readonly route: (
    args: { readonly attemptId: string; readonly routing: KlarnaRouting; readonly draft: string },
  ) => Promise<void>;
}

export interface PiiRetentionPort {
  readonly findOverdue: (
    args: { readonly tenantId: string; readonly channel: PiiChannel; readonly olderThan: string },
  ) => Promise<ReadonlyArray<{ readonly recordId: string }>>;
  readonly delete: (
    args: { readonly tenantId: string; readonly channel: PiiChannel; readonly recordId: string },
  ) => Promise<void>;
}

export interface EgressAuditPort {
  readonly record: (event: EgressAuditEvent) => Promise<void>;
  readonly listSince: (
    args: { readonly tenantId: string; readonly since: string; readonly until: string },
  ) => Promise<ReadonlyArray<EgressAuditEvent>>;
}
