/**
 * Live detector for the Jarvis message BFF proxy.
 *
 * The proxy must thread the operator's `extendedThinking` toggle and the
 * `slice` selector (jurisdiction / property-class / time-window) through
 * to the upstream gateway. The bug this guards against: the proxy used to
 * re-serialise only `{ threadId, message, presence? }`, silently dropping
 * both controls so the toggles never took effect.
 *
 * We mock `globalThis.fetch` to capture the upstream request body and
 * assert the threaded fields survive the proxy boundary.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '../message/route';

interface CapturedUpstream {
  url: string;
  body: Record<string, unknown>;
}

function makeRequest(payload: unknown): Request {
  return new Request('http://localhost/api/platform/intelligence/thread/t1/message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function makeContext(threadId: string) {
  return { params: Promise.resolve({ threadId }) };
}

describe('POST /intelligence/thread/:threadId/message — field threading', () => {
  let captured: CapturedUpstream | null;

  beforeEach(() => {
    captured = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        captured = {
          url,
          body: JSON.parse(String(init.body)) as Record<string, unknown>,
        };
        // Minimal SSE-ish upstream success.
        return new Response('data: ok\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('threads extendedThinking and slice through to the upstream body', async () => {
    const req = makeRequest({
      scope: 'platform',
      persona: 'industry-observer',
      message: 'collection trend for Class-B',
      extendedThinking: true,
      slice: { jurisdiction: 'KE-30', propertyClass: 'Class-B', timeWindow: '90d' },
    });

    const res = await POST(req as never, makeContext('t1') as never);
    expect(res.status).toBe(200);

    expect(captured).not.toBeNull();
    expect(captured?.body.threadId).toBe('t1');
    expect(captured?.body.message).toBe('collection trend for Class-B');
    // The toggle + slice must survive the proxy.
    expect(captured?.body.extendedThinking).toBe(true);
    expect(captured?.body.slice).toEqual({
      jurisdiction: 'KE-30',
      propertyClass: 'Class-B',
      timeWindow: '90d',
    });
    // Slice is also folded into the presence.extra bag the gateway
    // already consumes, so the audit trail records the population.
    expect((captured?.body.presence as Record<string, unknown>)?.extra).toEqual({
      slice: { jurisdiction: 'KE-30', propertyClass: 'Class-B', timeWindow: '90d' },
    });
  });

  it('omits extendedThinking and slice when the client sends neither', async () => {
    const req = makeRequest({ message: 'hello' });
    await POST(req as never, makeContext('t1') as never);

    expect(captured?.body).toHaveProperty('message', 'hello');
    expect(captured?.body).not.toHaveProperty('extendedThinking');
    expect(captured?.body).not.toHaveProperty('slice');
  });

  it('ignores a non-boolean extendedThinking and non-object slice', async () => {
    const req = makeRequest({
      message: 'hello',
      extendedThinking: 'yes',
      slice: 'KE-30',
    });
    await POST(req as never, makeContext('t1') as never);

    expect(captured?.body).not.toHaveProperty('extendedThinking');
    expect(captured?.body).not.toHaveProperty('slice');
  });

  it('drops non-string / over-long slice fields but keeps valid ones', async () => {
    const req = makeRequest({
      message: 'hello',
      slice: {
        jurisdiction: 'KE-30',
        propertyClass: 42,
        timeWindow: 'x'.repeat(500),
      },
    });
    await POST(req as never, makeContext('t1') as never);

    expect(captured?.body.slice).toEqual({ jurisdiction: 'KE-30' });
  });

  it('returns 400 when message is missing', async () => {
    const req = makeRequest({ extendedThinking: true });
    const res = await POST(req as never, makeContext('t1') as never);
    expect(res.status).toBe(400);
    expect(captured).toBeNull();
  });
});
