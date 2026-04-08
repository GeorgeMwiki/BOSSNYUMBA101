/**
 * PaymentsPage wiring tests
 *
 * These tests validate the api-client layer the PaymentsPage consumes.
 * The page calls `paymentsService.createPayment` / `paymentsService.listPayments`
 * with the shape documented below, so we verify that:
 *   1. Form submission produces the expected POST body + path.
 *   2. Listing produces the expected GET path + query params.
 *   3. Loading state is reflected by the resolved promise.
 *   4. Errors from the underlying client bubble out unchanged so the page
 *      can surface them in its error state.
 *
 * We avoid DOM-level rendering because the customer-app test environment
 * does not ship jsdom / @testing-library, and the task mandate forbids
 * modifying package.json.
 */

import { describe, it, expect, beforeEach, beforeAll, vi, afterEach } from 'vitest';
import {
  initializeApiClient,
  getApiClient,
  paymentsService,
} from '@bossnyumba/api-client';

beforeAll(() => {
  initializeApiClient({ baseUrl: 'http://test.local' });
});

describe('PaymentsPage api-client wiring', () => {
  let getSpy: ReturnType<typeof vi.spyOn>;
  let postSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const client = getApiClient();
    getSpy = vi
      .spyOn(client, 'get')
      .mockResolvedValue({ data: [] } as never);
    postSpy = vi
      .spyOn(client, 'post')
      .mockResolvedValue({ data: {} } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('form submission (createPayment)', () => {
    it('calls createPayment with the exact payload shape the form builds', async () => {
      postSpy.mockResolvedValueOnce({ data: { id: 'pay_1' } } as never);

      // Identical to what PaymentsPage.handleSubmit constructs.
      const payload = {
        tenantId: 'tenant-123',
        amount: 1500,
        method: 'mpesa' as const,
        reference: 'INV-001',
      };

      const res = await paymentsService.createPayment(payload);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith('/api/payments', {
        tenantId: 'tenant-123',
        amount: { amount: 1500, currency: 'KES' },
        method: 'mpesa',
        reference: 'INV-001',
        leaseId: undefined,
        description: undefined,
        phoneNumber: undefined,
      });
      expect((res as { data: { id: string } }).data).toEqual({ id: 'pay_1' });
    });

    it('supports card and bank methods', async () => {
      await paymentsService.createPayment({
        tenantId: 'tenant-123',
        amount: 500,
        method: 'card',
      });
      await paymentsService.createPayment({
        tenantId: 'tenant-123',
        amount: 500,
        method: 'bank',
      });

      expect(postSpy).toHaveBeenCalledTimes(2);
      expect(postSpy.mock.calls[0]?.[1]).toMatchObject({ method: 'card' });
      expect(postSpy.mock.calls[1]?.[1]).toMatchObject({ method: 'bank' });
    });

    it('bubbles errors from the underlying client (error state)', async () => {
      postSpy.mockRejectedValueOnce(new Error('payment gateway down'));

      await expect(
        paymentsService.createPayment({
          tenantId: 'tenant-123',
          amount: 100,
          method: 'mpesa',
        })
      ).rejects.toThrow('payment gateway down');
    });
  });

  describe('history listing (listPayments)', () => {
    it('calls listPayments with tenantId and limit', async () => {
      await paymentsService.listPayments({
        tenantId: 'tenant-123',
        limit: 20,
      });

      expect(getSpy).toHaveBeenCalledTimes(1);
      const [path, options] = getSpy.mock.calls[0] ?? [];
      expect(path).toBe('/api/payments');
      expect(options).toEqual({
        params: {
          tenantId: 'tenant-123',
          limit: '20',
          page: '1',
        },
      });
    });

    it('returns a resolved list (loading state completes successfully)', async () => {
      getSpy.mockResolvedValueOnce({
        data: [
          { id: 'p1', amount: { amount: 1000, currency: 'KES' } },
          { id: 'p2', amount: { amount: 2500, currency: 'KES' } },
        ],
      } as never);

      const res = await paymentsService.listPayments({
        tenantId: 'tenant-123',
        limit: 20,
      });

      expect(Array.isArray((res as { data: unknown[] }).data)).toBe(true);
      expect((res as { data: unknown[] }).data).toHaveLength(2);
    });

    it('bubbles errors from listPayments (error state)', async () => {
      getSpy.mockRejectedValueOnce(new Error('network down'));

      await expect(
        paymentsService.listPayments({ tenantId: 'tenant-123', limit: 20 })
      ).rejects.toThrow('network down');
    });
  });
});
