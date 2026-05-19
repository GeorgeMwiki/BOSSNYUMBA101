import { describe, expect, it } from 'vitest';
import {
  createChase,
  type ChaseHistoryEntry,
  type ChaseLadder,
} from '../primitives/chase.js';
import { makeCtx } from './_helpers.js';

const ladder: ChaseLadder = {
  rungs: [
    { index: 0, label: 'r0', channel: 'email', cooldownMs: 1000, draftHint: 'soft' },
    { index: 1, label: 'r1', channel: 'sms', cooldownMs: 2000 },
    { index: 2, label: 'r2', channel: 'voice', cooldownMs: 3000 },
    { index: 3, label: 'r3-handoff', channel: 'inbox', cooldownMs: 0 },
  ],
  handoffAtRung: 3,
};

interface Target {
  readonly id: string;
  readonly resolved?: boolean;
}

describe('createChase', () => {
  it('throws when ladder has no rungs', () => {
    expect(() =>
      createChase<Target>({
        name: 'c.empty',
        ladder: { rungs: [], handoffAtRung: 0 },
      }),
    ).toThrow();
  });

  it('first touch sends rung 0', async () => {
    const chase = createChase<Target>({ name: 'c.first', ladder });
    const { ctx } = makeCtx({ mode: 'auto' });
    const r = await chase.run({
      target: { id: 't1' },
      inputTenantId: 'tenant-1',
      history: [],
      ctx,
    });
    expect(r.output.action).toBe('send-this-rung');
    expect(r.output.rung).toBe(0);
    expect(r.output.draftHint).toBe('soft');
  });

  it('blocks in cooldown on current rung', async () => {
    const chase = createChase<Target>({ name: 'c.cd', ladder });
    const nowMs = 1_700_000_000_000;
    const history: ChaseHistoryEntry[] = [
      { rungAtTouch: 0, channel: 'email', atMs: nowMs - 500, responded: false },
    ];
    const { ctx } = makeCtx({ nowMs });
    const r = await chase.run({
      target: { id: 't1' },
      inputTenantId: 'tenant-1',
      history,
      ctx,
    });
    expect(r.output.action).toBe('wait-in-cooldown');
    expect(r.output.nextEligibleAtMs).toBeDefined();
  });

  it('escalates past cooldown', async () => {
    const chase = createChase<Target>({ name: 'c.esc', ladder });
    const nowMs = 1_700_000_000_000;
    const history: ChaseHistoryEntry[] = [
      { rungAtTouch: 0, channel: 'email', atMs: nowMs - 2000, responded: false },
    ];
    const { ctx } = makeCtx({ nowMs });
    const r = await chase.run({
      target: { id: 't1' },
      inputTenantId: 'tenant-1',
      history,
      ctx,
    });
    expect(r.output.action).toBe('escalate-rung');
    expect(r.output.rung).toBe(1);
  });

  it('hands off at top rung', async () => {
    const chase = createChase<Target>({ name: 'c.hand', ladder });
    const nowMs = 1_700_000_000_000;
    const history: ChaseHistoryEntry[] = [
      { rungAtTouch: 2, channel: 'voice', atMs: nowMs - 10000, responded: false },
    ];
    const { ctx, recorder } = makeCtx({ nowMs });
    const r = await chase.run({
      target: { id: 't1' },
      inputTenantId: 'tenant-1',
      history,
      ctx,
    });
    expect(r.output.action).toBe('handoff-to-human');
    expect(recorder.entries[0]!.status).toBe('awaiting-owner');
  });

  it('terminates when target resolved', async () => {
    const chase = createChase<Target>({
      name: 'c.done',
      ladder,
      isTargetResolved: (t) => t.resolved === true,
    });
    const { ctx, recorder } = makeCtx({ mode: 'auto' });
    const r = await chase.run({
      target: { id: 't', resolved: true },
      inputTenantId: 'tenant-1',
      history: [],
      ctx,
    });
    expect(r.output.action).toBe('wait-in-cooldown');
    expect(recorder.entries[0]!.summary).toMatch(/target resolved/);
  });

  it('rejects cross-tenant input', async () => {
    const chase = createChase<Target>({ name: 'c.scope', ladder });
    const { ctx, recorder } = makeCtx({ tenantId: 'tenant-1' });
    await chase.run({
      target: { id: 't' },
      inputTenantId: 'tenant-other',
      history: [],
      ctx,
    });
    expect(recorder.entries[0]!.status).toBe('rejected');
  });

  it('does NOT regress to a lower rung from history', async () => {
    const chase = createChase<Target>({ name: 'c.mono', ladder });
    const nowMs = 1_700_000_000_000;
    const history: ChaseHistoryEntry[] = [
      { rungAtTouch: 1, channel: 'sms', atMs: nowMs - 5000, responded: false },
    ];
    const { ctx } = makeCtx({ nowMs });
    const r = await chase.run({
      target: { id: 't1' },
      inputTenantId: 'tenant-1',
      history,
      ctx,
    });
    // r1 cooldown = 2000ms — past, so it must escalate to rung 2 (not 0).
    expect(r.output.rung).toBe(2);
  });
});
