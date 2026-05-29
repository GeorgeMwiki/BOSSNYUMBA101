/**
 * SSE client-ack helper tests — R10.
 *
 * Covers:
 *  - debounces multiple acks into a single POST
 *  - sends the highest chunkNo received during the debounce window
 *  - flush() emits an immediate POST
 *  - rejected POST is swallowed (no throw)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { createSseAck } from '../sse-ack';

describe('createSseAck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces multiple ack calls into one POST', async () => {
    const fetcher = vi.fn(async () =>
      new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;
    const handle = createSseAck({
      ackUrl: '/api/v1/brain/sse/ack',
      fetcher,
      minIntervalMs: 200,
    });

    handle.ack(1);
    handle.ack(2);
    handle.ack(3);
    expect(fetcher).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(250);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const args = (fetcher as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]!;
    const body = JSON.parse(String((args[1] as RequestInit).body));
    expect(body.lastChunk).toBe(3);
  });

  it('flush() POSTs immediately', async () => {
    const fetcher = vi.fn(async () =>
      new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;
    const handle = createSseAck({
      ackUrl: '/ack',
      fetcher,
      minIntervalMs: 5000,
    });
    handle.ack(7);
    await handle.flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('swallows a fetch error without throwing', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    const handle = createSseAck({
      ackUrl: '/ack',
      fetcher,
      minIntervalMs: 50,
    });
    handle.ack(1);
    await vi.advanceTimersByTimeAsync(100);
    // No throw is the assertion.
    expect(fetcher).toHaveBeenCalled();
  });

  it('does not re-POST an already-acked chunk', async () => {
    const fetcher = vi.fn(async () =>
      new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;
    const handle = createSseAck({
      ackUrl: '/ack',
      fetcher,
      minIntervalMs: 50,
    });
    handle.ack(5);
    await vi.advanceTimersByTimeAsync(100);
    expect(fetcher).toHaveBeenCalledTimes(1);
    // Acking a smaller chunkNo is a no-op.
    handle.ack(3);
    await vi.advanceTimersByTimeAsync(100);
    // Was scheduled but resolved without POST because chunk <= acked.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
