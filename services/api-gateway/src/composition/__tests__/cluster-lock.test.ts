/**
 * Tests for the cluster-wide advisory-lock single-flight helper.
 *
 * The helper mirrors wake-loop-cron's `pg_try_advisory_lock` dance and is
 * the multi-replica guard for every boot cron. We drive it against a fake
 * `execute()` that records the SQL it sees and returns scripted rows so we
 * can assert: acquire → run → unlock; not-acquired → skip (no unlock-of-a-
 * lock-we-don't-hold side effects beyond the standard release call); no-db
 * → no-op; release always fires even when fn throws.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  withClusterLock,
  makeClusterLockGate,
  CLUSTER_LOCK_IDS,
  type ClusterLockDeps,
} from '../cluster-lock';

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

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

/**
 * Fake db whose advisory-lock probe returns `acquired`. Records every SQL
 * statement so the test can assert the acquire + release pair.
 */
function makeDb(acquired: boolean) {
  const seen: string[] = [];
  const execute = vi.fn(async (q: unknown) => {
    const text = sqlText(q);
    seen.push(text);
    if (/pg_try_advisory_lock/.test(text)) {
      return { rows: [{ acquired }] };
    }
    return { rows: [] };
  });
  return { db: { execute }, execute, seen };
}

describe('withClusterLock', () => {
  it('acquires, runs fn, and releases when the lock is free', async () => {
    const { db, seen } = makeDb(true);
    const deps: ClusterLockDeps = { db, logger: silentLogger, name: 't' };
    const fn = vi.fn(async () => 'done');

    const result = await withClusterLock(123, fn, deps);

    expect(result).toEqual({ ran: true, value: 'done', skippedReason: null });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(seen.some((s) => /pg_try_advisory_lock/.test(s))).toBe(true);
    expect(seen.some((s) => /pg_advisory_unlock/.test(s))).toBe(true);
  });

  it('skips fn when another replica holds the lock', async () => {
    const { db, seen } = makeDb(false);
    const deps: ClusterLockDeps = { db, logger: silentLogger, name: 't' };
    const fn = vi.fn(async () => 'should-not-run');

    const result = await withClusterLock(123, fn, deps);

    expect(result).toEqual({ ran: false, value: null, skippedReason: 'lock-held' });
    expect(fn).not.toHaveBeenCalled();
    // We never unlock a lock we did not acquire.
    expect(seen.some((s) => /pg_advisory_unlock/.test(s))).toBe(false);
  });

  it('is a no-op when db is null (degraded mode)', async () => {
    const deps: ClusterLockDeps = { db: null, logger: silentLogger, name: 't' };
    const fn = vi.fn(async () => 'nope');

    const result = await withClusterLock(123, fn, deps);

    expect(result).toEqual({ ran: false, value: null, skippedReason: 'no-db' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('releases the lock even when fn throws', async () => {
    const { db, seen } = makeDb(true);
    const deps: ClusterLockDeps = { db, logger: silentLogger, name: 't' };
    const boom = new Error('boom');

    await expect(
      withClusterLock(123, async () => {
        throw boom;
      }, deps),
    ).rejects.toThrow('boom');

    expect(seen.some((s) => /pg_advisory_unlock/.test(s))).toBe(true);
  });

  it('treats a probe error as not-acquired (skips fn — safe default)', async () => {
    const execute = vi.fn(async () => {
      throw new Error('connection lost');
    });
    const deps: ClusterLockDeps = {
      db: { execute },
      logger: silentLogger,
      name: 't',
    };
    const fn = vi.fn(async () => 'nope');

    const result = await withClusterLock(123, fn, deps);

    expect(result.ran).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('makeClusterLockGate', () => {
  it('binds the lock id + deps and gates a void tick', async () => {
    const { db, seen } = makeDb(true);
    const deps: ClusterLockDeps = { db, logger: silentLogger, name: 't' };
    const gate = makeClusterLockGate(CLUSTER_LOCK_IDS.EXECUTIVE_BRIEF, deps);
    const tick = vi.fn(async () => {});

    await gate(tick);

    expect(tick).toHaveBeenCalledTimes(1);
    expect(seen.some((s) => /pg_try_advisory_lock/.test(s))).toBe(true);
  });

  it('skips the tick when the lock is held', async () => {
    const { db } = makeDb(false);
    const deps: ClusterLockDeps = { db, logger: silentLogger, name: 't' };
    const gate = makeClusterLockGate(CLUSTER_LOCK_IDS.CASES_SLA, deps);
    const tick = vi.fn(async () => {});

    await gate(tick);

    expect(tick).not.toHaveBeenCalled();
  });
});

describe('CLUSTER_LOCK_IDS', () => {
  it('every lock id is unique and inside the safe-integer range', () => {
    const ids = Object.values(CLUSTER_LOCK_IDS);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(Number.isSafeInteger(id)).toBe(true);
    }
  });

  it('mirrors wake-loop-cron WAKE_LOCK_ID without colliding other crons', () => {
    expect(CLUSTER_LOCK_IDS.WAKE_LOOP).toBe(7321946218472901);
    const others = Object.entries(CLUSTER_LOCK_IDS)
      .filter(([k]) => k !== 'WAKE_LOOP')
      .map(([, v]) => v);
    expect(others).not.toContain(CLUSTER_LOCK_IDS.WAKE_LOOP);
  });
});
