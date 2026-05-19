import { describe, expect, it } from 'vitest';
import { createSalesChase } from '../verticals/bossnyumba-internal/sales-chase.js';
import type { OwnerAccount } from '../verticals/bossnyumba-internal/entities.js';
import { makeCtx } from './_helpers.js';

function owner(extra: Partial<OwnerAccount> = {}): OwnerAccount {
  return {
    id: 'own-1',
    tenantId: 'tenant-1',
    displayName: 'Habari Properties',
    seatCount: 4,
    arrUsdMinor: 12000_00,
    tenureMonths: 18,
    lastActiveAtMs: 1_700_000_000_000,
    ...extra,
  };
}

describe('sales.chase', () => {
  it('first touch fires rung 0 (product-tip email)', async () => {
    const sub = createSalesChase();
    const { ctx } = makeCtx({ mode: 'auto' });
    const r = await sub.chase.run({
      target: owner(),
      inputTenantId: 'tenant-1',
      history: [],
      ctx,
    });
    expect(r.output.rung).toBe(0);
    expect(r.output.channel).toBe('email');
    expect(r.output.draftHint).toContain('product tip');
  });

  it('escalates from email to walkthrough after cooldown', async () => {
    const sub = createSalesChase();
    const nowMs = 1_700_000_000_000;
    const past = nowMs - 80 * 60 * 60 * 1000;
    const { ctx } = makeCtx({ nowMs, mode: 'auto' });
    const r = await sub.chase.run({
      target: owner(),
      inputTenantId: 'tenant-1',
      history: [{ rungAtTouch: 0, channel: 'email', atMs: past, responded: false }],
      ctx,
    });
    expect(r.output.rung).toBe(1);
    expect(r.output.action).toBe('escalate-rung');
  });

  it('hands off to human at exec-escalation rung', async () => {
    const sub = createSalesChase();
    const nowMs = 1_700_000_000_000;
    const past = nowMs - 200 * 60 * 60 * 1000;
    const { ctx } = makeCtx({ nowMs });
    const r = await sub.chase.run({
      target: owner(),
      inputTenantId: 'tenant-1',
      history: [{ rungAtTouch: 3, channel: 'email', atMs: past, responded: false }],
      ctx,
    });
    expect(r.output.action).toBe('handoff-to-human');
  });

  it('terminates when owner recovers', async () => {
    const sub = createSalesChase({ isOwnerRecovered: (o) => o.seatCount > 100 });
    const { ctx } = makeCtx();
    const r = await sub.chase.run({
      target: owner({ seatCount: 200 }),
      inputTenantId: 'tenant-1',
      history: [],
      ctx,
    });
    expect(r.output.action).toBe('wait-in-cooldown');
  });
});
