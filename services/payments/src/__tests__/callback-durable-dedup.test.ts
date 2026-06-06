/**
 * M3 — MpesaCallbackHandler durable, non-destructive deduplication.
 *
 * The handler previously deduped with a process-local `Set` that
 * `cleanupProcessedCallbacks()` `.clear()`ed wholesale every 24h — a
 * double-credit window across restarts/replicas and even within a single
 * long-lived process. This pins the fixed contract:
 *
 *   - A durable store can be INJECTED so dedup survives restarts/replicas.
 *   - The injected store is consulted (and recorded only after the
 *     handler succeeds, M8).
 *   - The in-process default no longer wipes ALL state on cleanup.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  MpesaCallbackHandler,
  type StkCallbackBody,
} from '../mpesa/callback';

function successBody(checkoutId: string, receipt: string): StkCallbackBody {
  return {
    stkCallback: {
      MerchantRequestID: 'MR',
      CheckoutRequestID: checkoutId,
      ResultCode: 0,
      ResultDesc: 'ok',
      CallbackMetadata: {
        Item: [
          { Name: 'Amount', Value: 1000 },
          { Name: 'MpesaReceiptNumber', Value: receipt },
        ],
      },
    },
  };
}

describe('MpesaCallbackHandler durable dedup (M3)', () => {
  it('consults an injected durable store and dedups across handler instances', async () => {
    // Shared store simulating Redis/Postgres across two "replicas".
    const seen = new Set<string>();
    const store = {
      seenRecently: vi.fn(async (key: string) => {
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      }),
    };

    const onSuccess = vi.fn(async () => undefined);

    const replicaA = new MpesaCallbackHandler({ idempotencyStore: store });
    const replicaB = new MpesaCallbackHandler({ idempotencyStore: store });

    const r1 = await replicaA.handleStkCallback(successBody('CR1', 'RCPT1'), onSuccess);
    expect(r1.success).toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    // Same callback redelivered to a DIFFERENT replica → durable store
    // reports duplicate → handler must NOT reprocess.
    const r2 = await replicaB.handleStkCallback(successBody('CR1', 'RCPT1'), onSuccess);
    expect(r2.success).toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1); // not called again
    expect(store.seenRecently).toHaveBeenCalled();
  });

  it('releases the durable claim when the handler throws (M8 — reprocessable)', async () => {
    // A store exposing both claim-style seenRecently and release, so the
    // handler can undo the reservation on failure.
    const seen = new Set<string>();
    const store = {
      seenRecently: vi.fn(async (key: string) => {
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      }),
      release: vi.fn(async (key: string) => {
        seen.delete(key);
      }),
    };
    const handler = new MpesaCallbackHandler({ idempotencyStore: store });

    const failing = vi.fn(async () => {
      throw new Error('downstream failed');
    });
    await expect(
      handler.handleStkCallback(successBody('CR2', 'RCPT2'), failing),
    ).rejects.toThrow(/downstream failed/);
    expect(store.release).toHaveBeenCalled();

    // After the failure the key must be free again so a retry reprocesses.
    const ok = vi.fn(async () => undefined);
    const retry = await handler.handleStkCallback(successBody('CR2', 'RCPT2'), ok);
    expect(retry.success).toBe(true);
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('in-process default does not wipe all dedup state on cleanup', async () => {
    const handler = new MpesaCallbackHandler();
    const onSuccess = vi.fn(async () => undefined);

    await handler.handleStkCallback(successBody('CR3', 'RCPT3'), onSuccess);
    // Force the periodic cleanup; with the old `.clear()` this wiped
    // everything and the next identical callback double-processed.
    handler.runCleanupForTest();

    const again = await handler.handleStkCallback(successBody('CR3', 'RCPT3'), onSuccess);
    expect(again.success).toBe(true);
    // Still deduplicated — onSuccess fired only once.
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  // ── MUST-FIX 2 (HIGH): in-process release is COMPARE-AND-DELETE ──────
  // A late/transient failure of delivery #1 must not delete delivery #2's
  // claim after #1's claim TTL-expired and #2 re-won it. Otherwise a #3
  // delivery reprocesses → double SMS/events. We force this interleaving
  // with ttlMs:0 (so #1's claim is immediately expired and #2 can re-win
  // the same key with a NEW token) and a barrier that holds #1 mid-flight
  // until after #2 has re-claimed and #1 then fails (releasing its STALE
  // token). With the old unconditional delete, #1's release wiped #2's
  // live claim. With compare-and-delete, #2's claim survives.
  it("a stale failed delivery does not release a newer delivery's re-won claim", async () => {
    const handler = new MpesaCallbackHandler({ ttlMs: 0 });
    const body = successBody('CR_RACE', 'RCPT_RACE');
    const key = 'stk:RCPT_RACE'; // dedup key for a successful STK (receipt)

    // Barrier so #1 suspends inside its handler while #2 re-claims.
    let releaseBarrier!: () => void;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    const firstFailing = vi.fn(async () => {
      await barrier; // suspend mid-flight (claim #1 held, token1)
      throw new Error('first delivery downstream failed');
    });
    const p1 = handler.handleStkCallback(body, firstFailing).catch((e) => e as Error);

    // Let #1 enter its handler and suspend on the barrier.
    await Promise.resolve();
    await Promise.resolve();

    // #2 re-wins the (immediately-expired) key with a fresh token2.
    const secondOk = vi.fn(async () => undefined);
    const r2 = await handler.handleStkCallback(body, secondOk);
    expect(r2.success).toBe(true);
    expect(secondOk).toHaveBeenCalledTimes(1);

    // Capture #2's live token BEFORE #1 releases.
    const token2 = handler.peekClaimTokenForTest(key);
    expect(token2).toBeTruthy();

    // Now #1 fails → its catch releases with its STALE token1.
    releaseBarrier();
    expect(await p1).toBeInstanceOf(Error);

    // Compare-and-delete: #1's stale token1 != #2's token2, so #2's claim
    // row must be UNTOUCHED (old unconditional delete would have removed
    // it, dropping the key to undefined).
    expect(handler.peekClaimTokenForTest(key)).toBe(token2);
  });
});
