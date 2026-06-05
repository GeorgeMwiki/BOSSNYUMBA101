/**
 * Housing-cooperative settlement brain tools — chat-as-OS parity for
 * migration 0304.
 *
 * Three tools backing `/api/v1/cooperatives/settlement-periods`:
 *
 *   - `cooperative.draft_settlement`        WRITE: create a draft period
 *   - `cooperative.member_share`            READ:  per-member distributions
 *   - `cooperative.settlement_period_list`  READ:  list periods
 *
 * The WRITE tool is MEDIUM stakes — it lands a draft row only. The
 * calculate + approve + distribute actions remain in the explicit route
 * because distribute crosses the four-eye gate (HIGH stakes) and posts
 * through LedgerService.post(); the brain MUST hit the literal four-eye
 * policy rule per CLAUDE.md.
 *
 * Persona scope: T1 owner_strategist (the housing-cooperative operator
 * runs settlements from the owner cockpit).
 *
 * Ported from Borjie's `cooperative-tools.ts` and retargeted mining →
 * real estate. Unlike Borjie's `member_share` (a TODO returning []),
 * this reads the real `GET /settlement-periods/:id/members` surface.
 */

import { z } from 'zod';

import type { PersonaToolDescriptor } from './types.js';
import { withChatProvenance } from './provenance-injector.js';

const OWNER: ReadonlyArray<'T1_owner_strategist'> = ['T1_owner_strategist'];

// ---------------------------------------------------------------------------
// 1. cooperative.draft_settlement (WRITE)
// ---------------------------------------------------------------------------

const DraftInput = z.object({
  cooperativePartyId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currencyCode: z.string().length(3).optional(),
  serviceChargeCollected: z.number().nonnegative().default(0),
  sinkingFundCollected: z.number().nonnegative().default(0),
  rentShareCollected: z.number().nonnegative().default(0),
  operatingExpenses: z.number().nonnegative().default(0),
});

const DraftOutput = z.object({
  id: z.string(),
  status: z.string(),
  netDistributable: z.string(),
  currencyCode: z.string(),
});

export const cooperativeDraftSettlementTool: PersonaToolDescriptor<
  typeof DraftInput,
  typeof DraftOutput
> = {
  id: 'cooperative.draft_settlement',
  name: 'Cooperative — draft settlement period (en) / Ushirika — andaa kipindi cha malipo (sw)',
  description:
    'Create a draft housing-cooperative settlement period with the ' +
    'collected pool (service-charge + sinking-fund + rent-share) and ' +
    'operating expenses. Computes the net-distributable amount. Status ' +
    'starts at draft; calculate + approve + distribute remain explicit ' +
    'steps (distribute crosses the four-eye gate and posts through the ' +
    'ledger).',
  personaSlugs: OWNER,
  inputSchema: DraftInput,
  outputSchema: DraftOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const currencyCode = (input.currencyCode ?? 'TZS').toUpperCase();
    const client = ctx.httpClient;
    if (!client) {
      const net = Math.max(
        0,
        input.serviceChargeCollected +
          input.sinkingFundCollected +
          input.rentShareCollected -
          input.operatingExpenses,
      );
      return {
        id: '',
        status: 'draft',
        netDistributable: String(net),
        currencyCode,
      };
    }
    const response = await client.post<{
      success: boolean;
      data?: Record<string, unknown>;
    }>(
      '/cooperatives/settlement-periods',
      withChatProvenance(
        {
          tenantId: ctx.tenantId,
          actorId: ctx.actorId,
          cooperativePartyId: input.cooperativePartyId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          currencyCode,
          serviceChargeCollected: input.serviceChargeCollected,
          sinkingFundCollected: input.sinkingFundCollected,
          rentShareCollected: input.rentShareCollected,
          operatingExpenses: input.operatingExpenses,
        },
        ctx,
      ),
    );
    const row = response.data ?? {};
    return {
      id: String(row.id ?? ''),
      status: String(row.status ?? 'draft'),
      netDistributable: String(row.net_distributable ?? '0'),
      currencyCode: String(row.currency_code ?? currencyCode),
    };
  },
};

// ---------------------------------------------------------------------------
// 2. cooperative.member_share (READ)
// ---------------------------------------------------------------------------

const MemberShareInput = z.object({
  periodId: z.string().uuid(),
});

const MemberShareOutput = z.object({
  periodId: z.string(),
  status: z.string(),
  currencyCode: z.string(),
  netDistributable: z.string(),
  members: z.array(
    z.object({
      memberHouseholdPartyId: z.string(),
      sharePct: z.string(),
      amount: z.string(),
      paidAt: z.string().nullable(),
      paymentRef: z.string().nullable(),
    }),
  ),
});

export const cooperativeMemberShareTool: PersonaToolDescriptor<
  typeof MemberShareInput,
  typeof MemberShareOutput
> = {
  id: 'cooperative.member_share',
  name: 'Cooperative — member share breakdown (en) / Ushirika — mgawanyo wa wanachama (sw)',
  description:
    'List the per-member-household distributions for a settlement ' +
    'period: each share percentage, amount, and (once distributed) ' +
    'whether it was paid plus the ledger payment_ref. Read-only — reads ' +
    'GET /cooperatives/settlement-periods/:id/members.',
  personaSlugs: OWNER,
  inputSchema: MemberShareInput,
  outputSchema: MemberShareOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const empty = {
      periodId: input.periodId,
      status: 'unknown',
      currencyCode: '',
      netDistributable: '0',
      members: [] as Array<{
        memberHouseholdPartyId: string;
        sharePct: string;
        amount: string;
        paidAt: string | null;
        paymentRef: string | null;
      }>,
    };
    const client = ctx.httpClient;
    if (!client) return empty;
    const response = await client.get<{
      success: boolean;
      data?: {
        periodId?: string;
        status?: string;
        currencyCode?: string;
        netDistributable?: string | number;
        members?: ReadonlyArray<Record<string, unknown>>;
      };
    }>(
      `/cooperatives/settlement-periods/${encodeURIComponent(
        input.periodId,
      )}/members`,
    );
    const data = response.data;
    if (!data) return empty;
    const rows = data.members ?? [];
    return {
      periodId: String(data.periodId ?? input.periodId),
      status: String(data.status ?? 'unknown'),
      currencyCode: String(data.currencyCode ?? ''),
      netDistributable: String(data.netDistributable ?? '0'),
      members: rows.map((r) => ({
        memberHouseholdPartyId: String(r.member_household_party_id ?? ''),
        sharePct: String(r.share_pct ?? '0'),
        amount: String(r.amount ?? '0'),
        paidAt: r.paid_at != null ? String(r.paid_at) : null,
        paymentRef: r.payment_ref != null ? String(r.payment_ref) : null,
      })),
    };
  },
};

// ---------------------------------------------------------------------------
// 3. cooperative.settlement_period_list (READ)
// ---------------------------------------------------------------------------

const PeriodListInput = z.object({
  cooperativePartyId: z.string().uuid().optional(),
  status: z
    .enum(['draft', 'calculated', 'approved', 'distributed', 'contested'])
    .optional(),
  limit: z.number().int().positive().max(100).default(20),
});

const PeriodListOutput = z.object({
  periods: z.array(
    z.object({
      id: z.string(),
      cooperativePartyId: z.string(),
      periodStart: z.string(),
      periodEnd: z.string(),
      status: z.string(),
      currencyCode: z.string(),
      netDistributable: z.string(),
    }),
  ),
});

export const cooperativeSettlementPeriodListTool: PersonaToolDescriptor<
  typeof PeriodListInput,
  typeof PeriodListOutput
> = {
  id: 'cooperative.settlement_period_list',
  name: 'Cooperative — list settlement periods (en) / Ushirika — orodha ya vipindi (sw)',
  description:
    'List housing-cooperative settlement periods, optionally filtered ' +
    'by cooperative and/or status. Read-only — defers to ' +
    'GET /cooperatives/settlement-periods.',
  personaSlugs: OWNER,
  inputSchema: PeriodListInput,
  outputSchema: PeriodListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { periods: [] };
    const query: Record<string, string | number | undefined> = {
      limit: input.limit,
    };
    if (input.cooperativePartyId) {
      query.cooperativePartyId = input.cooperativePartyId;
    }
    if (input.status) query.status = input.status;
    const response = await client.get<{
      success: boolean;
      data?: ReadonlyArray<Record<string, unknown>>;
    }>('/cooperatives/settlement-periods', { query });
    const rows = response.data ?? [];
    return {
      periods: rows.map((r) => ({
        id: String(r.id ?? ''),
        cooperativePartyId: String(r.cooperative_party_id ?? ''),
        periodStart: String(r.period_start ?? ''),
        periodEnd: String(r.period_end ?? ''),
        status: String(r.status ?? ''),
        currencyCode: String(r.currency_code ?? ''),
        netDistributable: String(r.net_distributable ?? '0'),
      })),
    };
  },
};

// ---------------------------------------------------------------------------
// Catalog export — included by `buildPersonaToolHandlers` in index.ts.
// ---------------------------------------------------------------------------

export const COOPERATIVE_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  cooperativeDraftSettlementTool,
  cooperativeMemberShareTool,
  cooperativeSettlementPeriodListTool,
] as unknown as ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
>);
