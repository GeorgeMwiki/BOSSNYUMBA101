/**
 * Owner estate persona — family-office / holdings tools (real-estate edition).
 *
 * Ported from Borjie's owner-estate-tools.ts and retargeted from mining
 * holdco / SPV to property holdco / SPV / REIT. BossNyumba's CLAUDE.md
 * mandate explicitly lists "family office, succession, the full asset
 * register, subsidiaries, holdings" — this pack gives Mr. Mwikila the
 * brain tools for it. Five READ-ONLY tools covering the family-office
 * layer:
 *   estate.net_worth_summary       aggregate estate value by group
 *   estate.lookup_entity           find an entity by name / TIN / registry no
 *   estate.intercompany_flow_query summarise capital movements
 *   estate.succession_review_needed overdue / pending succession reviews
 *   estate.asset_register_browse   paginated asset register browse
 *
 * Persona: owner strategist (T1) only. Every tool is `isWrite: false`,
 * `stakes: 'LOW'`, `requiresPolicyRuleLiteral: false`.
 *
 * Honest-degraded contract (matches Borjie + CLAUDE.md "no fabricated
 * data"): each read defers to `/api/v1/estate/*` via the loopback client
 * so the brain and the UI would share one data path. Those estate routes
 * are NOT yet wired in BN, so:
 *   - when no client is bound, the tool returns its empty "not yet wired"
 *     shape (never fabricated numbers);
 *   - when a client IS bound but the route 404s, the brain-tool adapter
 *     surfaces the error as a denial rather than a fake answer.
 * When the BN estate routes land, these tools light up with zero call-
 * site changes.
 */

import { z } from 'zod';
import type { PersonaToolDescriptor } from './types.js';

const OWNER_ESTATE: ReadonlyArray<'T1_owner_strategist'> = [
  'T1_owner_strategist',
];

// ─────────────────────────────────────────────────────────────────────
// 1. Estate net worth summary
// ─────────────────────────────────────────────────────────────────────

const NetWorthInput = z.object({
  groupId: z.string().uuid().optional(),
});
const NetWorthOutput = z.object({
  totalValueTzs: z.number(),
  currency: z.string(),
  entityCount: z.number(),
  assetCount: z.number(),
  byEntityKind: z.record(z.number()),
});

export const estateNetWorthSummaryTool: PersonaToolDescriptor<
  typeof NetWorthInput,
  typeof NetWorthOutput
> = {
  id: 'estate.net_worth_summary',
  name: 'Estate — net worth summary',
  description:
    'Aggregate estate value across property-holding entities (holdco / ' +
    'SPV / REIT) + assets. Read-only. Defers to /api/v1/estate/assets ' +
    'and /api/v1/estate/entities (honest-empty until wired).',
  personaSlugs: OWNER_ESTATE,
  inputSchema: NetWorthInput,
  outputSchema: NetWorthOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        totalValueTzs: 0,
        currency: 'TZS',
        entityCount: 0,
        assetCount: 0,
        byEntityKind: {},
      };
    }
    const entitiesQuery: Record<string, string> = {};
    if (input.groupId) entitiesQuery.groupId = input.groupId;
    const entities = await client.get<{
      data: {
        entities: ReadonlyArray<{ kind: string }>;
        count: number;
      };
    }>('/estate/entities', { query: entitiesQuery });
    const assets = await client.get<{
      data: {
        assets: ReadonlyArray<{ currentValueTzs: string }>;
        count: number;
      };
    }>('/estate/assets', {});
    const byEntityKind: Record<string, number> = {};
    for (const e of entities.data?.entities ?? []) {
      byEntityKind[e.kind] = (byEntityKind[e.kind] ?? 0) + 1;
    }
    const totalValueTzs = (assets.data?.assets ?? []).reduce(
      (sum, a) => sum + Number(a.currentValueTzs ?? 0),
      0,
    );
    return {
      totalValueTzs,
      currency: 'TZS',
      entityCount: entities.data?.count ?? 0,
      assetCount: assets.data?.count ?? 0,
      byEntityKind,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// 2. Lookup entity
// ─────────────────────────────────────────────────────────────────────

const LookupEntityInput = z.object({
  search: z.string().trim().min(1).max(200),
});
const LookupEntityOutput = z.object({
  entities: z.array(z.record(z.any())),
});

export const estateLookupEntityTool: PersonaToolDescriptor<
  typeof LookupEntityInput,
  typeof LookupEntityOutput
> = {
  id: 'estate.lookup_entity',
  name: 'Estate — lookup entity',
  description:
    'Find an estate entity (holdco / SPV / REIT) by name / TIN / ' +
    'registry-number fragment. Read-only.',
  personaSlugs: OWNER_ESTATE,
  inputSchema: LookupEntityInput,
  outputSchema: LookupEntityOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { entities: [] };
    const res = await client.get<{
      data: { entities: ReadonlyArray<Record<string, unknown>> };
    }>('/estate/entities', {});
    const needle = input.search.toLowerCase();
    const matches = (res.data?.entities ?? []).filter((e) => {
      const record = e as {
        name?: unknown;
        tin?: unknown;
        registrationNo?: unknown;
      };
      const haystack = [record.name, record.tin, record.registrationNo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
    return { entities: matches as Array<Record<string, unknown>> };
  },
};

// ─────────────────────────────────────────────────────────────────────
// 3. Intercompany flow query
// ─────────────────────────────────────────────────────────────────────

const FlowQueryInput = z.object({
  fromEntityId: z.string().uuid().optional(),
  toEntityId: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
});
const FlowQueryOutput = z.object({
  movements: z.array(z.record(z.any())),
  totalAmountTzs: z.number(),
  currency: z.string(),
});

export const estateIntercompanyFlowTool: PersonaToolDescriptor<
  typeof FlowQueryInput,
  typeof FlowQueryOutput
> = {
  id: 'estate.intercompany_flow_query',
  name: 'Estate — intercompany flow query',
  description:
    'Summarise capital movements (inter-company loans / dividends / ' +
    'rent sweeps) between estate entities over a window. Read-only. ' +
    'Defers to /api/v1/estate/capital-movements.',
  personaSlugs: OWNER_ESTATE,
  inputSchema: FlowQueryInput,
  outputSchema: FlowQueryOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { movements: [], totalAmountTzs: 0, currency: 'TZS' };
    const query: Record<string, string> = {};
    if (input.fromEntityId) query.fromEntityId = input.fromEntityId;
    if (input.toEntityId) query.toEntityId = input.toEntityId;
    if (input.since) query.since = input.since;
    const res = await client.get<{
      data: {
        movements: ReadonlyArray<{ amount: string; currency: string }>;
      };
    }>('/estate/capital-movements', { query });
    const totalAmountTzs = (res.data?.movements ?? [])
      .filter((m) => m.currency === 'TZS')
      .reduce((sum, m) => sum + Number(m.amount ?? 0), 0);
    return {
      movements: (res.data?.movements ?? []) as unknown as Array<
        Record<string, unknown>
      >,
      totalAmountTzs,
      currency: 'TZS',
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// 4. Succession review needed
// ─────────────────────────────────────────────────────────────────────

const SuccessionReviewInput = z.object({
  groupId: z.string().uuid().optional(),
});
const SuccessionReviewOutput = z.object({
  plans: z.array(z.record(z.any())),
  overdueCount: z.number(),
});

export const estateSuccessionReviewTool: PersonaToolDescriptor<
  typeof SuccessionReviewInput,
  typeof SuccessionReviewOutput
> = {
  id: 'estate.succession_review_needed',
  name: 'Estate — succession review needed',
  description:
    'Find succession plans whose next_review_due_at has passed or is ' +
    'imminent. Read-only.',
  personaSlugs: OWNER_ESTATE,
  inputSchema: SuccessionReviewInput,
  outputSchema: SuccessionReviewOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { plans: [], overdueCount: 0 };
    const query: Record<string, string> = {};
    if (input.groupId) query.groupId = input.groupId;
    const res = await client.get<{
      data: {
        plans: ReadonlyArray<{
          nextReviewDueAt: string;
          status: string;
        }>;
      };
    }>('/estate/succession-plans', { query });
    const now = Date.now();
    const overdueCount = (res.data?.plans ?? []).filter(
      (p) => new Date(p.nextReviewDueAt).getTime() < now,
    ).length;
    return {
      plans: (res.data?.plans ?? []) as unknown as Array<
        Record<string, unknown>
      >,
      overdueCount,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// 5. Asset register browse
// ─────────────────────────────────────────────────────────────────────

const AssetBrowseInput = z.object({
  entityId: z.string().uuid().optional(),
  assetClass: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
const AssetBrowseOutput = z.object({
  assets: z.array(z.record(z.any())),
  count: z.number(),
});

export const estateAssetRegisterBrowseTool: PersonaToolDescriptor<
  typeof AssetBrowseInput,
  typeof AssetBrowseOutput
> = {
  id: 'estate.asset_register_browse',
  name: 'Estate — asset register browse',
  description:
    'Paginated browse of the estate asset register (land / buildings / ' +
    'building systems / fixtures). Read-only.',
  personaSlugs: OWNER_ESTATE,
  inputSchema: AssetBrowseInput,
  outputSchema: AssetBrowseOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { assets: [], count: 0 };
    const query: Record<string, string> = { limit: String(input.limit) };
    if (input.entityId) query.entityId = input.entityId;
    if (input.assetClass) query.assetClass = input.assetClass;
    const res = await client.get<{
      data: {
        assets: ReadonlyArray<Record<string, unknown>>;
        count: number;
      };
    }>('/estate/assets', { query });
    return {
      assets: (res.data?.assets ?? []) as Array<Record<string, unknown>>,
      count: res.data?.count ?? 0,
    };
  },
};

export const OWNER_ESTATE_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  estateNetWorthSummaryTool,
  estateLookupEntityTool,
  estateIntercompanyFlowTool,
  estateSuccessionReviewTool,
  estateAssetRegisterBrowseTool,
] as unknown as readonly PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>[]);
