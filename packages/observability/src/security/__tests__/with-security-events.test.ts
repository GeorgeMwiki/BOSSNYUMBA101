/**
 * Unit tests for the `withSecurityEvents` HOF and the Hono-style
 * `securityEventsMiddleware`. Verifies:
 *   - mutating verbs always emit
 *   - idempotent verbs (GET/HEAD/OPTIONS) skip
 *   - outcome derives from response status
 *   - audit emission failures are non-blocking
 *   - skip() opt-out is respected
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  withSecurityEvents,
  securityEventsMiddleware,
  recordSecurityEvent,
  type AuditableContext,
} from '../with-security-events.js';
import { initAuditLogger } from '../../audit-logger.js';
import { MemoryAuditStore } from '../../audit/memory-audit-store.js';
import type { IAuditStore } from '../../audit/audit-store.interface.js';

function makeCtx(opts: {
  method: string;
  path: string;
  status?: number;
  auth?: Record<string, unknown>;
}): AuditableContext {
  const store = new Map<string, unknown>();
  store.set('auth', opts.auth ?? { userId: 'u-1', roles: ['admin'] });
  return {
    req: {
      method: opts.method,
      path: opts.path,
      header: (n: string) =>
        n.toLowerCase() === 'user-agent' ? 'test-agent/1.0' : undefined,
    },
    res: { status: opts.status ?? 200 },
    get(key: string) {
      return store.get(key);
    },
  };
}

describe('withSecurityEvents', () => {
  let auditStore: IAuditStore;

  beforeEach(() => {
    auditStore = new MemoryAuditStore();
    initAuditLogger({ store: auditStore });
  });

  it('emits a SecurityEvent for POST', async () => {
    const handler = withSecurityEvents(async (c) => {
      (c.res as { status: number }).status = 201;
      return { ok: true };
    });
    await handler(makeCtx({ method: 'POST', path: '/api/v1/properties' }));
    const events = await auditStore.query({ limit: 10 });
    expect(events.events.length).toBe(1);
    expect(events.events[0].outcome).toBe('SUCCESS');
    expect(events.events[0].action).toBe('POST');
  });

  it('does NOT emit for GET (read-only)', async () => {
    const handler = withSecurityEvents(async () => ({ ok: true }));
    await handler(makeCtx({ method: 'GET', path: '/api/v1/properties' }));
    const events = await auditStore.query({ limit: 10 });
    expect(events.events.length).toBe(0);
  });

  it('classifies 403 as DENIED', async () => {
    const handler = withSecurityEvents(async (c) => {
      (c.res as { status: number }).status = 403;
      return { ok: false };
    });
    await handler(makeCtx({ method: 'DELETE', path: '/api/v1/users/u-9', status: 403 }));
    const events = await auditStore.query({ limit: 10 });
    expect(events.events[0].outcome).toBe('DENIED');
  });

  it('classifies 500 from thrown error as ERROR', async () => {
    const handler = withSecurityEvents(async () => {
      throw new Error('boom');
    });
    await expect(
      handler(makeCtx({ method: 'PATCH', path: '/api/v1/leases/abc' })),
    ).rejects.toThrow('boom');
    const events = await auditStore.query({ limit: 10 });
    expect(events.events.length).toBe(1);
    expect(events.events[0].outcome).toBe('ERROR');
  });

  it('respects skip()', async () => {
    const handler = withSecurityEvents(async () => ({ ok: true }), {
      skip: () => true,
    });
    await handler(makeCtx({ method: 'POST', path: '/api/v1/health' }));
    const events = await auditStore.query({ limit: 10 });
    expect(events.events.length).toBe(0);
  });

  it('does not block on audit emission failure', async () => {
    initAuditLogger({
      store: {
        async store() {
          throw new Error('sink down');
        },
        async storeBatch() {
          throw new Error('sink down');
        },
        async query() {
          return { events: [], total: 0, page: 1, limit: 10, hasMore: false };
        },
        async getById() {
          return null;
        },
      } as unknown as IAuditStore,
    });
    const onError = vi.fn();
    const handler = withSecurityEvents(async () => ({ ok: true }), { onError });
    const out = await handler(makeCtx({ method: 'POST', path: '/api/v1/x' }));
    expect(out).toEqual({ ok: true });
    await new Promise((r) => setTimeout(r, 5));
    expect(onError).toHaveBeenCalled();
  });
});

describe('securityEventsMiddleware', () => {
  beforeEach(() => {
    initAuditLogger({ store: new MemoryAuditStore() });
  });

  it('passes through GET without emit', async () => {
    let nextCalled = false;
    await securityEventsMiddleware(
      makeCtx({ method: 'GET', path: '/foo' }),
      async () => {
        nextCalled = true;
      },
    );
    expect(nextCalled).toBe(true);
  });

  it('emits on POST', async () => {
    const store = new MemoryAuditStore();
    initAuditLogger({ store });
    await securityEventsMiddleware(
      makeCtx({ method: 'POST', path: '/foo', status: 200 }),
      async () => {},
    );
    await new Promise((r) => setTimeout(r, 5));
    const events = await store.query({ limit: 10 });
    expect(events.events.length).toBe(1);
  });
});

describe('recordSecurityEvent', () => {
  it('emits a DENIED audit row with reason', async () => {
    const store = new MemoryAuditStore();
    initAuditLogger({ store });
    await recordSecurityEvent(
      makeCtx({ method: 'POST', path: '/api/v1/admin/x' }),
      'DENIED',
      'webhook signature mismatch',
    );
    const events = await store.query({ limit: 10 });
    expect(events.events[0].outcome).toBe('DENIED');
    expect(events.events[0].reason).toBe('webhook signature mismatch');
  });
});
