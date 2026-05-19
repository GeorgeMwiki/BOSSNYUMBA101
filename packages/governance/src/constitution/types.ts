/**
 * Constitution type primitives.
 *
 * The principle list is closed (the canonical document is
 * BOSSNYUMBA_CONSTITUTION.md). Adding a principle requires editing both
 * the markdown and this file, in that order.
 */

/**
 * Canonical principle names — mirrors BOSSNYUMBA_CONSTITUTION.md §1..§9.
 * Stable identifiers; the prose evolves, these strings do not.
 */
export type PrincipleName =
  | 'jurisdiction-neutrality'
  | 'currency-neutrality'
  | 'tenant-privacy'
  | 'data-residency'
  | 'no-mock-data'
  | 'transparency-of-action'
  | 'owner-approval-for-destructive'
  | 'audit-everything'
  | 'failure-makes-us-stronger';

/**
 * Severity ladder for a violation.
 *   - `info`     — telemetry only; the action may proceed
 *   - `warn`     — surface to the owner; the action may proceed with consent
 *   - `block`    — the action must not proceed
 *   - `critical` — the action must not proceed AND a sovereign-ledger
 *                  incident is opened
 */
export type Severity = 'info' | 'warn' | 'block' | 'critical';

/**
 * The four risk classes that drive constitution invocation.
 *   - `destructive`     — every action is critiqued
 *   - `external-comm`   — every action is critiqued (sends touch tenants)
 *   - `financial`       — every action is critiqued (money is irreversible)
 *   - `read-only`       — 5% sample for telemetry; default fast-path
 */
export type ActionRiskClass =
  | 'destructive'
  | 'external-comm'
  | 'financial'
  | 'read-only';

/**
 * The action the brain proposes to take. The constitution enforces against
 * this — not against the model's free-text reasoning, which is too noisy.
 */
export interface ProposedAction {
  /** Stable kind discriminator — e.g. "send-sms", "charge-card", "delete-unit". */
  readonly kind: string;
  /** Risk class for routing — see ActionRiskClass. */
  readonly riskClass: ActionRiskClass;
  /** Tenant the action runs against (always present; tenant-privacy is §3). */
  readonly tenantId: string;
  /** Free-form parameters the model proposed — JSON-serialisable. */
  readonly params: Readonly<Record<string, unknown>>;
  /** Optional human-language summary the model wrote about its intent. */
  readonly intent?: string;
}

/**
 * The execution context the constitution evaluates against — *not* the
 * full tenant config, just the slice the principles care about.
 */
export interface ConstitutionContext {
  /** Tenant residency tag — drives §4. */
  readonly residencyRegion?: string;
  /** Tenant display currency — drives §2 conversion gate. */
  readonly tenantCurrency?: string;
  /** The human who initiated the conversation — drives §7 four-eye. */
  readonly initiatorUserId?: string;
  /** Whether sandbox/test data is permissible — drives §5 (false in prod). */
  readonly allowMockData?: boolean;
  /** Whether the audit-ledger endpoint is reachable — drives §8 fail-closed. */
  readonly ledgerReachable?: boolean;
}

/**
 * A verdict from a single principle's check.
 */
export interface PrincipleVerdict {
  readonly principle: PrincipleName;
  readonly violated: boolean;
  readonly severity: Severity;
  readonly explanation: string;
  readonly mitigation: string;
}

/**
 * The top-level verdict returned by enforceConstitution.
 *
 * Either:
 *   - `compliant` — every principle passed
 *   - the union shape — at least one principle was violated; the worst
 *     violation determines the top-level severity, and the full list is
 *     available for audit
 */
export type ConstitutionVerdict =
  | { readonly outcome: 'compliant'; readonly checks: readonly PrincipleVerdict[] }
  | {
      readonly outcome: 'violation';
      readonly violation: PrincipleName;
      readonly severity: Severity;
      readonly mitigation: string;
      readonly checks: readonly PrincipleVerdict[];
    };

/**
 * Port for the LLM self-critique pass. The default implementation in
 * `self-critique-pass.ts` uses deterministic checks; production wiring
 * supplies an actual LLM that critiques the proposal against the full
 * principle prose. The port lets tests run without an LLM dependency.
 */
export interface SelfCritiquePort {
  critique(args: {
    readonly principle: PrincipleName;
    readonly action: ProposedAction;
    readonly context: ConstitutionContext;
  }): Promise<PrincipleVerdict>;
}
