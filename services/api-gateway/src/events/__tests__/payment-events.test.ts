/**
 * Unit tests for publishPaymentEvent — the fire-and-forget fan-out used by
 * POST /payments and POST /payments/:id/confirm handlers.
 *
 * Guarantees we lock in:
 *   1. publishPaymentEvent never throws into the caller, even when every
 *      downstream rejects.
 *   2. Each event gets a freshly generated UUID eventId on every call.
 *   3. When INTERNAL_API_KEY is set, the ledger request carries
 *      `X-Internal-Key`.
 *   4. The ledger call is bounded by a timeout when fetch never resolves.
 *   5. When PAYMENTS_LEDGER_URL is unset, no ledger HTTP call happens.
 *
 * Mocks:
 *   - global.fetch: vi.fn(), per-test behaviour.
 *   - '../../../webhooks/src/webhook-service': `trigger` becomes a vi.fn().
 *   - '../utils/logger': silenced to keep output clean.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const triggerMock = vi.fn();

vi.mock('../../../../../webhooks/src/webhook-service', () => ({
  trigger: triggerMock,
}));
// The real relative path from this test file to webhook-service.
vi.mock('../../../../webhooks/src/webhook-service', () => ({
  trigger: triggerMock,
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { publishPaymentEvent } from '../payment-events';

const ORIGINAL_ENV = { ...process.env };

const baseEvent = {
  type: 'payment.created' as const,
  tenantId: 'tenant-1',
  payload: { amount: 100 },
};

// Wait one microtask turn + a macrotask so the internal Promise.allSettled
// has room to run without blocking the caller in the real code.
async function drainMicrotasks(): Promise<void> {
  await Promise.resolve();
  await new Promise((r) => setImmediate(r));
}

beforeEach(() => {
  triggerMock.mockReset();
  triggerMock.mockResolvedValue({ delivered: 0, failed: 0 });
  process.env = { ...ORIGINAL_ENV };
  process.env.PAYMENTS_LEDGER_URL = 'http://ledger.test';
  delete process.env.INTERNAL_API_KEY;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

describe('publishPaymentEvent', () => {
  it('does not throw even when ledger rejects and webhooks reject', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ledger down')));
    triggerMock.mockRejectedValue(new Error('webhooks exploded'));

    expect(() => publishPaymentEvent(baseEvent)).not.toThrow();
    await drainMicrotasks();
  });

  it('returns undefined synchronously (fire-and-forget)', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));
    const out = publishPaymentEvent(baseEvent);
    expect(out).toBeUndefined();
  });

  it('generates a fresh UUID eventId for each call and forwards it to ledger + webhooks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    publishPaymentEvent(baseEvent);
    publishPaymentEvent(baseEvent);
    await drainMicrotasks();

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Two webhook triggers, each with a UUID id, and the two ids must differ.
    expect(triggerMock).toHaveBeenCalledTimes(2);
    const [call1] = triggerMock.mock.calls[0]!;
    const [call2] = triggerMock.mock.calls[1]!;
    expect(call1.id).toMatch(uuidRe);
    expect(call2.id).toMatch(uuidRe);
    expect(call1.id).not.toBe(call2.id);

    // Ledger bodies also carry the matching eventIds.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
    expect(bodies[0].eventId).toBe(call1.id);
    expect(bodies[1].eventId).toBe(call2.id);
  });

  it('sends X-Internal-Key when INTERNAL_API_KEY is set', async () => {
    process.env.INTERNAL_API_KEY = 'super-secret';
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    publishPaymentEvent(baseEvent);
    await drainMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://ledger.test/internal/ledger');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Internal-Key']).toBe('super-secret');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('skips ledger HTTP when PAYMENTS_LEDGER_URL is unset', async () => {
    delete process.env.PAYMENTS_LEDGER_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    publishPaymentEvent(baseEvent);
    await drainMicrotasks();

    expect(fetchMock).not.toHaveBeenCalled();
    // Webhooks still trigger.
    expect(triggerMock).toHaveBeenCalledTimes(1);
  });

  it('aborts the ledger fetch when it never resolves (timeout path)', async () => {
    // Capture the AbortSignal passed to fetch so we can observe the timeout.
    let observedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      observedSignal = init.signal as AbortSignal;
      return new Promise(() => {
        /* intentionally never resolves */
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    publishPaymentEvent(baseEvent);
    // Let the code register its setTimeout and issue fetch.
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(observedSignal).toBeDefined();
    expect(observedSignal!.aborted).toBe(false);

    // LEDGER_TIMEOUT_MS is 5_000 in payment-events.ts.
    vi.advanceTimersByTime(5_001);
    expect(observedSignal!.aborted).toBe(true);
  });
});
