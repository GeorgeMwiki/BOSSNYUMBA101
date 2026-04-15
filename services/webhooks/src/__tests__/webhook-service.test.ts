/**
 * Unit tests for the webhook-service public API.
 *
 * Mocks:
 *   - ./delivery.js        — `deliver` replaced so nothing hits the network.
 *   - @bossnyumba/authz-policy — `rbacEngine.checkPermission` replaced so we
 *     can exercise the allow/deny branches in subscribeWithAuthz.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User as AuthzUser } from '@bossnyumba/authz-policy';

const deliverMock = vi.fn();
const checkPermissionMock = vi.fn();

vi.mock('../delivery.js', () => ({ deliver: deliverMock }));
vi.mock('@bossnyumba/authz-policy', () => ({
  rbacEngine: { checkPermission: checkPermissionMock },
}));

// Import AFTER vi.mock so the mocks are in place at module-load time.
import {
  subscribe,
  subscribeWithAuthz,
  getSubscriptions,
  unsubscribe,
  trigger,
} from '../webhook-service.js';

const adminUser: AuthzUser = { id: 'u1', roles: ['super-admin'], tenantId: 't1' };

const makeEvent = (
  overrides: Partial<Parameters<typeof trigger>[0]> = {}
): Parameters<typeof trigger>[0] => ({
  id: 'e',
  type: 'payment.created',
  tenantId: 'tenant-T',
  payload: {},
  timestamp: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  deliverMock.mockReset();
  checkPermissionMock.mockReset();
});

describe('subscribe + getSubscriptions', () => {
  it('persists a subscription and retrieves it by tenantId', async () => {
    const s = await subscribe('https://hook.example/a', ['payment.created'], 'tenant-x');
    const list = await getSubscriptions('tenant-x');
    expect(list.some((x) => x.id === s.id)).toBe(true);
    await unsubscribe(s.id);
  });
});

describe('subscribeWithAuthz', () => {
  it('allows when rbacEngine allows', async () => {
    checkPermissionMock.mockReturnValue({ allowed: true });
    const sub = await subscribeWithAuthz(
      adminUser,
      'https://hook.example/ok',
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

  it('denies and throws when rbacEngine denies', async () => {
    checkPermissionMock.mockReturnValue({ allowed: false, reason: 'nope' });
    await expect(
      subscribeWithAuthz(adminUser, 'https://hook.example/x', ['payment.created'], 'tenant-deny')
    ).rejects.toThrow('nope');
  });
});

describe('trigger', () => {
  it('fans out only to subscriptions matching tenantId AND event.type', async () => {
    const s1 = await subscribe('https://hook.example/m1', ['payment.created'], 'tenant-T');
    const s2 = await subscribe('https://hook.example/m2', ['payment.failed'], 'tenant-T');
    const s3 = await subscribe('https://hook.example/m3', ['payment.created'], 'other');
    deliverMock.mockResolvedValue({ success: true, statusCode: 200 });

    const result = await trigger(makeEvent({ type: 'payment.created', tenantId: 'tenant-T' }));

    expect(deliverMock).toHaveBeenCalledTimes(1);
    expect(deliverMock).toHaveBeenCalledWith('https://hook.example/m1', expect.any(Object), undefined);
    expect(result).toEqual({ delivered: 1, failed: 0 });

    await unsubscribe(s1.id);
    await unsubscribe(s2.id);
    await unsubscribe(s3.id);
  });

  it('reports delivered=1 when delivery succeeds', async () => {
    const s = await subscribe('https://hook.example/ok', ['payment.succeeded'], 'tenant-ok');
    deliverMock.mockResolvedValue({ success: true, statusCode: 200 });
    const result = await trigger(makeEvent({ type: 'payment.succeeded', tenantId: 'tenant-ok' }));
    expect(result).toEqual({ delivered: 1, failed: 0 });
    await unsubscribe(s.id);
  });

  it('reports failed=1 when every retry fails', async () => {
    const s = await subscribe('https://hook.example/fail', ['payment.failed'], 'tenant-fail');
    deliverMock.mockResolvedValue({ success: false, error: 'HTTP 500' });
    const result = await trigger(
      makeEvent({ type: 'payment.failed', tenantId: 'tenant-fail' }),
      2
    );
    expect(result).toEqual({ delivered: 0, failed: 1 });
    expect(deliverMock).toHaveBeenCalledTimes(2);
    await unsubscribe(s.id);
  });

  it('stops retrying as soon as a delivery succeeds', async () => {
    const s = await subscribe('https://hook.example/flaky', ['payment.created'], 'tenant-flaky');
    deliverMock
      .mockResolvedValueOnce({ success: false, error: 'HTTP 502' })
      .mockResolvedValueOnce({ success: true, statusCode: 200 });
    const result = await trigger(makeEvent({ tenantId: 'tenant-flaky' }), 3);
    expect(result).toEqual({ delivered: 1, failed: 0 });
    expect(deliverMock).toHaveBeenCalledTimes(2);
    await unsubscribe(s.id);
  });

  it('applies exponential backoff between retries', async () => {
    const s = await subscribe('https://hook.example/bo', ['payment.created'], 'tenant-bo');
    const timestamps: number[] = [];
    deliverMock.mockImplementation(async () => {
      timestamps.push(Date.now());
      return { success: false, error: 'boom' };
    });
    // Pin Math.random so sleep = 1000 * 2^(attempt-1): 1000ms, then 2000ms.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const result = await trigger(makeEvent({ tenantId: 'tenant-bo' }), 3);
      expect(result.failed).toBe(1);
      expect(deliverMock).toHaveBeenCalledTimes(3);
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
