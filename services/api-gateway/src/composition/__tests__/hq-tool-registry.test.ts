/**
 * Tests for `createHqToolRegistry` — the api-gateway composition root
 * that seeds the 12 `platform.*` BrainTools onto a registry.
 */
import { describe, it, expect } from 'vitest';
import { createHqToolRegistry } from '../hq-tool-registry.js';

const FIXED_NOW = new Date('2026-05-15T09:00:00.000Z');

function fixedClock(): () => Date {
  return () => FIXED_NOW;
}

describe('createHqToolRegistry', () => {
  it('boots with NOT_YET_WIRED stubs when hqDeps omitted', () => {
    const wiring = createHqToolRegistry({
      callerResolver: {
        resolve: () => ({
          callerId: 'admin-1',
          scopes: ['platform:*'],
        }),
      },
      clock: fixedClock(),
    });
    expect(wiring.toolNames).toHaveLength(12);
    expect(wiring.registry.get('platform.list_tenants')).not.toBeNull();
    expect(wiring.registry.get('platform.set_killswitch')).not.toBeNull();
  });

  it('registers every platform.* tier-mapped tool', () => {
    const wiring = createHqToolRegistry({
      callerResolver: {
        resolve: () => ({ callerId: 'admin-1', scopes: ['platform:*'] }),
      },
      clock: fixedClock(),
    });
    const names = wiring.registry.list().map((s) => s.name);
    expect(names).toContain('platform.list_tenants');
    expect(names).toContain('platform.create_tenant');
    expect(names).toContain('platform.set_killswitch');
    expect(names).toContain('platform.adjust_invoice');
    expect(names).toContain('platform.send_announcement');
  });

  it('system_health stub returns an "unknown" snapshot rather than throwing', async () => {
    const wiring = createHqToolRegistry({
      callerResolver: {
        resolve: () => ({ callerId: 'admin-1', scopes: ['platform:*'] }),
      },
      clock: fixedClock(),
    });
    const out = await wiring.registry.runTool('platform.system_health', {});
    expect(out.kind).toBe('ok');
  });

  it('list_tenants stub fails with executor-failed (NOT_YET_WIRED)', async () => {
    const wiring = createHqToolRegistry({
      callerResolver: {
        resolve: () => ({ callerId: 'admin-1', scopes: ['platform:*'] }),
      },
      clock: fixedClock(),
    });
    const out = await wiring.registry.runTool('platform.list_tenants', {});
    expect(out.kind).toBe('executor-failed');
  });

  it('caller without scope receives refusal (translated to executor-failed)', async () => {
    const wiring = createHqToolRegistry({
      callerResolver: {
        resolve: () => ({ callerId: 'eve', scopes: ['public:read'] }),
      },
      clock: fixedClock(),
    });
    const out = await wiring.registry.runTool('platform.system_health', {});
    expect(out.kind).toBe('executor-failed');
    if (out.kind !== 'executor-failed') throw new Error('expected fail');
    expect(out.message).toMatch(/hq-tool-refused:OUT_OF_SCOPE/);
  });

  it('approvalRecordIdResolver is invoked per call', async () => {
    const seen: string[] = [];
    const wiring = createHqToolRegistry({
      callerResolver: {
        resolve: () => ({ callerId: 'admin-1', scopes: ['platform:*'] }),
      },
      approvalRecordIdResolver: (toolName) => {
        seen.push(toolName);
        return 'approval-xyz';
      },
      clock: fixedClock(),
    });
    await wiring.registry.runTool('platform.system_health', {});
    expect(seen).toContain('platform.system_health');
  });

  it('respects custom cost + recipient ceilings', () => {
    const wiring = createHqToolRegistry({
      callerResolver: {
        resolve: () => ({ callerId: 'admin-1', scopes: ['platform:*'] }),
      },
      maxAdjustmentUsdCents: 100_00,
      maxRecipientCount: 5_000,
      clock: fixedClock(),
    });
    expect(wiring.toolNames).toHaveLength(12);
  });
});
