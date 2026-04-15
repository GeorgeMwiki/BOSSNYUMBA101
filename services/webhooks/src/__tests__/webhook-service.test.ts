/**
 * Unit tests for the webhook-service public API.
 *
 * Mocks:
 *   - ./delivery.js — `deliver` is replaced with a vi.fn so no HTTP happens.
 *   - @bossnyumba/authz-policy — `rbacEngine.checkPermission` is replaced so we
 *     can assert the allow/deny branch in subscribeWithAuthz.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User as AuthzUser } from '@bossnyumba/authz-policy';

const deliverMock = vi.fn();
const checkPermissionMock = vi.fn();

vi.mock('../delivery.js', () => ({
  deliver: deliverMock,
}));

vi.mock('@bossnyumba/authz-policy', () => ({
  rbacEngine: { checkPermission: checkPermissionMock },
}));

// Import after mocks so the module picks them up.
import {
  subscribe,
  subscribeWithAuthz,
  getSubscriptions,
  unsubscribe,
  trigger,
} from '../webhook-service.js';

const adminUser: AuthzUser = {
  id: 'u1',
  roles: ['super-admin'],
  tenantId: 't1',
};

beforeEach(() => {
  deliverMock.mockReset();
  checkPermissionMock.mockReset();
});

describe('subscribe + getSubscriptions', () => {
  it('subscribe persists and getSubscriptions retrieves by tenantId', async () => {
    const s = await subscribe('https://hook.example/a', ['payment.created'], 'tenant-x');
    const list = await getSubscriptions('tenant-x');
    expect(list.some((x) => x.id === s.id)).toBe(true);
    await unsubscribe(s.id);
  });
});

describe('subscribeWithAuthz', () => {
  it('allows when rbacEngine says allowed', async () => {
    checkPermissionMock.mockReturnValue({ allowed: true });
    const sub = await subscribeWithAuthz(
      adminUser,
      'https://hook.example/allowed',
      ['payment.created'],
      'tenant-allow'
    );
    expect(sub.tenantId).toBe('tenant-allow');
    expect(checkPermissionMock).toHaveBeenCalledWith(
      adminUser,
      'create',
      'webhook',
      { tenantId: 'tenant-allow' }
    );
    await unsubscribe(sub.id);
  });

  it('denies when rbacEngine says denied', async () => {
    checkPermissionMock.mockReturnValue({ allowed: false, reason: 'nope' });
    await expect(
      subscribeWithAuthz(adminUser, 'https://hook.example/denied', ['payment.created'], 'tenant-deny')
    ).rejects.toThrow('nope');
  });
});

describe('trigger', () => {
  it('fans out only to subscriptions matching tenantId AND event.type', async () => {
    const s1 = await subscribe('https://hook.example/m1', ['payment.created'], 'tenant-T');
    const s2 = await subscribe('https://hook.example/m2', ['payment.failed'], 'tenant-T');
    const s3 = await subscribe('https://hook.example/m3', ['payment.created'], 'other-tenant');

    deliverMock.mockResolvedValue({ success: true, statusCode: 200 });

    const result = await trigger({
      id: 'e1',
      type: 'payment.created',
      tenantId: 'tenant-T',
      payload: {},
      timestamp: new Date().toISOString(),
    });

    // Only s1 matches.
    expect(deliverMock).toHaveBeenCalledTimes(1);
    expect(deliverMock).toHaveBeenCalledWith('https://hook.example/m1', expect.any(Object), undefined);
    expect(result).toEqual({ delivered: 1, failed: 0 });

    await unsubscribe(s1.id);
    await unsubscribe(s2.id);
    await unsubscribe(s3.id);
  });

  it('reports delivered count when all deliveries succeed', async () => {
    const s = await subscribe('https://hook.example/ok', ['payment.succeeded'], 'tenant-ok');
    deliverMock.mockResolvedValue({ success: true, statusCode: 200 });

    const result = await trigger({
      id: 'e2',
      type: 'payment.succeeded',
      tenantId: 'tenant-ok',
      payload: {},
      timestamp: new Date().toISOString(),
    });

    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(0);
    await unsubscribe(s.id);
  });

  it('reports failed count when every retry fails', async () => {
    const s = await subscribe('https://hook.example/fail', ['payment.failed'], 'tenant-fail');
    deliverMock.mockResolvedValue({ success: false, error: 'HTTP 500' });

    const result = await trigger(
      {
        id: 'e3',
        type: 'payment.failed',
        tenantId: 'tenant-fail',
        payload: {},
        timestamp: new Date().toISOString(),
      },
      2 // reduce retries so the test stays fast
    );

    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(1);
    // Should have attempted exactly `retries` times for the single sub.
    expect(deliverMock).toHaveBeenCalledTimes(2);
    await unsubscribe(s.id);
  });

  it('stops retrying as soon as a delivery succeeds', async () => {
    const s = await subscribe('https://hook.example/flaky', ['payment.created'], 'tenant-flaky');
    deliverMock
      .mockResolvedValueOnce({ success: false, error: 'HTTP 502' })
      .mockResolvedValueOnce({ success: true, statusCode: 200 });

    const result = await trigger(
      {
        id: 'e4',
        type: 'payment.created',
        tenantId: 'tenant-flaky',
        payload: {},
        timestamp: new Date().toISOString(),
      },
      3
    );

    expect(result).toEqual({ delivered: 1, failed: 0 });
    // 1 failure + 1 success = 2 calls; the 3rd retry slot is unused.
    expect(deliverMock).toHaveBeenCalledTimes(2);
    await unsubscribe(s.id);
  });

  it('applies exponential backoff between retries', async () => {
    const s = await subscribe('https://hook.example/backoff', ['payment.created'], 'tenant-bo');
    // Three failures so we get two backoffs between attempts 1->2 and 2->3.
    deliverMock.mockResolvedValue({ success: false, error: 'boom' });

    const timestamps: number[] = [];
    deliverMock.mockImplementation(async () => {
      timestamps.push(Date.now());
      return { success: false, error: 'boom' };
    });

    // Math.random patched to 0 so jitter is deterministic and the formula is:
    //   sleep = 1000 * 2^(attempt-1)  → 1000ms then 2000ms.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    try {
      const result = await trigger(
        {
          id: 'e5',
          type: 'payment.created',
          tenantId: 'tenant-bo',
          payload: {},
          timestamp: new Date().toISOString(),
        },
        3
      );
      expect(result.failed).toBe(1);
      expect(deliverMock).toHaveBeenCalledTimes(3);
      // Gap #1 should be ~1000ms, gap #2 should be ~2000ms (both >= the base).
      const gap1 = timestamps[1]! - timestamps[0]!;
      const gap2 = timestamps[2]! - timestamps[1]!;
      expect(gap1).toBeGreaterThanOrEqual(950);
      expect(gap2).toBeGreaterThanOrEqual(gap1 + 500);
    } finally {
      randomSpy.mockRestore();
      await unsubscribe(s.id);
    }
  }, 15000);
});
