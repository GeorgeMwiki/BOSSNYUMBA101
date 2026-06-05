/**
 * Scope roll-up brain tools (real-estate edition) — Gap-4 (b).
 *
 * Ported from Borjie's `composition/brain-tools/scope-tools.ts` and
 * retargeted mining → real estate:
 *   - scope kinds  pit / site / region   → building / unit / block /
 *                                          portfolio
 *   - roll-up metrics (production / etc.) → occupancy / maintenance-cost /
 *                                          rent-collected (and other
 *                                          property KPIs by metricId)
 *
 * Five READ-ONLY tools backing a property scope-intelligence layer. Each
 * tool would defer to a `/property/scope/*` loopback endpoint so the LLM
 * and the cockpit render identical data (no parallel data paths).
 *
 * Persona binding: owner strategist (T1) + admin strategist (T2) — admins
 * frequently inspect tenant scope hierarchies when debugging.
 *
 * Tier discipline: every tool is `isWrite: false`, `stakes: 'LOW'`,
 * `requiresPolicyRuleLiteral: false`. None mutate state.
 *
 * HONEST-DEGRADE (CLAUDE.md hard rule + Gap-4 spec): BN does NOT yet
 * expose the `/property/scope/*` routes these tools target. So every tool
 * returns a typed `available: false` shape with empty / zeroed results
 * rather than a fabricated roll-up. The `SCOPE_ROUTES_WIRED` flag below is
 * the single switch that activates the real loopback once the scope routes
 * land. We deliberately do NOT call the loopback while the routes are
 * absent (the loopback client throws on a 404 → a tool DENIAL, which reads
 * as an error rather than the honest "unavailable" the brain should relay).
 *
 * Multi-currency (CLAUDE.md hard rule): money roll-ups (e.g.
 * rent-collected, maintenance-cost) carry a `currency` field rather than a
 * hard-coded code; the display surface formats with formatCurrency. The
 * `metricUnit` discriminates money vs count vs percent.
 */

import { z } from 'zod';
import type {
  PersonaToolDescriptor,
  PersonaToolHandlerContext,
} from './types.js';

/**
 * Single switch: are the `/property/scope/*` loopback routes mounted in the
 * api-gateway yet? While `false`, every scope tool honest-degrades to a
 * typed `available:false` shape (never fabricates). Flip to `true` when the
 * routes land — the per-tool loopback branches below then activate.
 */
const SCOPE_ROUTES_WIRED = false;

const OWNER_AND_ADMIN: ReadonlyArray<
  'T1_owner_strategist' | 'T2_admin_strategist'
> = ['T1_owner_strategist', 'T2_admin_strategist'];

/** Canonical property scope kinds (retargeted pit/site/region). */
const SCOPE_KINDS = ['building', 'unit', 'block', 'portfolio'] as const;

/** True only when the loopback is BOTH wired AND a client is bound. */
function loopbackActive(ctx: PersonaToolHandlerContext): boolean {
  return SCOPE_ROUTES_WIRED && ctx.httpClient !== undefined;
}

// ─────────────────────────────────────────────────────────────────────
// 1. property.scope.resolve_label
// ─────────────────────────────────────────────────────────────────────

const ResolveLabelInput = z.object({
  kindCanonical: z.enum(SCOPE_KINDS),
  // English default per CLAUDE.md.
  locale: z.enum(['en', 'sw']).default('en'),
});
const ResolveLabelOutput = z.object({
  available: z.boolean(),
  kindCanonical: z.string(),
  labelEn: z.string(),
  labelSw: z.string(),
  resolved: z.string(),
});

/** Built-in EN+SW default labels so resolve degrades to a real answer. */
const DEFAULT_SCOPE_LABELS: Record<
  (typeof SCOPE_KINDS)[number],
  { en: string; sw: string }
> = {
  building: { en: 'Building', sw: 'Jengo' },
  unit: { en: 'Unit', sw: 'Kipande' },
  block: { en: 'Block', sw: 'Kitalu' },
  portfolio: { en: 'Portfolio', sw: 'Mkusanyiko' },
};

export const scopeResolveLabelTool: PersonaToolDescriptor<
  typeof ResolveLabelInput,
  typeof ResolveLabelOutput
> = {
  id: 'property.scope.resolve_label',
  name: 'Scope — resolve label (en) / Wigo — tafsiri lebo (sw)',
  description:
    'Resolve a canonical property scope kind (building / unit / block / ' +
    "portfolio) to the tenant's preferred display label in en + sw. " +
    "Honours the tenant's custom label when the scope routes are wired; " +
    'otherwise returns the built-in default label (available:false). ' +
    'Always speak the resolved label rather than the canonical kind.',
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: ResolveLabelInput,
  outputSchema: ResolveLabelOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const defaults = DEFAULT_SCOPE_LABELS[input.kindCanonical];
    const resolvedDefault =
      input.locale === 'sw' ? defaults.sw : defaults.en;
    if (!loopbackActive(ctx)) {
      return {
        available: false,
        kindCanonical: input.kindCanonical,
        labelEn: defaults.en,
        labelSw: defaults.sw,
        resolved: resolvedDefault,
      };
    }
    const client = ctx.httpClient;
    if (!client) {
      return {
        available: false,
        kindCanonical: input.kindCanonical,
        labelEn: defaults.en,
        labelSw: defaults.sw,
        resolved: resolvedDefault,
      };
    }
    const res = await client.get<{
      kindCanonical: string;
      labelEn: string;
      labelSw: string;
      resolved: string;
    }>('/property/scope/labels/resolve', {
      query: {
        tenantId: ctx.tenantId,
        kindCanonical: input.kindCanonical,
        locale: input.locale,
      },
    });
    return {
      available: true,
      kindCanonical: res.kindCanonical,
      labelEn: res.labelEn,
      labelSw: res.labelSw,
      resolved: res.resolved,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// 2. property.scope.roll_up_across_scopes
// ─────────────────────────────────────────────────────────────────────

const RollUpInput = z.object({
  scopeNodeIds: z.array(z.string().uuid()).min(1).max(200),
  /**
   * Metric to roll up — e.g. `occupancy`, `maintenance_cost`,
   * `rent_collected`, or any property KPI id the scope service knows.
   */
  metricId: z.string().min(1).max(120),
});
const RollUpOutput = z.object({
  available: z.boolean(),
  metricId: z.string(),
  total: z.number(),
  mean: z.number(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  count: z.number().int().nonnegative(),
  /** Money roll-ups carry a currency code; non-money are null. */
  currency: z.string().nullable(),
  perScope: z.array(
    z.object({
      scopeNodeId: z.string(),
      value: z.number(),
      unit: z.string().optional(),
    }),
  ),
});

export const scopeRollUpTool: PersonaToolDescriptor<
  typeof RollUpInput,
  typeof RollUpOutput
> = {
  id: 'property.scope.roll_up_across_scopes',
  name: 'Scope — roll up a metric (en) / Wigo — jumlisha kipimo (sw)',
  description:
    'Sum / mean / min / max / count a metric across a set of scope node ' +
    'ids. Use when the owner asks "how is occupancy / maintenance cost / ' +
    'rent collected across all my buildings / blocks / the portfolio" — ' +
    'returns the rolled-up figure plus the per-scope breakdown. Money ' +
    'metrics carry a currency field (never a hard-coded code). Honest-' +
    'degrades to available:false (zeros) until the scope routes are wired.',
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: RollUpInput,
  outputSchema: RollUpOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    if (!loopbackActive(ctx)) {
      return {
        available: false,
        metricId: input.metricId,
        total: 0,
        mean: 0,
        min: null,
        max: null,
        count: 0,
        currency: null,
        perScope: [],
      };
    }
    const client = ctx.httpClient;
    if (!client) {
      return {
        available: false,
        metricId: input.metricId,
        total: 0,
        mean: 0,
        min: null,
        max: null,
        count: 0,
        currency: null,
        perScope: [],
      };
    }
    const res = await client.post<{
      metricId: string;
      total: number;
      mean: number;
      min: number | null;
      max: number | null;
      count: number;
      currency: string | null;
      perScope: Array<{ scopeNodeId: string; value: number; unit?: string }>;
    }>('/property/scope/metrics/roll-up', {
      tenantId: ctx.tenantId,
      scopeNodeIds: input.scopeNodeIds,
      metricId: input.metricId,
    });
    return {
      available: true,
      metricId: res.metricId,
      total: res.total,
      mean: res.mean,
      min: res.min,
      max: res.max,
      count: res.count,
      currency: res.currency ?? null,
      perScope: res.perScope,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// 3. property.scope.compare_across_scopes
// ─────────────────────────────────────────────────────────────────────

const CompareInput = z.object({
  scopeNodeIds: z.array(z.string().uuid()).min(2).max(50),
  metricId: z.string().min(1).max(120),
});
const CompareOutput = z.object({
  available: z.boolean(),
  metricId: z.string(),
  mean: z.number(),
  currency: z.string().nullable(),
  topScopeNodeId: z.string().nullable(),
  bottomScopeNodeId: z.string().nullable(),
  ranking: z.array(
    z.object({
      scopeNodeId: z.string(),
      value: z.number(),
      rank: z.number().int().positive(),
      deltaFromMean: z.number(),
    }),
  ),
});

export const scopeCompareTool: PersonaToolDescriptor<
  typeof CompareInput,
  typeof CompareOutput
> = {
  id: 'property.scope.compare_across_scopes',
  name: 'Scope — compare across scopes (en) / Wigo — linganisha maeneo (sw)',
  description:
    'Rank multiple scope nodes against each other on a single metric. Use ' +
    'when the owner asks "which building leads on occupancy" or "which ' +
    'block has the highest maintenance cost". Returns ranking + top + ' +
    'bottom + delta-from-mean per scope. Honest-degrades to ' +
    'available:false (empty ranking) until the scope routes are wired.',
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: CompareInput,
  outputSchema: CompareOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    if (!loopbackActive(ctx)) {
      return {
        available: false,
        metricId: input.metricId,
        mean: 0,
        currency: null,
        topScopeNodeId: null,
        bottomScopeNodeId: null,
        ranking: [],
      };
    }
    const client = ctx.httpClient;
    if (!client) {
      return {
        available: false,
        metricId: input.metricId,
        mean: 0,
        currency: null,
        topScopeNodeId: null,
        bottomScopeNodeId: null,
        ranking: [],
      };
    }
    const res = await client.post<{
      metricId: string;
      mean: number;
      currency: string | null;
      topScopeNodeId: string | null;
      bottomScopeNodeId: string | null;
      ranking: Array<{
        scopeNodeId: string;
        value: number;
        rank: number;
        deltaFromMean: number;
      }>;
    }>('/property/scope/metrics/compare', {
      tenantId: ctx.tenantId,
      scopeNodeIds: input.scopeNodeIds,
      metricId: input.metricId,
    });
    return {
      available: true,
      metricId: res.metricId,
      mean: res.mean,
      currency: res.currency ?? null,
      topScopeNodeId: res.topScopeNodeId,
      bottomScopeNodeId: res.bottomScopeNodeId,
      ranking: res.ranking,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// 4. property.scope.cross_domain_scope_matrix
// ─────────────────────────────────────────────────────────────────────

const MatrixInput = z.object({
  scopeNodeIds: z.array(z.string().uuid()).min(1).max(50),
  domains: z.array(z.string().min(1).max(40)).min(1).max(14),
});
const MatrixOutput = z.object({
  available: z.boolean(),
  scopeNodeIds: z.array(z.string()),
  domains: z.array(z.string()),
  cells: z.array(
    z.object({
      scopeNodeId: z.string(),
      domainId: z.string(),
      status: z.enum(['green', 'amber', 'red', 'unknown']),
      note: z.string().optional(),
    }),
  ),
});

export const scopeCrossDomainMatrixTool: PersonaToolDescriptor<
  typeof MatrixInput,
  typeof MatrixOutput
> = {
  id: 'property.scope.cross_domain_scope_matrix',
  name: 'Scope — cross-domain matrix (en) / Wigo — jedwali la nyanja (sw)',
  description:
    'For a fixed scope set + a fixed domain set (e.g. leasing / ' +
    'maintenance / compliance / rent), build the per-scope x per-domain ' +
    'status matrix. Use when the owner asks for the health of every ' +
    'building across every domain — returns one cell per (scope, domain) ' +
    'with green / amber / red / unknown tone. Honest-degrades to ' +
    'available:false (empty cells) until the scope routes are wired.',
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: MatrixInput,
  outputSchema: MatrixOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    if (!loopbackActive(ctx)) {
      return {
        available: false,
        scopeNodeIds: input.scopeNodeIds,
        domains: input.domains,
        cells: [],
      };
    }
    const client = ctx.httpClient;
    if (!client) {
      return {
        available: false,
        scopeNodeIds: input.scopeNodeIds,
        domains: input.domains,
        cells: [],
      };
    }
    const res = await client.post<{
      scopeNodeIds: string[];
      domains: string[];
      cells: Array<{
        scopeNodeId: string;
        domainId: string;
        status: 'green' | 'amber' | 'red' | 'unknown';
        note?: string;
      }>;
    }>('/property/scope/matrix/cross-domain', {
      tenantId: ctx.tenantId,
      scopeNodeIds: input.scopeNodeIds,
      domains: input.domains,
    });
    return {
      available: true,
      scopeNodeIds: res.scopeNodeIds,
      domains: res.domains,
      cells: res.cells,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// 5. property.scope.taxonomy_display_for
// ─────────────────────────────────────────────────────────────────────

const TaxonomyDisplayInput = z.object({});
const TaxonomyDisplayOutput = z.object({
  available: z.boolean(),
  defaultKind: z.string(),
  displayLabelEn: z.record(z.string()),
  displayLabelSw: z.record(z.string()),
  updatedAt: z.string(),
});

export const scopeTaxonomyDisplayTool: PersonaToolDescriptor<
  typeof TaxonomyDisplayInput,
  typeof TaxonomyDisplayOutput
> = {
  id: 'property.scope.taxonomy_display_for',
  name: 'Scope — taxonomy for tenant (en) / Wigo — taksonomia ya mpangaji (sw)',
  description:
    "Read the tenant's full scope-label map (every canonical kind -> sw + " +
    'en label) plus the tenant default kind. Call this once per ' +
    'conversation to learn the labels then use ' +
    'property.scope.resolve_label for ad-hoc lookups. Honest-degrades to ' +
    'available:false with the built-in default label map until the scope ' +
    'routes are wired.',
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: TaxonomyDisplayInput,
  outputSchema: TaxonomyDisplayOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(_input, ctx) {
    const defaultEn: Record<string, string> = {};
    const defaultSw: Record<string, string> = {};
    for (const kind of SCOPE_KINDS) {
      defaultEn[kind] = DEFAULT_SCOPE_LABELS[kind].en;
      defaultSw[kind] = DEFAULT_SCOPE_LABELS[kind].sw;
    }
    if (!loopbackActive(ctx)) {
      return {
        available: false,
        defaultKind: 'building',
        displayLabelEn: defaultEn,
        displayLabelSw: defaultSw,
        updatedAt: new Date().toISOString(),
      };
    }
    const client = ctx.httpClient;
    if (!client) {
      return {
        available: false,
        defaultKind: 'building',
        displayLabelEn: defaultEn,
        displayLabelSw: defaultSw,
        updatedAt: new Date().toISOString(),
      };
    }
    const res = await client.get<{
      defaultKind: string;
      displayLabelEn: Record<string, string>;
      displayLabelSw: Record<string, string>;
      updatedAt: string;
    }>('/property/scope/taxonomy', {
      query: { tenantId: ctx.tenantId },
    });
    return {
      available: true,
      defaultKind: res.defaultKind,
      displayLabelEn: res.displayLabelEn,
      displayLabelSw: res.displayLabelSw,
      updatedAt: res.updatedAt,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// Catalog export
// ─────────────────────────────────────────────────────────────────────

export const SCOPE_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  scopeResolveLabelTool,
  scopeRollUpTool,
  scopeCompareTool,
  scopeCrossDomainMatrixTool,
  scopeTaxonomyDisplayTool,
] as unknown as ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
>);
