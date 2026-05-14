/**
 * Policy gate — deterministic OUTPUT validation + per-request context
 * checks. Runs after the sensor returns and before the kernel commits
 * the answer. Six concerns, in order:
 *
 *   1. Tenant-isolation context check — when a `request.tenantId` is
 *      supplied alongside a `decision.tenantId`, the two MUST match.
 *      Stops the kernel from emitting an answer claimed under one
 *      tenant scope that was actually produced inside a different
 *      tenant's context.
 *
 *   2. Scope-match context check — when the action being executed
 *      declares a set of required scopes, every one of them must be
 *      present in the caller's granted-scope set. (Defence-in-depth
 *      complement to the prompt-shield + autonomy-policy.)
 *
 *   3. Cost-ceiling context check — per-call USD-ceiling per tier:
 *      free=$0.05, pro=$0.25, enterprise=$2.50 (configurable via
 *      `costCeilings`). If `request.estimatedCostUsd` exceeds the
 *      caller's tier ceiling, the gate refuses BEFORE we render the
 *      output to disk. Sovereign actions are exempted (they go through
 *      the four-eye gate which carries its own cost authority).
 *
 *   4. Off-hours sensitive-action context check — refuses sovereign-
 *      tier (`stakes: 'critical'`) actions outside Tanzania business
 *      hours (08:00–18:00 EAT, Mon–Fri) unless the caller has supplied
 *      `afterHoursOverride: true`. Property management example: an
 *      eviction proposal at 23:30 on a Sunday almost never reflects a
 *      sober decision.
 *
 *   5. PII redaction — phone / national-id / email leakage that the
 *      sensor accidentally reproduced from a tool result.
 *
 *   6. Numerical claim hedging + regulatory hedge — un-cited absolute
 *      numbers and eviction/lockout language get softened.
 *
 * The new context checks (1)–(4) only fire when `input.request` is
 * supplied. Existing callers that pass `{ text, hasCitations }` see
 * the original output-only behaviour unchanged.
 *
 * The gate is a pure function. It returns an outcome describing what
 * was done so the kernel can decide whether the result is "pass",
 * "soften", or "block".
 */

import type { GateVerdict } from './kernel-types.js';

// ─────────────────────────────────────────────────────────────────────
// New context types for the K5 parity checks
// ─────────────────────────────────────────────────────────────────────

export type PolicyGateTier = 'free' | 'pro' | 'enterprise' | 'sovereign';

export interface PolicyGateRequestContext {
  /** Tenant scope the caller claims to be operating inside. */
  readonly tenantId?: string;
  /** Caller's granted scopes (action.read, payouts.write, etc.). */
  readonly grantedScopes?: ReadonlyArray<string>;
  /** Subscription tier — drives the cost ceiling. */
  readonly tier?: PolicyGateTier;
  /** USD cost the kernel estimates for this turn. */
  readonly estimatedCostUsd?: number;
  /** Stakes for this turn — drives the off-hours gate. */
  readonly stakes?: 'low' | 'medium' | 'high' | 'critical';
  /** When TRUE the caller explicitly accepts the off-hours risk. */
  readonly afterHoursOverride?: boolean;
  /** Optional override clock for the off-hours check; defaults to now. */
  readonly now?: Date;
}

export interface PolicyGateDecisionContext {
  /** Tenant scope the produced output is actually grounded in. */
  readonly tenantId?: string;
  /** Scopes the action requires to execute. */
  readonly requiredScopes?: ReadonlyArray<string>;
}

export interface PolicyGateInput {
  readonly text: string;
  readonly hasCitations: boolean;
  readonly request?: PolicyGateRequestContext;
  readonly decision?: PolicyGateDecisionContext;
  /** Operator-tunable per-tier ceilings (USD per call). */
  readonly costCeilings?: Partial<Record<PolicyGateTier, number>>;
}

export interface PolicyGateOutput {
  readonly verdict: GateVerdict;
  readonly redactedText: string;
  readonly mutations: ReadonlyArray<string>;
}

// ─────────────────────────────────────────────────────────────────────
// Output PII / regulatory patterns (unchanged)
// ─────────────────────────────────────────────────────────────────────

const PII_PATTERNS: ReadonlyArray<{ kind: string; re: RegExp; replace: string }> = [
  { kind: 'phone-tz',  re: /\+?255[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g, replace: '[redacted-phone]' },
  { kind: 'phone-ke',  re: /\+?254[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g, replace: '[redacted-phone]' },
  { kind: 'phone-gen', re: /\b0[67]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g,    replace: '[redacted-phone]' },
  { kind: 'email',     re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,  replace: '[redacted-email]' },
  { kind: 'nida',      re: /\b\d{8}-\d{5}-\d{5}-\d{2}\b/g,             replace: '[redacted-nida]' },
];

const NUMERICAL_PATTERN = /\b\d{1,3}(?:[.,]\d+)?%/g; // 92.3% etc
const ABSOLUTE_MONEY_PATTERN = /\b(TZS|KES|USD)\s?\d[\d,]*\b/g;

const REGULATORY_TRIGGERS: ReadonlyArray<RegExp> = [
  /\bevict\w*/i,
  /\bterminate? (the )?lease\b/i,
  /\bvacate (the )?premises\b/i,
  /\blockout\b/i,
];

// ─────────────────────────────────────────────────────────────────────
// Tier cost ceilings (USD per call)
// ─────────────────────────────────────────────────────────────────────

export const DEFAULT_COST_CEILINGS: Readonly<Record<PolicyGateTier, number>> =
  Object.freeze({
    free: 0.05,
    pro: 0.25,
    enterprise: 2.5,
    sovereign: Number.POSITIVE_INFINITY,
  });

// ─────────────────────────────────────────────────────────────────────
// Business-hours window (Tanzania — EAT, UTC+3)
// ─────────────────────────────────────────────────────────────────────

const BUSINESS_HOURS_TZ_OFFSET_MINUTES = 180; // EAT = UTC+3
const BUSINESS_HOUR_START = 8;  // 08:00 EAT
const BUSINESS_HOUR_END = 18;   // 18:00 EAT exclusive
// 1=Mon … 5=Fri (EAT)
const BUSINESS_WEEKDAYS: ReadonlyArray<number> = [1, 2, 3, 4, 5];

function isWithinBusinessHoursEAT(now: Date): boolean {
  const eatMs = now.getTime() + BUSINESS_HOURS_TZ_OFFSET_MINUTES * 60_000;
  const eat = new Date(eatMs);
  const dayUTC = eat.getUTCDay(); // 0=Sun .. 6=Sat
  const hourUTC = eat.getUTCHours();
  if (!BUSINESS_WEEKDAYS.includes(dayUTC)) return false;
  return hourUTC >= BUSINESS_HOUR_START && hourUTC < BUSINESS_HOUR_END;
}

// ─────────────────────────────────────────────────────────────────────
// Block helper
// ─────────────────────────────────────────────────────────────────────

function blockedOutput(reason: string, mutation: string): PolicyGateOutput {
  return {
    verdict: { status: 'block', reason },
    redactedText: '',
    mutations: [mutation],
  };
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export function runPolicyGate(input: PolicyGateInput): PolicyGateOutput {
  const request = input.request;
  const decision = input.decision;

  // 1) Tenant-isolation context check.
  if (
    request?.tenantId &&
    decision?.tenantId &&
    request.tenantId !== decision.tenantId
  ) {
    return blockedOutput(
      `tenant-isolation violation: request.tenantId="${request.tenantId}" but decision.tenantId="${decision.tenantId}"`,
      'blocked:tenant-isolation',
    );
  }

  // 2) Scope-match context check.
  if (decision?.requiredScopes && decision.requiredScopes.length > 0) {
    const granted = new Set(request?.grantedScopes ?? []);
    const missing = decision.requiredScopes.filter((s) => !granted.has(s));
    if (missing.length > 0) {
      return blockedOutput(
        `missing required scope(s): ${missing.join(', ')}`,
        'blocked:scope-mismatch',
      );
    }
  }

  // 3) Cost-ceiling context check (sovereign tier is exempted — its budget
  //    is governed by the four-eye gate, not by this gate).
  if (
    request?.tier &&
    request.tier !== 'sovereign' &&
    typeof request.estimatedCostUsd === 'number' &&
    Number.isFinite(request.estimatedCostUsd) &&
    request.estimatedCostUsd >= 0
  ) {
    const ceilings = { ...DEFAULT_COST_CEILINGS, ...(input.costCeilings ?? {}) };
    const ceiling = ceilings[request.tier];
    if (typeof ceiling === 'number' && request.estimatedCostUsd > ceiling) {
      return blockedOutput(
        `cost-ceiling exceeded: estimated $${request.estimatedCostUsd.toFixed(4)} > tier "${request.tier}" ceiling $${ceiling.toFixed(2)}`,
        'blocked:cost-ceiling',
      );
    }
  }

  // 4) Off-hours sovereign-action context check.
  if (
    request?.stakes === 'critical' &&
    request.afterHoursOverride !== true
  ) {
    const now = request.now ?? new Date();
    if (!isWithinBusinessHoursEAT(now)) {
      return blockedOutput(
        'sovereign-tier action refused outside Tanzania business hours (08:00–18:00 EAT weekdays); supply afterHoursOverride=true to proceed',
        'blocked:off-hours-sovereign',
      );
    }
  }

  // ─── Output-side checks (unchanged) ────────────────────────────────
  let text = input.text;
  const mutations: string[] = [];

  for (const p of PII_PATTERNS) {
    if (p.re.test(text)) {
      text = text.replace(p.re, p.replace);
      mutations.push(`redacted:${p.kind}`);
    }
  }

  if (!input.hasCitations) {
    if (NUMERICAL_PATTERN.test(text)) {
      mutations.push('hedged:uncited-percentage');
      text = text.replace(
        NUMERICAL_PATTERN,
        (m) => `${m} (uncited — verify against the source tool)`,
      );
    }
    if (ABSOLUTE_MONEY_PATTERN.test(text)) {
      mutations.push('hedged:uncited-money');
      text = text.replace(
        ABSOLUTE_MONEY_PATTERN,
        (m) => `${m} (uncited — verify against the ledger)`,
      );
    }
  }

  let regulatoryHit = false;
  for (const re of REGULATORY_TRIGGERS) {
    if (re.test(text)) {
      regulatoryHit = true;
      break;
    }
  }
  if (regulatoryHit && !/arrears ladder|notice period|tribunal/i.test(text)) {
    text =
      text.trimEnd() +
      '\n\nNote: any termination action must follow the documented arrears ladder and notice period. I am not the decision-maker for those steps.';
    mutations.push('appended:regulatory-hedge');
  }

  let verdict: GateVerdict;
  if (mutations.some((m) => m.startsWith('redacted:'))) {
    verdict = { status: 'soften', reason: 'PII redacted in output' };
  } else if (mutations.length > 0) {
    verdict = { status: 'soften', reason: 'output hedged for regulatory or citation safety' };
  } else {
    verdict = { status: 'pass' };
  }

  return { verdict, redactedText: text, mutations };
}

/** Exported for diagnostics + tests; do not mutate. */
export { isWithinBusinessHoursEAT };
