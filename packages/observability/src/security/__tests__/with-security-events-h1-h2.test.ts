/**
 * Round-3 H1/H2 regression tests for `with-security-events`.
 *
 * H1: emitted audit rows MUST carry the tenant block when the auth
 *     context surfaces one. Previously every row was tenant-less.
 * H2: the middleware must record statusCode=500 when `next()` throws.
 *     Previously the middleware recorded `getStatus(ctx) ?? 200` —
 *     SUCCESS for a 5xx response.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  withSecurityEvents,
  securityEventsMiddleware,
  recordSecurityEvent,
  type AuditableContext,
} from '../with-security-events.js';
import { initAuditLogger } from '../../audit-logger.js';
import { MemoryAuditStore } from '../../audit/memory-audit-store.js';

function makeCtx(opts: {
  method: string;
  path: string;
  status?: number;
  auth?: Record<string, unknown>;
}): AuditableContext {
  const store = new Map<string, unknown>();
  store.set('auth', opts.auth ?? { userId: 'u-1', tenantId: 'tenant-a' });
  return {
    req: {
      method: opts.method,
      path: opts.path,
      header: () => undefined,
    },
    res: { status: opts.status ?? 200 },
    get(key: string) {
      return store.get(key);
    },
  };
}

describe('with-security-events — H1 tenant context binding', () => {
  let auditStore: MemoryAuditStore;
  beforeEach(() => {
    auditStore = new MemoryAuditStore();
    initAuditLogger({ store: auditStore });
  });

  it('attaches tenantId from auth.tenantId to the emitted row', async () => {
    const handler = withSecurityEvents(async (c) => {
      (c.res as { status: number }).status = 201;
      return { ok: true };
    });
    await handler(
      makeCtx({
        method: 'POST',
        path: '/api/v1/properties',
        auth: { userId: 'u-9', tenantId: 'tenant-xyz' },
      }),
    );
    await new Promise((r) => setTimeout(r, 5));
    const events = await auditStore.query({ limit: 10 });
    expect(events.events.length).toBe(1);
    const row = events.events[0]!;
    // The audit event's tenant context should carry our tenantId.
    expect(row.tenant?.tenantId).toBe('tenant-xyz');
  });

  it('accepts orgId / organizationId as tenant aliases', async () => {
    const handler = withSecurityEvents(async () => ({ ok: true }));
    await handler(
      makeCtx({
        method: 'POST',
        path: '/api/v1/x',
        auth: { userId: 'u-9', orgId: 'org-abc' },
      }),
    );
    await new Promise((r) => setTimeout(r, 5));
    const events = await auditStore.query({ limit: 10 });
    expect(events.events[0]!.tenant?.tenantId).toBe('org-abc');
  });

  it('omits tenant block when auth has none (graceful)', async () => {
    const handler = withSecurityEvents(async () => ({ ok: true }));
    await handler(
      makeCtx({
        method: 'POST',
        path: '/api/v1/anon',
        auth: { userId: 'u-anon' },
      }),
    );
    await new Promise((r) => setTimeout(r, 5));
    const events = await auditStore.query({ limit: 10 });
    expect(events.events[0]!.tenant).toBeUndefined();
  });
});

describe('with-security-events — H2 middleware thrown-handler status normalisation', () => {
  let auditStore: MemoryAuditStore;
  beforeEach(() => {
    auditStore = new MemoryAuditStore();
    initAuditLogger({ store: auditStore });
  });

  it('records statusCode=500 ERROR when next() throws (not 200 SUCCESS)', async () => {
    const ctx = makeCtx({ method: 'POST', path: '/api/v1/x' });
    // Reset status so we can verify the middleware doesn't default to 200.
    delete (ctx as { res?: unknown }).res;
    await expect(
      securityEventsMiddleware(ctx, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await new Promise((r) => setTimeout(r, 5));
    const events = await auditStore.query({ limit: 10 });
    expect(events.events.length).toBe(1);
    const row = events.events[0]!;
    expect(row.outcome).toBe('ERROR');
  });

  it('records SUCCESS when next() resolves cleanly with a 2xx status', async () => {
    const ctx = makeCtx({ method: 'POST', path: '/api/v1/x', status: 200 });
    await securityEventsMiddleware(ctx, async () => {
      /* clean exit */
    });
    await new Promise((r) => setTimeout(r, 5));
    const events = await auditStore.query({ limit: 10 });
    expect(events.events[0]!.outcome).toBe('SUCCESS');
  });
});

describe('with-security-events — recordSecurityEvent tenant binding', () => {
  it('attaches tenant block to a manually emitted DENIED row', async () => {
    const store = new MemoryAuditStore();
    initAuditLogger({ store });
    await recordSecurityEvent(
      makeCtx({
        method: 'POST',
        path: '/api/v1/admin/x',
        auth: { userId: 'u-9', tenantId: 'tenant-xyz' },
      }),
      'DENIED',
      'webhook signature mismatch',
    );
    const events = await store.query({ limit: 10 });
    expect(events.events[0]!.outcome).toBe('DENIED');
    expect(events.events[0]!.tenant?.tenantId).toBe('tenant-xyz');
  });
});
