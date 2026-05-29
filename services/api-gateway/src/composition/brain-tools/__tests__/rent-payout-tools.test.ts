/**
 * rent-payout-tools — descriptor metadata + http-client wiring tests.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  RENT_PAYOUT_TOOLS,
  ownerRentPayoutListMineTool,
} from '../rent-payout-tools.js';
import type { PersonaToolHandlerContext } from '../types.js';

function makeCtx(get: ReturnType<typeof vi.fn>): PersonaToolHandlerContext {
  return {
    tenantId: '00000000-0000-0000-0000-000000000000',
    actorId: 'actor-owner',
    personaSlug: 'T1_owner_strategist',
    httpClient: { get, post: vi.fn() } as unknown as PersonaToolHandlerContext['httpClient'],
  };
}

describe('RENT_PAYOUT_TOOLS catalog', () => {
  it('exports exactly 1 descriptor (owner.rent_payout.list_mine)', () => {
    expect(RENT_PAYOUT_TOOLS).toHaveLength(1);
    expect(RENT_PAYOUT_TOOLS[0]?.id).toBe('owner.rent_payout.list_mine');
  });
});

describe('ownerRentPayoutListMineTool', () => {
  it('is LOW-stakes, read-only, owner-only', () => {
    expect(ownerRentPayoutListMineTool.stakes).toBe('LOW');
    expect(ownerRentPayoutListMineTool.isWrite).toBe(false);
    expect(ownerRentPayoutListMineTool.personaSlugs).toEqual([
      'T1_owner_strategist',
    ]);
  });
  it('GETs /owner/rent-payouts/mine with limit string', async () => {
    const get = vi.fn().mockResolvedValue({ payouts: [] });
    const ctx = makeCtx(get);
    const res = await ownerRentPayoutListMineTool.handler(
      { limit: 25 },
      ctx,
    );
    expect(res.payouts).toEqual([]);
    expect(get).toHaveBeenCalledOnce();
    const [url, opts] = get.mock.calls[0]!;
    expect(url).toBe('/owner/rent-payouts/mine');
    expect((opts as { query: { limit: string } }).query.limit).toBe('25');
  });

  it('returns empty payouts when http client is absent', async () => {
    const ctx: PersonaToolHandlerContext = {
      tenantId: '0',
      actorId: 'a',
      personaSlug: 'T1_owner_strategist',
    };
    const res = await ownerRentPayoutListMineTool.handler(
      { limit: 50 },
      ctx,
    );
    expect(res.payouts).toEqual([]);
  });
});
