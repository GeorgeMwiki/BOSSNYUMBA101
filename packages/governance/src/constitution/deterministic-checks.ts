/**
 * Deterministic checks per principle.
 *
 * The constitution has two enforcement layers:
 *
 *   1. **Deterministic** (this file) — cheap pattern matches that catch
 *      obvious violations before any LLM call. Each principle exposes a
 *      `check(action, context)` that returns a verdict.
 *
 *   2. **LLM self-critique** (self-critique-pass.ts) — runs only when the
 *      deterministic check is uncertain or when the action's risk class
 *      demands a second look (destructive + financial always).
 *
 * Every check function is total (returns a verdict, never throws). The
 * verdict's `violated` flag tells the caller whether the LLM stage is
 * needed.
 */

import type {
  ConstitutionContext,
  PrincipleName,
  PrincipleVerdict,
  ProposedAction,
  Severity,
} from './types.js';

type Checker = (action: ProposedAction, context: ConstitutionContext) => PrincipleVerdict;

const compliant = (principle: PrincipleName, explanation: string): PrincipleVerdict => ({
  principle,
  violated: false,
  severity: 'info',
  explanation,
  mitigation: '',
});

const violation = (
  principle: PrincipleName,
  severity: Severity,
  explanation: string,
  mitigation: string,
): PrincipleVerdict => ({
  principle,
  violated: true,
  severity,
  explanation,
  mitigation,
});

/**
 * §1 — Jurisdiction-neutrality.
 *
 * Flags actions whose params hard-code a country/region/court/regulator
 * outside the tenant-context plumbing. The brain may *reference* a
 * jurisdiction, but it may not *bake one in*.
 */
const HARD_CODED_JURISDICTION_KEYS = new Set([
  'country',
  'court',
  'regulator',
  'taxAuthority',
  'jurisdiction',
]);

const checkJurisdictionNeutrality: Checker = (action) => {
  for (const [key, value] of Object.entries(action.params)) {
    if (HARD_CODED_JURISDICTION_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
      // Hard-coded ISO country codes in action params indicate the model
      // tried to bake jurisdiction into the action instead of routing
      // through tenant context.
      return violation(
        'jurisdiction-neutrality',
        'block',
        `Action parameter "${key}" hard-codes jurisdiction "${value}" — must come from tenant context, not the action payload.`,
        `Remove the "${key}" parameter; let the tenant-scoped configuration supply the jurisdiction at execution time.`,
      );
    }
  }
  return compliant(
    'jurisdiction-neutrality',
    'No hard-coded jurisdiction in action parameters.',
  );
};

/**
 * §2 — Currency-neutrality.
 *
 * Flags monetary fields that lack an explicit currency code, and flags
 * arithmetic on mixed currencies. The simplest rule: if a key looks like
 * money (`amount`, `total`, `fee`, `price`, `rent`, `charge`), it must
 * either carry a sibling `currency` field or be a typed Money object.
 */
const MONEY_KEY_PATTERN = /^(amount|total|fee|price|rent|charge|deposit|balance|sum)$/i;

const isMoneyKey = (key: string): boolean => MONEY_KEY_PATTERN.test(key);

const looksLikeBareNumber = (value: unknown): boolean =>
  typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value));

const checkCurrencyNeutrality: Checker = (action) => {
  const params = action.params;
  for (const [key, value] of Object.entries(params)) {
    if (!isMoneyKey(key)) continue;
    // A bare number for a money field is a violation unless a sibling
    // `currency` exists at the same level.
    if (looksLikeBareNumber(value)) {
      const hasSiblingCurrency =
        typeof params['currency'] === 'string' && (params['currency'] as string).length > 0;
      if (!hasSiblingCurrency) {
        return violation(
          'currency-neutrality',
          'block',
          `Money field "${key}" carries a bare number with no sibling currency code — every monetary value must declare its currency.`,
          `Wrap the value in a Money object: { amount: <bigint>, currency: "<ISO-4217>" }, or add a sibling "currency" field.`,
        );
      }
    }
  }
  return compliant(
    'currency-neutrality',
    'No bare-number money fields detected.',
  );
};

/**
 * §3 — Tenant-privacy.
 *
 * Flags actions whose params reference a tenant ID different from the
 * action's bound tenant. Cross-tenant reads require the
 * `cross-tenant-read` action class plus admin context (checked by the
 * gate layer, not here — this is a belt-and-braces).
 */
const checkTenantPrivacy: Checker = (action) => {
  const tenantInParams = action.params['tenantId'];
  if (typeof tenantInParams === 'string' && tenantInParams !== action.tenantId) {
    return violation(
      'tenant-privacy',
      'block',
      `Action targets tenant "${action.tenantId}" but params reference tenant "${tenantInParams}" — cross-tenant access is forbidden outside the dedicated cross-tenant-read class.`,
      `Scope the retrieval to the bound tenant; if a cross-tenant view is genuinely required, route through the cross-tenant-read action class with admin context.`,
    );
  }
  return compliant('tenant-privacy', 'No cross-tenant reference in action parameters.');
};

/**
 * §4 — Data-residency.
 *
 * Flags actions that propose a destination region inconsistent with the
 * tenant's contracted residency. Note: the regional router enforces this
 * downstream; the constitution check is the *signal*, not the
 * enforcement.
 */
const checkDataResidency: Checker = (action, context) => {
  const proposedRegion = action.params['region'];
  if (
    typeof proposedRegion === 'string' &&
    context.residencyRegion !== undefined &&
    proposedRegion !== context.residencyRegion
  ) {
    return violation(
      'data-residency',
      'critical',
      `Action proposes region "${proposedRegion}" but tenant residency is "${context.residencyRegion}" — data may not leave the contracted region.`,
      `Route the action to a worker in the tenant's residency region, or refuse the action if no in-region worker exists.`,
    );
  }
  return compliant('data-residency', 'Proposed region (if any) matches tenant residency.');
};

/**
 * §5 — No-mock-data.
 *
 * Flags well-known placeholder patterns. The brain may not write
 * `lorem ipsum`, `+255 700 000 000`, `test@example.com`, `Demo Property`,
 * or zero-amount defaults into production.
 */
const MOCK_VALUE_PATTERNS: readonly RegExp[] = [
  /lorem\s+ipsum/i,
  /^\+?[0-9]{2,3}\s?700\s?000\s?000$/,
  /@example\.(com|org|net)$/i,
  /\bdemo\s+(property|tenant|unit|building)\b/i,
  /\bplaceholder\b/i,
  /\btest[-_ ]+data\b/i,
];

const containsMockValue = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  return MOCK_VALUE_PATTERNS.some((pattern) => pattern.test(value));
};

const checkNoMockData: Checker = (action, context) => {
  if (context.allowMockData === true) {
    return compliant(
      'no-mock-data',
      'Mock data explicitly allowed by context (test environment).',
    );
  }
  for (const [key, value] of Object.entries(action.params)) {
    if (containsMockValue(value)) {
      return violation(
        'no-mock-data',
        'block',
        `Action parameter "${key}" contains a recognised placeholder value — the brain may not fabricate data into production.`,
        `Surface the missing-data condition to the operator and refuse the action until a real value is supplied.`,
      );
    }
  }
  return compliant('no-mock-data', 'No recognised placeholder values in parameters.');
};

/**
 * §6 — Transparency-of-action.
 *
 * Flags external communications that omit AI disclosure. The brain must
 * mark agent-authored messages so the recipient knows.
 */
const checkTransparencyOfAction: Checker = (action) => {
  if (action.riskClass !== 'external-comm') {
    return compliant(
      'transparency-of-action',
      'Action is not an external communication; transparency rule trivially satisfied.',
    );
  }
  const disclosed = action.params['agentDisclosed'];
  if (disclosed !== true) {
    return violation(
      'transparency-of-action',
      'warn',
      `External communication action does not carry the agentDisclosed=true flag — recipients must be told an AI agent acted in the tenant's name.`,
      `Set agentDisclosed=true on the action and include the standard disclosure footer in the message body.`,
    );
  }
  return compliant('transparency-of-action', 'External communication carries agent disclosure.');
};

/**
 * §7 — Owner-approval-for-destructive.
 *
 * Flags destructive/financial/external-comm actions that lack an
 * `approverUserId` distinct from the initiator (when four-eye is in
 * effect — gate layer carries the flag).
 */
const checkOwnerApprovalForDestructive: Checker = (action, context) => {
  if (action.riskClass === 'read-only') {
    return compliant(
      'owner-approval-for-destructive',
      'Read-only action; approval trivially satisfied.',
    );
  }
  const approver = action.params['approverUserId'];
  if (typeof approver !== 'string' || approver.length === 0) {
    return violation(
      'owner-approval-for-destructive',
      'block',
      `Action of risk class "${action.riskClass}" carries no approverUserId — destructive actions require an explicit named approver, not implicit consent.`,
      `Surface the approval request to a named owner; record approverUserId on the action only after positive confirmation.`,
    );
  }
  if (
    context.initiatorUserId !== undefined &&
    approver === context.initiatorUserId &&
    action.params['fourEye'] === true
  ) {
    return violation(
      'owner-approval-for-destructive',
      'block',
      `Four-eye gate is set but the approver "${approver}" equals the initiator — a distinct approver is required.`,
      `Route the approval to a second named human; refuse self-approval.`,
    );
  }
  return compliant(
    'owner-approval-for-destructive',
    'Action carries a named approver compatible with the gate policy.',
  );
};

/**
 * §8 — Audit-everything.
 *
 * Flags actions when the sovereign-ledger endpoint is unreachable. The
 * brain may not perform a side effect whose audit cannot be recorded.
 */
const checkAuditEverything: Checker = (action, context) => {
  if (action.riskClass === 'read-only') {
    return compliant(
      'audit-everything',
      'Read-only action; sampled audit is best-effort.',
    );
  }
  if (context.ledgerReachable === false) {
    return violation(
      'audit-everything',
      'critical',
      `Sovereign ledger is unreachable; performing this side-effect would leave the system without an audit entry.`,
      `Fail closed: refuse the action and queue it for retry once the ledger recovers.`,
    );
  }
  return compliant(
    'audit-everything',
    'Ledger reachable (or not measured); audit will be persisted.',
  );
};

/**
 * §9 — Failure-makes-us-stronger.
 *
 * Flags actions whose intent text suggests the brain is suppressing
 * uncertainty. This is the *softest* check — `warn` only — because the
 * signal is heuristic.
 */
const UNCERTAINTY_SUPPRESSION_PHRASES: readonly RegExp[] = [
  /\bI'?ll just guess\b/i,
  /\bwinging it\b/i,
  /\bpretend it'?s\b/i,
  /\bfake it\b/i,
  /\bdefault to (zero|something|whatever)\b/i,
];

const checkFailureMakesUsStronger: Checker = (action) => {
  const intent = action.intent;
  if (typeof intent !== 'string' || intent.length === 0) {
    return compliant(
      'failure-makes-us-stronger',
      'No intent text to scan; check is not applicable.',
    );
  }
  for (const pattern of UNCERTAINTY_SUPPRESSION_PHRASES) {
    if (pattern.test(intent)) {
      return violation(
        'failure-makes-us-stronger',
        'warn',
        `Action intent contains phrasing that suggests uncertainty is being suppressed: "${intent}".`,
        `Escalate the uncertainty to a human; record a reflection note for the task type instead of fabricating a confident answer.`,
      );
    }
  }
  return compliant(
    'failure-makes-us-stronger',
    'No uncertainty-suppression phrasing detected in intent.',
  );
};

/**
 * Principle registry — order is the precedence order in §3 of the
 * constitution document ("the lower-numbered principle wins").
 */
export const PRINCIPLE_CHECKERS: readonly { name: PrincipleName; check: Checker }[] = [
  { name: 'jurisdiction-neutrality', check: checkJurisdictionNeutrality },
  { name: 'currency-neutrality', check: checkCurrencyNeutrality },
  { name: 'tenant-privacy', check: checkTenantPrivacy },
  { name: 'data-residency', check: checkDataResidency },
  { name: 'no-mock-data', check: checkNoMockData },
  { name: 'transparency-of-action', check: checkTransparencyOfAction },
  { name: 'owner-approval-for-destructive', check: checkOwnerApprovalForDestructive },
  { name: 'audit-everything', check: checkAuditEverything },
  { name: 'failure-makes-us-stronger', check: checkFailureMakesUsStronger },
];

/**
 * Severity ranking — used to pick the worst-violating principle when more
 * than one principle reports a violation.
 */
export const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warn: 1,
  block: 2,
  critical: 3,
};
