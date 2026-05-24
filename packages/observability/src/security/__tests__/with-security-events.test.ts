import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  withSecurityEvents,
  withSecurityEventsNextRoute,
  setSecurityEventSink,
  resetSecurityEventSink,
  recordSecurityEvent,
  type SecurityEvent,
} from '../with-security-events.js';

function captureSink() {
  const events: SecurityEvent[] = [];
  return { events, sink: (e: SecurityEvent) => { events.push(e); } };
}

describe('withSecurityEvents (Hono)', () => {
  let captured: ReturnType<typeof captureSink>;

  beforeEach(() => {
    captured = captureSink();
    setSecurityEventSink(captured.sink);
  });
  afterEach(() => {
    resetSecurityEventSink();
  });

  function makeCtx(over: Partial<{ tenantId: string; actorId: string }> = {}) {
    return {
      req: {
        method: 'POST',
        path: '/leases',
        routePath: '/leases',
        header: (name: string) => {
          if (name === 'x-correlation-id') return 'cid-123';
          if (name === 'x-forwarded-for') return '203.0.113.5';
          return null;
        },
      },
      res: { status: 201 },
      get(key: string) {
        if (key === 'tenantId') return over.tenantId ?? null;
        if (key === 'actorId') return over.actorId ?? null;
        return null;
      },
    };
  }

  it('emits one event after a successful handler', async () => {
    const handler = vi.fn(async () => ({ leaseId: 'L-1' }));
    const wrapped = withSecurityEvents(
      { action: 'lease.create', resource: 'lease', severity: 'info' },
      handler,
    );
    const result = await wrapped(makeCtx({ tenantId: 't-1', actorId: 'u-1' }));
    expect(handler).toHaveBeenCalledOnce();
    expect(result).toEqual({ leaseId: 'L-1' });
    expect(captured.events).toHaveLength(1);
    const e = captured.events[0]!;
    expect(e.action).toBe('lease.create');
    expect(e.resource).toBe('lease');
    expect(e.method).toBe('POST');
    expect(e.tenantId).toBe('t-1');
    expect(e.actorId).toBe('u-1');
    expect(e.responseStatus).toBe(201);
    expect(e.errored).toBe(false);
    expect(e.correlationId).toBe('cid-123');
    expect(e.clientIp).toBe('203.0.113.5');
  });

  it('emits an errored event when the handler throws', async () => {
    const wrapped = withSecurityEvents(
      { action: 'lease.create', resource: 'lease' },
      async () => {
        throw new Error('boom');
      },
    );
    await expect(wrapped(makeCtx())).rejects.toThrow('boom');
    expect(captured.events).toHaveLength(1);
    const e = captured.events[0]!;
    expect(e.errored).toBe(true);
    expect(e.responseStatus).toBe(500);
    expect((e.detail as Record<string, unknown>).errorMessage).toBe('boom');
  });

  it('runs extractDetail and merges the result into detail', async () => {
    const wrapped = withSecurityEvents(
      {
        action: 'payment.create',
        resource: 'payment',
        extractDetail: () => ({ amount: 1500, currency: 'TZS' }),
      },
      async () => ({ paymentId: 'P-1' }),
    );
    await wrapped(makeCtx());
    expect((captured.events[0]!.detail as Record<string, unknown>).amount).toBe(1500);
  });

  it('never lets a sink failure propagate', async () => {
    setSecurityEventSink(() => {
      throw new Error('sink down');
    });
    const wrapped = withSecurityEvents(
      { action: 'x', resource: 'y' },
      async () => 'ok',
    );
    await expect(wrapped(makeCtx())).resolves.toBe('ok');
  });

  it('defaults severity to info when omitted', async () => {
    const wrapped = withSecurityEvents(
      { action: 'a', resource: 'r' },
      async () => 'ok',
    );
    await wrapped(makeCtx());
    expect(captured.events[0]!.severity).toBe('info');
  });
});

describe('withSecurityEventsNextRoute (Next.js)', () => {
  let captured: ReturnType<typeof captureSink>;
  beforeEach(() => {
    captured = captureSink();
    setSecurityEventSink(captured.sink);
  });
  afterEach(() => {
    resetSecurityEventSink();
  });

  it('emits the route path + status from a Response', async () => {
    const wrapped = withSecurityEventsNextRoute(
      { action: 'lease.create', resource: 'lease' },
      async () => new Response('ok', { status: 201 }),
    );
    const req = new Request('https://x.test/api/leases', {
      method: 'POST',
      headers: { 'x-tenant-id': 't-7' },
    });
    const res = await wrapped(req);
    expect(res.status).toBe(201);
    expect(captured.events).toHaveLength(1);
    expect(captured.events[0]!.route).toBe('/api/leases');
    expect(captured.events[0]!.tenantId).toBe('t-7');
    expect(captured.events[0]!.responseStatus).toBe(201);
  });

  it('records errored=true when the handler throws', async () => {
    const wrapped = withSecurityEventsNextRoute(
      { action: 'lease.create', resource: 'lease' },
      async () => {
        throw new Error('nope');
      },
    );
    const req = new Request('https://x.test/api/leases', { method: 'POST' });
    await expect(wrapped(req)).rejects.toThrow('nope');
    expect(captured.events[0]!.errored).toBe(true);
    expect(captured.events[0]!.responseStatus).toBe(500);
  });
});

describe('recordSecurityEvent (cron/queue direct emit)', () => {
  let captured: ReturnType<typeof captureSink>;
  beforeEach(() => {
    captured = captureSink();
    setSecurityEventSink(captured.sink);
  });
  afterEach(() => {
    resetSecurityEventSink();
  });

  it('emits an internal event with method=INTERNAL by default', async () => {
    await recordSecurityEvent({
      action: 'cron.eviction-cure-check',
      resource: 'eviction',
      tenantId: 't-9',
      detail: { caseId: 'EV-1' },
    });
    expect(captured.events[0]!.method).toBe('INTERNAL');
    expect(captured.events[0]!.tenantId).toBe('t-9');
    expect((captured.events[0]!.detail as Record<string, unknown>).caseId).toBe('EV-1');
  });
});
