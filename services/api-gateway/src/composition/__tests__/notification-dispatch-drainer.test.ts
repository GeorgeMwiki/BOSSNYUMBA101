/**
 * Tests for the notification-dispatch drainer + stale-'sending' reaper.
 *
 * These cover the boot-wiring concerns the dispatcher-worker tests do not:
 *   - the reaper SQL resets only stale `sending` rows back to `pending`,
 *   - the drain loop is gated by the cluster lock (skips when held),
 *   - the reaper is gated by its own (distinct) lock,
 *   - null-db yields an inert handle.
 */

import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';

import {
  createNotificationDispatchDrainer,
  reapStaleSendingRows,
} from '../notification-dispatch-drainer';

const logger = pino({ level: 'silent' });

function sqlText(query: unknown): string {
  const q = query as { queryChunks?: ReadonlyArray<unknown> };
  if (Array.isArray(q.queryChunks)) {
    return q.queryChunks
      .map((c) => {
        if (typeof c === 'string') return c;
        const cc = c as { value?: unknown };
        return Array.isArray(cc.value) ? cc.value.join('') : '?';
      })
      .join('');
  }
  return String(query);
}

describe('reapStaleSendingRows', () => {
  it('issues an UPDATE that flips stale sending rows to pending and returns the count', async () => {
    let captured = '';
    const execute = vi.fn(async (q: unknown) => {
      const text = sqlText(q);
      // The reaper now binds service-role transactionally
      // (withWorkerServiceRoleContext): ignore the BEGIN / SET LOCAL /
      // COMMIT control statements so `captured` is the real UPDATE.
      if (/BEGIN|COMMIT|ROLLBACK|set_config/.test(text)) return { rows: [] };
      captured = text;
      return { rows: [{ id: 'r1' }, { id: 'r2' }] };
    });

    const reaped = await reapStaleSendingRows({ execute }, 10, new Date('2026-06-06T00:00:00Z'));

    expect(reaped).toBe(2);
    expect(captured).toMatch(/UPDATE notification_dispatch_log/);
    expect(captured).toMatch(/delivery_status = 'pending'/);
    expect(captured).toMatch(/delivery_status = 'sending'/);
    expect(captured).toMatch(/RETURNING id/);
  });

  it('returns 0 when nothing is stale', async () => {
    const execute = vi.fn(async () => ({ rows: [] }));
    const reaped = await reapStaleSendingRows({ execute }, 10);
    expect(reaped).toBe(0);
  });
});

/**
 * Fake db whose advisory-lock probe is acquirable/blocked per-test and
 * which answers the drainer's claim query with an empty batch (so the
 * drain loop exits after one pass).
 */
function makeDb(acquired: boolean) {
  const seen: string[] = [];
  const execute = vi.fn(async (q: unknown) => {
    const text = sqlText(q);
    seen.push(text);
    if (/pg_try_advisory_lock/.test(text)) return { rows: [{ acquired }] };
    if (/UPDATE notification_dispatch_log/.test(text)) {
      // Both the claim batch and the reaper are UPDATEs returning rows;
      // return empty so the drain loop terminates and reaper reaps 0.
      return { rows: [] };
    }
    return { rows: [] };
  });
  return { db: { execute }, execute, seen };
}

describe('createNotificationDispatchDrainer', () => {
  it('returns an inert handle when db is null', async () => {
    const handle = createNotificationDispatchDrainer({ db: null, logger });
    expect(() => handle.start()).not.toThrow();
    expect(() => handle.stop()).not.toThrow();
    await expect(handle.drainOnce()).resolves.toBeUndefined();
    await expect(handle.reapOnce()).resolves.toBe(0);
  });

  it('drainOnce acquires the dispatch lock and drains the (empty) backlog', async () => {
    const { db, seen } = makeDb(true);
    const handle = createNotificationDispatchDrainer({
      db,
      logger,
      enabled: true,
    });
    await handle.drainOnce();
    // Probed the advisory lock and released it.
    expect(seen.some((s) => /pg_try_advisory_lock/.test(s))).toBe(true);
    expect(seen.some((s) => /pg_advisory_unlock/.test(s))).toBe(true);
  });

  it('drainOnce skips the claim work when the lock is held by another replica', async () => {
    const { db, seen } = makeDb(false);
    const handle = createNotificationDispatchDrainer({
      db,
      logger,
      enabled: true,
    });
    await handle.drainOnce();
    // Lock held → no claim UPDATE should have fired.
    expect(seen.some((s) => /pg_try_advisory_lock/.test(s))).toBe(true);
    expect(
      seen.some((s) => /UPDATE notification_dispatch_log[\s\S]*SET delivery_status = 'sending'/.test(s)),
    ).toBe(false);
  });

  it('reapOnce returns 0 when no rows are stale (gated, empty result)', async () => {
    const { db } = makeDb(true);
    const handle = createNotificationDispatchDrainer({
      db,
      logger,
      enabled: true,
      staleMinutes: 5,
    });
    await expect(handle.reapOnce()).resolves.toBe(0);
  });

  it('start/stop is idempotent', () => {
    const { db } = makeDb(true);
    const handle = createNotificationDispatchDrainer({
      db,
      logger,
      enabled: true,
      drainIntervalMs: 60_000,
      reapIntervalMs: 60_000,
    });
    expect(() => {
      handle.start();
      handle.start();
      handle.stop();
      handle.stop();
    }).not.toThrow();
  });
});
