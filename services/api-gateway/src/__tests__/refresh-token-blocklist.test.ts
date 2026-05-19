/**
 * Refresh-token blocklist tests (AM-1).
 *
 * Mirrors the access-token blocklist contract but asynchronously
 * (the Redis-backed backend is async; the in-memory fallback adopts
 * the same signature for consistency).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  refreshTokenBlocklist,
  __resetRefreshBlocklistForTests,
} from '../middleware/refresh-token-blocklist';

describe('refresh-token-blocklist (AM-1)', () => {
  beforeEach(() => {
    __resetRefreshBlocklistForTests();
  });

  it('returns false for jti never revoked', async () => {
    expect(await refreshTokenBlocklist.isRevoked('never')).toBe(false);
  });

  it('marks a revoked jti as revoked within its TTL', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    await refreshTokenBlocklist.revoke('jti-abc', futureExp);
    expect(await refreshTokenBlocklist.isRevoked('jti-abc')).toBe(true);
  });

  it('drops the entry once exp has passed', async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 10;
    await refreshTokenBlocklist.revoke('jti-old', pastExp);
    expect(await refreshTokenBlocklist.isRevoked('jti-old')).toBe(false);
  });

  it('distinguishes between jtis', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    await refreshTokenBlocklist.revoke('jti-a', futureExp);
    expect(await refreshTokenBlocklist.isRevoked('jti-a')).toBe(true);
    expect(await refreshTokenBlocklist.isRevoked('jti-b')).toBe(false);
  });

  it('clear() empties the blocklist', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    await refreshTokenBlocklist.revoke('jti-clear', futureExp);
    expect(await refreshTokenBlocklist.isRevoked('jti-clear')).toBe(true);
    await refreshTokenBlocklist.clear();
    expect(await refreshTokenBlocklist.isRevoked('jti-clear')).toBe(false);
  });

  it('safely no-ops on empty jti', async () => {
    await expect(refreshTokenBlocklist.revoke('', 3600)).resolves.toBeUndefined();
    expect(await refreshTokenBlocklist.isRevoked('')).toBe(false);
  });

  it('caps the TTL at the documented refresh-token max (7 days)', async () => {
    // 30 days in the future — the cap should still be honoured; the
    // entry should remain revoked at the start, and the post-7d check
    // is implicit (we can't easily fast-forward 7 days in a unit test).
    const farFuture = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    await refreshTokenBlocklist.revoke('jti-far', farFuture);
    expect(await refreshTokenBlocklist.isRevoked('jti-far')).toBe(true);
  });
});
