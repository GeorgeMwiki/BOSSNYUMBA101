/**
 * Opportunity-Scanner — brain tool catalog (BossNyumba real-estate).
 *
 * Wires the 33-rule opportunity scanner (`services/opportunity-scanner/`)
 * into the brain's persona-aware tool catalog. Ported from Borjie
 * `services/api-gateway/src/composition/brain-tools/opportunity-scanner-
 * tools.ts`; mining domain terms (fuel arbitrage, ore parcel) are
 * replaced with the real-estate ScanState shape already exported by
 * BN's scanner (vacancy, rent uplift, lease renewals).
 *
 * Two tools surface here:
 *
 *   1. `property.opportunities.scan`
 *        Read-only. Asks the injected ScanState builder for the current
 *        tenant's slice, runs every rule, returns the top N opportunities
 *        ranked by expectedValue × confidence × time urgency. Pushes a
 *        cockpit `opportunity.scan_completed` event so the owner-portal
 *        toast tile updates without polling.
 *
 *   2. `property.opportunities.list_rules`
 *        Read-only. Lists every rule the engine carries with its id,
 *        kind, and short description. Used when the owner asks
 *        "what kinds of opportunities do you check for?" so the answer
 *        cites real rule ids instead of fabricating them.
 *
 * Persona binding: T1 owner strategist + T2 admin strategist
 * (dogfooding) only. Same surface as decision-journal + entity-
 * legibility tools.
 *
 * Tier discipline: every tool is `isWrite: false`, `stakes: 'LOW'`,
 * `requiresPolicyRuleLiteral: false`. The scanner has no side effects
 * beyond the cockpit SSE notify (which is fire-and-forget).
 *
 * Tenant isolation: handlers resolve `tenantId` from the persona
 * context; the api-gateway middleware binds `app.tenant_id` so every
 * resolver SELECT scopes via RLS. No tool reaches across tenants.
 *
 * Composition: configureOpportunityScannerTools({ buildScanState }) is
 * called once at boot in services/api-gateway/src/index.ts. When the
 * builder is null (e.g. degraded mode, resolver not yet wired) the
 * tool returns an empty list with `ruleCount: ALL_SCAN_RULES.length` so
 * the brain still has an accurate catalogue answer for list_rules.
 */

import { z } from 'zod';

import {
  ALL_SCAN_RULES,
  OPPORTUNITY_KINDS,
  scanOpportunities,
  type ScanState,
} from '../../services/opportunity-scanner/index.js';
import { publishCockpitEvent } from '../../services/cockpit-events/index.js';
import type { PersonaToolDescriptor } from './types.js';

const OWNER_AND_ADMIN: ReadonlyArray<
  'T1_owner_strategist' | 'T2_admin_strategist'
> = ['T1_owner_strategist', 'T2_admin_strategist'];

/**
 * Tenant-scoped builder for the materialised ScanState every rule
 * inspects. Bound at composition time to a Drizzle-backed reader that
 * pulls portfolio / market / tax / regulator / estate / cash signals
 * for the calling tenant.
 *
 * Returning `null` is the canonical "no data resolver yet" signal —
 * the brain tool answers gracefully with an empty opportunities list
 * (so the owner sees "no upside surfaced this turn" rather than a
 * tool error).
 */
export type ScanStateBuilder = (
  tenantId: string,
  nowIso: string,
) => Promise<ScanState | null>;

interface ToolDeps {
  readonly buildScanState?: ScanStateBuilder;
}

let injectedDeps: ToolDeps = Object.freeze({});

/**
 * Wire the scanner-state builder at composition time. Called once from
 * the api-gateway composition root.
 */
export function configureOpportunityScannerTools(deps: ToolDeps): void {
  injectedDeps = Object.freeze({
    ...(deps.buildScanState !== undefined && {
      buildScanState: deps.buildScanState,
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────
// 1. property.opportunities.scan
// ─────────────────────────────────────────────────────────────────────

const ScanInput = z.object({
  maxResults: z.number().int().min(1).max(5).default(3),
  minExpectedValue: z.number().nonnegative().optional(),
  kindFilter: z.array(z.enum(OPPORTUNITY_KINDS)).max(12).optional(),
  scopeIds: z.array(z.string().min(1).max(40)).max(8).optional(),
});

const OpportunityRow = z.object({
  id: z.string(),
  kind: z.enum(OPPORTUNITY_KINDS),
  headlineEn: z.string(),
  headlineSw: z.string(),
  expectedValue: z.number().nullable(),
  currencyCode: z.string(),
  confidence: z.number(),
  timeWindowDays: z.number().int(),
  citations: z.array(z.string()),
});

const ScanOutput = z.object({
  generatedAt: z.string(),
  opportunities: z.array(OpportunityRow),
  ruleCount: z.number().int(),
  resolverBound: z.boolean(),
});

export const opportunityScanTool: PersonaToolDescriptor<
  typeof ScanInput,
  typeof ScanOutput
> = {
  id: 'property.opportunities.scan',
  name: 'Opportunities — scan',
  description:
    'Scan the tenant for upside (vacancy reduction, rent uplift, ' +
    'tax efficiency windows, regulator amnesties, capital routing, ' +
    'market timing, peer best-practice). Returns top N ranked ' +
    'opportunities. Read-only; no side effects beyond a cockpit ' +
    'notification. Default cap = 3.',
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: ScanInput,
  outputSchema: ScanOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const nowIso = new Date().toISOString();
    const builder = injectedDeps.buildScanState;
    if (!builder) {
      return {
        generatedAt: nowIso,
        opportunities: [],
        ruleCount: ALL_SCAN_RULES.length,
        resolverBound: false,
      };
    }

    const state = await builder(ctx.tenantId, nowIso);
    if (!state) {
      return {
        generatedAt: nowIso,
        opportunities: [],
        ruleCount: ALL_SCAN_RULES.length,
        resolverBound: true,
      };
    }

    const options: Parameters<typeof scanOpportunities>[1] = {
      maxResults: input.maxResults,
    };
    if (input.minExpectedValue !== undefined) {
      (options as { minExpectedValue?: number }).minExpectedValue =
        input.minExpectedValue;
    }
    if (input.kindFilter && input.kindFilter.length > 0) {
      (
        options as {
          kindFilter?: ReadonlyArray<(typeof OPPORTUNITY_KINDS)[number]>;
        }
      ).kindFilter = input.kindFilter;
    }
    if (input.scopeIds && input.scopeIds.length > 0) {
      (options as { scopeIds?: ReadonlyArray<string> }).scopeIds =
        input.scopeIds;
    }
    const opportunities = scanOpportunities(state, options);

    // R6 — cockpit SSE notify. We push only when at least one
    // opportunity surfaced so the toast carries actionable signal.
    if (opportunities.length > 0) {
      const top = opportunities[0];
      try {
        publishCockpitEvent({
          kind: 'opportunity.scan_completed',
          tenantId: ctx.tenantId,
          emittedAt: nowIso,
          opportunityCount: opportunities.length,
          topExpectedValue: top?.expectedValue ?? 0,
          currencyCode: top?.currencyCode ?? state.primaryCurrencyCode ?? 'TZS',
        });
      } catch {
        // Best-effort — bus failures must never crash the brain.
      }
    }

    return {
      generatedAt: nowIso,
      opportunities: opportunities.map((o) => ({
        id: o.id,
        kind: o.kind,
        headlineEn: o.headline.en,
        headlineSw: o.headline.sw,
        expectedValue: o.expectedValue ?? null,
        currencyCode: o.currencyCode,
        confidence: o.confidence,
        timeWindowDays: o.timeWindowDays,
        citations: [...o.citations],
      })),
      ruleCount: ALL_SCAN_RULES.length,
      resolverBound: true,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// 2. property.opportunities.list_rules
// ─────────────────────────────────────────────────────────────────────

const ListRulesInput = z.object({
  kindFilter: z.array(z.enum(OPPORTUNITY_KINDS)).max(12).optional(),
});

const RuleSummary = z.object({
  id: z.string(),
  kind: z.enum(OPPORTUNITY_KINDS),
  title: z.string(),
});

const ListRulesOutput = z.object({
  rules: z.array(RuleSummary),
  totalRules: z.number().int(),
});

export const opportunityListRulesTool: PersonaToolDescriptor<
  typeof ListRulesInput,
  typeof ListRulesOutput
> = {
  id: 'property.opportunities.list_rules',
  name: 'Opportunities — list rules',
  description:
    'List every opportunity-detection rule the brain checks for. ' +
    'Each entry returns the rule id, opportunity kind, and a short title. ' +
    'Read-only; surfaces the rule catalogue so the brain can cite real ids.',
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: ListRulesInput,
  outputSchema: ListRulesOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input) {
    const kindFilter =
      input.kindFilter && input.kindFilter.length > 0
        ? new Set<(typeof OPPORTUNITY_KINDS)[number]>(input.kindFilter)
        : null;
    const rules = ALL_SCAN_RULES.filter(
      (r) => !kindFilter || kindFilter.has(r.kind),
    ).map((r) => ({
      id: r.id,
      kind: r.kind,
      // Rule descriptors do not carry a separate title field; use the id
      // canonical form ("rent-uplift-renewal" → "Rent uplift renewal").
      title: r.id
        .replace(/[-_.]/g, ' ')
        .replace(/^./, (c) => c.toUpperCase()),
    }));
    return { rules, totalRules: ALL_SCAN_RULES.length };
  },
};

// ─────────────────────────────────────────────────────────────────────
// Catalog barrel
// ─────────────────────────────────────────────────────────────────────

// Cast through `as unknown as` so the array literal of two descriptors
// with different concrete zod generics collapses to the catalog's
// covariant `PersonaToolDescriptor<ZodTypeAny, ZodTypeAny>` shape.
export const OPPORTUNITY_SCANNER_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  opportunityScanTool,
  opportunityListRulesTool,
] as unknown as readonly PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>[]);
