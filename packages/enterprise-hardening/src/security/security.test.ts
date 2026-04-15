import { describe, it, expect } from 'vitest';
import {
  Bulkhead,
  BulkheadRejectedError,
  beginIdempotent,
  recordIdempotentResponse,
  InMemoryIdempotencyStore,
  signRequest,
  verifyRequest,
  InMemoryReplayStore,
  issueCsrfToken,
  verifyCsrfToken,
  buildSecurityHeaders,
  redact,
  redactString,
} from './index.js';

describe('Bulkhead', () => {
  it('executes below capacity', async () => {
    const b = new Bulkhead({ maxConcurrent: 2, maxQueueSize: 0 });
    const result = await b.execute(async () => 42);
    expect(result).toBe(42);
  });

  it('queues calls above capacity up to maxQueueSize', async () => {
    const b = new Bulkhead({ maxConcurrent: 1, maxQueueSize: 2 });
    let release!: () => void;
    const blocker = new Promise<void>((r) => (release = r));
    const running = b.execute(() => blocker.then(() => 'done'));
    const queued = b.execute(async () => 'queued');
    expect(b.stats().active).toBe(1);
    expect(b.stats().queued).toBe(1);
    release();
    await expect(running).resolves.toBe('done');
    await expect(queued).resolves.toBe('queued');
  });

  it('rejects when queue is full', async () => {
    const b = new Bulkhead({ maxConcurrent: 1, maxQueueSize: 0 });
    let release!: () => void;
    const blocker = new Promise<void>((r) => (release = r));
    const p = b.execute(() => blocker);
    await expect(b.execute(async () => 1)).rejects.toBeInstanceOf(
      BulkheadRejectedError
    );
    release();
    await p;
  });

  it('times out queued callers', async () => {
    const b = new Bulkhead({
      maxConcurrent: 1,
      maxQueueSize: 5,
      queueTimeoutMs: 20,
    });
    let release!: () => void;
    const blocker = new Promise<void>((r) => (release = r));
    const p = b.execute(() => blocker);
    const queued = b.execute(async () => 1);
    await expect(queued).rejects.toMatchObject({ code: 'QUEUE_TIMEOUT' });
    release();
    await p;
  });
});

describe('Idempotency', () => {
  const store = new InMemoryIdempotencyStore();
  const config = { store };

  it('returns fresh the first time, cached the second', async () => {
    const req = { key: 'abc', tenantId: 't1', fingerprint: 'f' };
    const first = await beginIdempotent(req, config);
    expect(first.kind).toBe('fresh');
    await recordIdempotentResponse(
      req,
      { status: 201, body: { ok: true } },
      config
    );
    const second = await beginIdempotent(req, config);
    expect(second.kind).toBe('cached');
    if (second.kind === 'cached') {
      expect(second.record.status).toBe(201);
      expect((second.record.body as { ok: boolean }).ok).toBe(true);
    }
  });

  it('detects fingerprint conflicts', async () => {
    const req1 = { key: 'k2', tenantId: 't1', fingerprint: 'A' };
    const req2 = { key: 'k2', tenantId: 't1', fingerprint: 'B' };
    await beginIdempotent(req1, config);
    await recordIdempotentResponse(req1, { status: 200, body: 1 }, config);
    const res = await beginIdempotent(req2, config);
    expect(res.kind).toBe('conflict');
  });

  it('isolates keys across tenants', async () => {
    const a = await beginIdempotent(
      { key: 'shared', tenantId: 'ta', fingerprint: 'f' },
      config
    );
    const b = await beginIdempotent(
      { key: 'shared', tenantId: 'tb', fingerprint: 'f' },
      config
    );
    expect(a.kind).toBe('fresh');
    expect(b.kind).toBe('fresh');
  });
});

describe('Request signing', () => {
  const secret = 'test-secret';
  const input = { method: 'POST', path: '/api/x', body: '{"a":1}' };

  it('round-trips a valid signature', async () => {
    const signed = signRequest(input, secret);
    const result = await verifyRequest(
      {
        method: input.method,
        path: input.path,
        body: input.body,
        signature: signed.signature,
        timestamp: signed.timestamp,
        nonce: signed.nonce,
      },
      { secret }
    );
    expect(result.valid).toBe(true);
  });

  it('rejects tampered bodies', async () => {
    const signed = signRequest(input, secret);
    const result = await verifyRequest(
      {
        method: input.method,
        path: input.path,
        body: '{"a":2}',
        signature: signed.signature,
        timestamp: signed.timestamp,
        nonce: signed.nonce,
      },
      { secret }
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('BAD_SIGNATURE');
  });

  it('rejects stale timestamps', async () => {
    const old = signRequest({ ...input, timestamp: Date.now() - 10 * 60_000 }, secret);
    const result = await verifyRequest(
      {
        method: input.method,
        path: input.path,
        body: input.body,
        signature: old.signature,
        timestamp: old.timestamp,
        nonce: old.nonce,
      },
      { secret, maxSkewMs: 60_000 }
    );
    expect(result.valid).toBe(false);
  });

  it('rejects replay via nonce store', async () => {
    const replay = new InMemoryReplayStore();
    const signed = signRequest(input, secret);
    const payload = {
      method: input.method,
      path: input.path,
      body: input.body,
      signature: signed.signature,
      timestamp: signed.timestamp,
      nonce: signed.nonce,
    };
    const first = await verifyRequest(payload, { secret, replayStore: replay });
    const second = await verifyRequest(payload, { secret, replayStore: replay });
    expect(first.valid).toBe(true);
    expect(second.valid).toBe(false);
    if (!second.valid) expect(second.reason).toBe('REPLAY');
  });
});

describe('CSRF', () => {
  const config = { secret: 's3cret' };

  it('verifies a freshly issued token', () => {
    const pair = issueCsrfToken('session-1', config);
    expect(
      verifyCsrfToken('POST', 'session-1', pair.cookieValue, pair.headerValue, config)
    ).toBe(true);
  });

  it('rejects mismatched cookie and header', () => {
    const a = issueCsrfToken('s', config);
    const b = issueCsrfToken('s', config);
    expect(
      verifyCsrfToken('POST', 's', a.cookieValue, b.headerValue, config)
    ).toBe(false);
  });

  it('skips verification for safe methods', () => {
    expect(verifyCsrfToken('GET', 's', undefined, undefined, config)).toBe(true);
  });

  it('rejects token forged for a different session', () => {
    const t = issueCsrfToken('session-A', config);
    expect(
      verifyCsrfToken('POST', 'session-B', t.cookieValue, t.headerValue, config)
    ).toBe(false);
  });
});

describe('Security headers', () => {
  it('emits HSTS and CSP by default', () => {
    const h = buildSecurityHeaders();
    expect(h['Strict-Transport-Security']).toContain('max-age=');
    expect(h['Content-Security-Policy']).toContain("default-src 'none'");
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('DENY');
  });

  it('respects disabled HSTS', () => {
    const h = buildSecurityHeaders({ hsts: false });
    expect(h['Strict-Transport-Security']).toBeUndefined();
  });
});

describe('Secret redaction', () => {
  it('redacts sensitive keys recursively', () => {
    const input = {
      user: 'alice',
      password: 'hunter2',
      nested: { token: 'abc', ok: true },
      list: [{ apiKey: 'x' }],
    };
    const out = redact(input) as Record<string, unknown>;
    expect(out.password).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).token).toBe('[REDACTED]');
    expect(((out.list as Array<Record<string, unknown>>)[0]).apiKey).toBe(
      '[REDACTED]'
    );
    expect(out.user).toBe('alice');
  });

  it('handles circular references', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const out = redact(obj) as Record<string, unknown>;
    expect(out.a).toBe(1);
    expect(out.self).toBe('[CIRCULAR]');
  });

  it('redacts JWT-like tokens from strings', () => {
    const s =
      'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const out = redactString(s);
    expect(out).not.toContain('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    expect(out).toContain('[REDACTED]');
  });
});
