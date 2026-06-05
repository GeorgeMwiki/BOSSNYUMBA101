/**
 * cooperative-tools — descriptor metadata + http-client wiring tests.
 *
 * Mirrors rent-payout-tools.test.ts: asserts persona scope / stakes,
 * the WRITE provenance wrap, the members-read mapping (Borjie's TODO,
 * now a real endpoint), the list query construction, and the no-client
 * honest-degrade shapes.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  COOPERATIVE_TOOLS,
  cooperativeDraftSettlementTool,
  cooperativeMemberShareTool,
  cooperativeSettlementPeriodListTool,
} from '../cooperative-tools.js';
import type { PersonaToolHandlerContext } from '../types.js';

const TENANT = '00000000-0000-0000-0000-000000000000';
const COOP = '11111111-1111-1111-1111-111111111111';
const PERIOD = '22222222-2222-2222-2222-222222222222';
const MEMBER = '33333333-3333-3333-3333-333333333333';

function makeCtx(
  client?: Partial<PersonaToolHandlerContext['httpClient']>,
): PersonaToolHandlerContext {
  return {
    tenantId: TENANT,
    actorId: 'actor-owner',
    personaSlug: 'T1_owner_strategist',
    ...(client
      ? {
          httpClient: {
            get: vi.fn(),
            post: vi.fn(),
            ...client,
          } as unknown as PersonaToolHandlerContext['httpClient'],
        }
      : {}),
  };
}

describe('COOPERATIVE_TOOLS catalog', () => {
  it('exports exactly 3 descriptors with the canonical ids', () => {
    expect(COOPERATIVE_TOOLS).toHaveLength(3);
    expect(COOPERATIVE_TOOLS.map((t) => t.id)).toEqual([
      'cooperative.draft_settlement',
      'cooperative.member_share',
      'cooperative.settlement_period_list',
    ]);
  });

  it('scopes every tool to the T1 owner persona', () => {
    for (const tool of COOPERATIVE_TOOLS) {
      expect(tool.personaSlugs).toEqual(['T1_owner_strategist']);
      expect(tool.requiresPolicyRuleLiteral).toBe(false);
    }
  });
});

describe('cooperativeDraftSettlementTool (WRITE)', () => {
  it('is MEDIUM-stakes and a write', () => {
    expect(cooperativeDraftSettlementTool.stakes).toBe('MEDIUM');
    expect(cooperativeDraftSettlementTool.isWrite).toBe(true);
  });

  it('POSTs the draft with chat provenance and returns the row', async () => {
    const post = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: PERIOD,
        status: 'draft',
        net_distributable: '1450000',
        currency_code: 'TZS',
      },
    });
    const ctx = makeCtx({ post });
    const res = await cooperativeDraftSettlementTool.handler(
      {
        cooperativePartyId: COOP,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        serviceChargeCollected: 1_000_000,
        sinkingFundCollected: 500_000,
        rentShareCollected: 250_000,
        operatingExpenses: 300_000,
      },
      ctx,
    );
    expect(res).toEqual({
      id: PERIOD,
      status: 'draft',
      netDistributable: '1450000',
      currencyCode: 'TZS',
    });
    expect(post).toHaveBeenCalledOnce();
    const [url, body] = post.mock.calls[0]!;
    expect(url).toBe('/cooperatives/settlement-periods');
    // provenance envelope injected by withChatProvenance
    expect((body as { provenance: { via: string } }).provenance.via).toBe(
      'chat',
    );
    expect((body as { currencyCode: string }).currencyCode).toBe('TZS');
  });

  it('honest-degrades the net math when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await cooperativeDraftSettlementTool.handler(
      {
        cooperativePartyId: COOP,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        currencyCode: 'KES',
        serviceChargeCollected: 800,
        sinkingFundCollected: 200,
        rentShareCollected: 0,
        operatingExpenses: 100,
      },
      ctx,
    );
    expect(res.id).toBe('');
    expect(res.status).toBe('draft');
    expect(res.netDistributable).toBe('900');
    expect(res.currencyCode).toBe('KES');
  });
});

describe('cooperativeMemberShareTool (READ)', () => {
  it('is LOW-stakes and read-only', () => {
    expect(cooperativeMemberShareTool.stakes).toBe('LOW');
    expect(cooperativeMemberShareTool.isWrite).toBe(false);
  });

  it('GETs the real members endpoint and maps snake_case rows', async () => {
    const get = vi.fn().mockResolvedValue({
      success: true,
      data: {
        periodId: PERIOD,
        status: 'distributed',
        currencyCode: 'TZS',
        netDistributable: '1000000',
        members: [
          {
            member_household_party_id: MEMBER,
            share_pct: '60.0000',
            amount: '600000.00',
            paid_at: '2026-02-01T00:00:00.000Z',
            payment_ref: 'COOP-abc-1',
          },
        ],
      },
    });
    const ctx = makeCtx({ get });
    const res = await cooperativeMemberShareTool.handler(
      { periodId: PERIOD },
      ctx,
    );
    expect(get).toHaveBeenCalledOnce();
    expect(get.mock.calls[0]![0]).toBe(
      `/cooperatives/settlement-periods/${PERIOD}/members`,
    );
    expect(res.status).toBe('distributed');
    expect(res.members).toHaveLength(1);
    expect(res.members[0]).toEqual({
      memberHouseholdPartyId: MEMBER,
      sharePct: '60.0000',
      amount: '600000.00',
      paidAt: '2026-02-01T00:00:00.000Z',
      paymentRef: 'COOP-abc-1',
    });
  });

  it('returns an empty member shape when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await cooperativeMemberShareTool.handler(
      { periodId: PERIOD },
      ctx,
    );
    expect(res.members).toEqual([]);
    expect(res.periodId).toBe(PERIOD);
  });
});

describe('cooperativeSettlementPeriodListTool (READ)', () => {
  it('is LOW-stakes and read-only', () => {
    expect(cooperativeSettlementPeriodListTool.stakes).toBe('LOW');
    expect(cooperativeSettlementPeriodListTool.isWrite).toBe(false);
  });

  it('GETs the list with status + cooperative filters in the query', async () => {
    const get = vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: PERIOD,
          cooperative_party_id: COOP,
          period_start: '2026-01-01',
          period_end: '2026-01-31',
          status: 'approved',
          currency_code: 'TZS',
          net_distributable: '1450000',
        },
      ],
    });
    const ctx = makeCtx({ get });
    const res = await cooperativeSettlementPeriodListTool.handler(
      { cooperativePartyId: COOP, status: 'approved', limit: 10 },
      ctx,
    );
    expect(res.periods).toHaveLength(1);
    expect(res.periods[0]?.cooperativePartyId).toBe(COOP);
    const [url, opts] = get.mock.calls[0]!;
    expect(url).toBe('/cooperatives/settlement-periods');
    const query = (opts as { query: Record<string, unknown> }).query;
    expect(query.status).toBe('approved');
    expect(query.cooperativePartyId).toBe(COOP);
    expect(query.limit).toBe(10);
  });

  it('omits absent filters from the query', async () => {
    const get = vi.fn().mockResolvedValue({ success: true, data: [] });
    const ctx = makeCtx({ get });
    await cooperativeSettlementPeriodListTool.handler({ limit: 20 }, ctx);
    const query = (get.mock.calls[0]![1] as { query: Record<string, unknown> })
      .query;
    expect(query).not.toHaveProperty('status');
    expect(query).not.toHaveProperty('cooperativePartyId');
    expect(query.limit).toBe(20);
  });

  it('returns empty periods when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await cooperativeSettlementPeriodListTool.handler(
      { limit: 20 },
      ctx,
    );
    expect(res.periods).toEqual([]);
  });
});
