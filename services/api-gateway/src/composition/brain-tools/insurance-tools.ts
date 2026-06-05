/**
 * Insurance brain tools (real-estate edition) — Gap-4 (c).
 *
 * Ported from Borjie's `composition/brain-tools/insurance-tools.ts` and
 * retargeted mining → real estate:
 *   - `mining.insurance.*`  → `property.insurance.*`
 *   - coverage types retargeted to property risks:
 *       workforce / plant / environmental / third_party / transit /
 *       political_risk
 *         ->
 *       buildings / contents / public_liability / loss_of_rent /
 *       landlord_liability / tenant_default
 *
 * Four tools backing a `/property/insurance/{quotes,policies}` family:
 *   - `property.insurance.get_quotes`    WRITE: fan-out via broker port
 *   - `property.insurance.bind_policy`   WRITE: bind a quote into a policy
 *   - `property.insurance.policy_status` READ:  list active policies
 *   - `property.insurance.renewals_due`  READ:  renewal countdown
 *
 * The two WRITE tools are MEDIUM stakes (quoting moves money on the broker
 * side; binding is a fiduciary commitment). They wrap their POST body with
 * `withChatProvenance` so the row's "via Mr. Mwikila" pill deep-links back
 * to the chat turn, and (when wired) emit an audit entry via the brain-tool
 * adapter (`isWrite: true`).
 *
 * Multi-currency (CLAUDE.md hard rule): NOTHING here hard-codes a
 * jurisdiction currency. Money fields are a numeric/string `amount` plus a
 * sibling `currency` code resolved by the route; the display surface
 * formats with formatCurrency. (Borjie's `*Tzs` field names are dropped.)
 *
 * HONEST-DEGRADE (CLAUDE.md hard rule + Gap-4 spec — "honest-degrade if
 * routes absent"): BN does NOT yet expose the `/property/insurance/*`
 * routes these tools target. So every tool returns a typed `available:
 * false` shape (empty lists / `status:'unavailable'`) rather than a
 * fabricated quote or policy. The `INSURANCE_ROUTES_WIRED` flag below is
 * the single switch that activates the real loopback + provenance once the
 * routes land. We deliberately do NOT call the loopback while the routes
 * are absent (the loopback client throws on a 404 → a tool DENIAL, which
 * reads as an error rather than the honest "unavailable" the brain should
 * relay).
 */

import { z } from 'zod';
import type {
  PersonaToolDescriptor,
  PersonaToolHandlerContext,
} from './types.js';
import { withChatProvenance } from './provenance-injector.js';

/**
 * Single switch: are the `/property/insurance/*` loopback routes mounted in
 * the api-gateway yet? While `false`, every insurance tool honest-degrades
 * to a typed `available:false` shape (never fabricates). Flip to `true`
 * when the routes land — the per-tool loopback + provenance branches below
 * then activate.
 */
const INSURANCE_ROUTES_WIRED = false;

const OWNER: ReadonlyArray<'T1_owner_strategist'> = ['T1_owner_strategist'];

/** Property insurance coverage types (retargeted from Borjie mining set). */
const COVERAGE = [
  'buildings',
  'contents',
  'public_liability',
  'loss_of_rent',
  'landlord_liability',
  'tenant_default',
] as const;

/** True only when the loopback is BOTH wired AND a client is bound. */
function loopbackActive(ctx: PersonaToolHandlerContext): boolean {
  return INSURANCE_ROUTES_WIRED && ctx.httpClient !== undefined;
}

// ---------------------------------------------------------------------------
// 1. property.insurance.get_quotes (WRITE, MEDIUM)
// ---------------------------------------------------------------------------

const GetQuotesInput = z.object({
  brokerPartyId: z.string().uuid(),
  coverageType: z.enum(COVERAGE),
  sumInsured: z.number().nonnegative(),
  /** ISO-4217 currency for sumInsured (never hard-coded; required). */
  currency: z.string().length(3),
  region: z.string().max(64).optional(),
  riskProfile: z.record(z.unknown()).default({}),
});
const GetQuotesOutput = z.object({
  available: z.boolean(),
  quotes: z.array(
    z.object({
      id: z.string(),
      providerId: z.string(),
      premium: z.string(),
      deductible: z.string(),
      currency: z.string(),
      validUntil: z.string(),
    }),
  ),
});
export const insuranceGetQuotesTool: PersonaToolDescriptor<
  typeof GetQuotesInput,
  typeof GetQuotesOutput
> = {
  id: 'property.insurance.get_quotes',
  name: 'Insurance — request quotes (en) / Bima — omba nukuu (sw)',
  description:
    'Request property insurance quotes via the broker port. Fans out to ' +
    'enrolled providers and persists each offer. coverageType is one of ' +
    'buildings / contents / public_liability / loss_of_rent / ' +
    'landlord_liability / tenant_default. sumInsured REQUIRES a currency ' +
    'code (never hard-coded). Returns the persisted quote rows. Honest-' +
    'degrades to available:false (empty quotes) until the insurance routes ' +
    'are wired (never fabricates a quote).',
  personaSlugs: OWNER,
  inputSchema: GetQuotesInput,
  outputSchema: GetQuotesOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    if (!loopbackActive(ctx)) {
      return { available: false, quotes: [] };
    }
    const client = ctx.httpClient;
    if (!client) return { available: false, quotes: [] };

    const body: Record<string, unknown> = {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      brokerPartyId: input.brokerPartyId,
      coverageType: input.coverageType,
      sumInsured: input.sumInsured,
      currency: input.currency,
      riskProfile: input.riskProfile,
    };
    if (input.region !== undefined) {
      body.location = { region: input.region };
    }
    const response = await client.post<{
      success: boolean;
      data?: ReadonlyArray<Record<string, unknown>>;
    }>('/property/insurance/quotes', withChatProvenance(body, ctx));
    const rows = response.data ?? [];
    return {
      available: true,
      quotes: rows.map((r) => ({
        id: String(r.id ?? ''),
        providerId: String(r.provider_id ?? ''),
        premium: String(r.premium ?? ''),
        deductible: String(r.deductible ?? ''),
        currency: String(r.currency ?? input.currency),
        validUntil: String(r.valid_until ?? ''),
      })),
    };
  },
};

// ---------------------------------------------------------------------------
// 2. property.insurance.bind_policy (WRITE, MEDIUM)
// ---------------------------------------------------------------------------

const BindInput = z.object({
  quoteId: z.string().uuid(),
  paymentRef: z.string().min(1).max(128),
  effectiveAt: z.string().datetime(),
  termMonths: z.number().int().positive().max(60).default(12),
  evidenceDocId: z.string().uuid().optional(),
});
const BindOutput = z.object({
  available: z.boolean(),
  id: z.string(),
  policyNo: z.string(),
  status: z.string(),
  expiresAt: z.string(),
});
export const insuranceBindPolicyTool: PersonaToolDescriptor<
  typeof BindInput,
  typeof BindOutput
> = {
  id: 'property.insurance.bind_policy',
  name: 'Insurance — bind a quote (en) / Bima — funga nukuu (sw)',
  description:
    'Bind a previously-returned property insurance quote into an active ' +
    'policy. Requires a paymentRef (ledger handle). Defers to ' +
    '/property/insurance/policies/bind. Honest-degrades to available:false ' +
    "(status:'unavailable') until the insurance routes are wired (never " +
    'fabricates a bound policy).',
  personaSlugs: OWNER,
  inputSchema: BindInput,
  outputSchema: BindOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    if (!loopbackActive(ctx)) {
      return {
        available: false,
        id: '',
        policyNo: '',
        status: 'unavailable',
        expiresAt: '',
      };
    }
    const client = ctx.httpClient;
    if (!client) {
      return {
        available: false,
        id: '',
        policyNo: '',
        status: 'unavailable',
        expiresAt: '',
      };
    }

    const body: Record<string, unknown> = {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      quoteId: input.quoteId,
      paymentRef: input.paymentRef,
      effectiveAt: input.effectiveAt,
      termMonths: input.termMonths,
    };
    if (input.evidenceDocId !== undefined) {
      body.evidenceDocId = input.evidenceDocId;
    }
    const response = await client.post<{
      success: boolean;
      data?: Record<string, unknown>;
    }>('/property/insurance/policies/bind', withChatProvenance(body, ctx));
    const row = response.data ?? {};
    return {
      available: true,
      id: String(row.id ?? ''),
      policyNo: String(row.policy_no ?? ''),
      status: String(row.status ?? 'active'),
      expiresAt: String(row.expires_at ?? ''),
    };
  },
};

// ---------------------------------------------------------------------------
// 3. property.insurance.policy_status (READ, LOW)
// ---------------------------------------------------------------------------

const PolicyStatusInput = z.object({
  status: z
    .enum(['active', 'cancelled', 'expired', 'lapsed'])
    .default('active'),
  limit: z.number().int().positive().max(100).default(20),
});
const PolicyStatusOutput = z.object({
  available: z.boolean(),
  policies: z.array(
    z.object({
      id: z.string(),
      policyNo: z.string(),
      coverageType: z.string(),
      sumInsured: z.string(),
      currency: z.string(),
      expiresAt: z.string(),
      status: z.string(),
    }),
  ),
});
export const insurancePolicyStatusTool: PersonaToolDescriptor<
  typeof PolicyStatusInput,
  typeof PolicyStatusOutput
> = {
  id: 'property.insurance.policy_status',
  name: 'Insurance — policy register (en) / Bima — orodha ya bima (sw)',
  description:
    'List property insurance policies for the tenant, default filter ' +
    'status=active. Read-only — defers to /property/insurance/policies. ' +
    'Honest-degrades to available:false (empty policies) until the ' +
    'insurance routes are wired (never fabricates a policy).',
  personaSlugs: OWNER,
  inputSchema: PolicyStatusInput,
  outputSchema: PolicyStatusOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    if (!loopbackActive(ctx)) {
      return { available: false, policies: [] };
    }
    const client = ctx.httpClient;
    if (!client) return { available: false, policies: [] };
    const response = await client.get<{
      success: boolean;
      data?: ReadonlyArray<Record<string, unknown>>;
    }>('/property/insurance/policies', {
      query: {
        tenantId: ctx.tenantId,
        status: input.status,
        limit: input.limit,
      },
    });
    const rows = response.data ?? [];
    return {
      available: true,
      policies: rows.map((r) => ({
        id: String(r.id ?? ''),
        policyNo: String(r.policy_no ?? ''),
        coverageType: String(r.coverage_type ?? ''),
        sumInsured: String(r.sum_insured ?? ''),
        currency: String(r.currency ?? ''),
        expiresAt: String(r.expires_at ?? ''),
        status: String(r.status ?? ''),
      })),
    };
  },
};

// ---------------------------------------------------------------------------
// 4. property.insurance.renewals_due (READ, LOW)
// ---------------------------------------------------------------------------

const RenewalsDueInput = z.object({
  withinDays: z.number().int().positive().max(365).default(60),
});
const RenewalsDueOutput = z.object({
  available: z.boolean(),
  renewals: z.array(
    z.object({
      id: z.string(),
      policyNo: z.string(),
      coverageType: z.string(),
      expiresAt: z.string(),
      daysUntilExpiry: z.number().int(),
    }),
  ),
});
export const insuranceRenewalsDueTool: PersonaToolDescriptor<
  typeof RenewalsDueInput,
  typeof RenewalsDueOutput
> = {
  id: 'property.insurance.renewals_due',
  name: 'Insurance — renewals due (en) / Bima — zinazohitaji kuhuishwa (sw)',
  description:
    'List property insurance policies whose expiry falls within ' +
    '`withinDays` from today. Read-only — reads active policies and ' +
    'computes days-until-expiry in-tool. Honest-degrades to ' +
    'available:false (empty renewals) until the insurance routes are wired ' +
    '(never fabricates a renewal).',
  personaSlugs: OWNER,
  inputSchema: RenewalsDueInput,
  outputSchema: RenewalsDueOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    if (!loopbackActive(ctx)) {
      return { available: false, renewals: [] };
    }
    const client = ctx.httpClient;
    if (!client) return { available: false, renewals: [] };
    const response = await client.get<{
      success: boolean;
      data?: ReadonlyArray<Record<string, unknown>>;
    }>('/property/insurance/policies', {
      query: { tenantId: ctx.tenantId, status: 'active', limit: 500 },
    });
    const rows = response.data ?? [];
    const horizonMs = input.withinDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const renewals: Array<{
      id: string;
      policyNo: string;
      coverageType: string;
      expiresAt: string;
      daysUntilExpiry: number;
    }> = [];
    for (const r of rows) {
      const expiresAtIso = String(r.expires_at ?? '');
      const diff = new Date(expiresAtIso).getTime() - now;
      if (Number.isFinite(diff) && diff >= 0 && diff <= horizonMs) {
        renewals.push({
          id: String(r.id ?? ''),
          policyNo: String(r.policy_no ?? ''),
          coverageType: String(r.coverage_type ?? ''),
          expiresAt: expiresAtIso,
          daysUntilExpiry: Math.floor(diff / (24 * 60 * 60 * 1000)),
        });
      }
    }
    return { available: true, renewals };
  },
};

// ---------------------------------------------------------------------------
// Export catalogue.
// ---------------------------------------------------------------------------

export const INSURANCE_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  insuranceGetQuotesTool,
  insuranceBindPolicyTool,
  insurancePolicyStatusTool,
  insuranceRenewalsDueTool,
] as unknown as ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
>);
