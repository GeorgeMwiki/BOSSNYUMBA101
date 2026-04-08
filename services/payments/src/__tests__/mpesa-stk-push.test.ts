/**
 * STK-push hardening tests (Week-0).
 *
 * Coverage:
 *   - Happy-path success returns expected response and logs masked MSISDN
 *   - Idempotent retries return the cached response without a second
 *     network call
 *   - Per-tenant rate limiting rejects beyond the configured window
 *   - Rate-limit scoping: separate tenants have independent buckets
 *   - Invalid phone / amount validation
 *   - Failed requests do NOT pollute the idempotency cache
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';

import { InMemoryIdempotencyStore } from '../common/idempotency';
import { FixedWindowRateLimiter } from '../common/rate-limit';
import { maskMsisdn } from '../common/redact';
import {
  getStkIdempotencyStore,
  initiateStkPush,
  RateLimitExceededError,
  setStkIdempotencyStore,
  setStkRateLimiter,
  type StkPushResult,
} from '../providers/mpesa/stk-push';
import { clearMpesaTokenCache } from '../providers/mpesa/auth';
import type { MpesaConfig } from '../providers/mpesa/types';

const CONFIG: MpesaConfig = {
  consumerKey: 'ck-test',
  consumerSecret: 'cs-test',
  shortCode: '174379',
  passKey: 'pk-test',
  environment: 'sandbox',
  callbackBaseUrl: 'https://example.test',
};

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function installFetchMock(): {
  calls: FetchCall[];
  spy: MockInstance;
} {
  const calls: FetchCall[] = [];
  const impl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });

    if (url.includes('/oauth/v1/generate')) {
      return new Response(
        JSON.stringify({ access_token: 'token-abc', expires_in: '3599' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url.includes('/mpesa/stkpush/v1/processrequest')) {
      return new Response(
        JSON.stringify({
          MerchantRequestID: 'MR-1',
          CheckoutRequestID: 'CR-1',
          ResponseCode: '0',
          ResponseDescription: 'Success. Request accepted for processing',
          CustomerMessage: 'Success. Request accepted for processing',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ error: 'unexpected url' }), {
      status: 500,
    });
  };
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(impl as typeof fetch);
  return { calls, spy };
}

describe('initiateStkPush (hardened)', () => {
  beforeEach(() => {
    setStkIdempotencyStore(new InMemoryIdempotencyStore<StkPushResult>());
    setStkRateLimiter(new FixedWindowRateLimiter({ limit: 3, windowMs: 60_000 }));
    clearMpesaTokenCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('happy path returns a pending STK push and succeeds', async () => {
    const { calls } = installFetchMock();
    const res = await initiateStkPush(CONFIG, {
      amount: { amountMinorUnits: 150_00, currency: 'KES' },
      phone: '0712345678',
      reference: 'INV-1',
      tenantId: 't-1',
      orderId: 'O-1',
    });
    expect(res.status).toBe('PENDING');
    expect(res.checkoutRequestId).toBe('CR-1');
    expect(res.merchantRequestId).toBe('MR-1');
    expect(res.replayed).toBeUndefined();
    // One OAuth fetch + one STK push fetch
    expect(calls.length).toBe(2);
  });

  it('replays an identical request from the idempotency cache without calling Daraja again', async () => {
    const { calls } = installFetchMock();
    const params = {
      amount: { amountMinorUnits: 500_00, currency: 'KES' as const },
      phone: '254712345678',
      reference: 'INV-2',
      tenantId: 't-1',
      orderId: 'O-2',
      idempotencyKey: 'client-key-42',
    };

    const first = await initiateStkPush(CONFIG, params);
    expect(first.replayed).toBeUndefined();
    const before = calls.length;

    const second = await initiateStkPush(CONFIG, params);
    expect(second.replayed).toBe(true);
    expect(second.checkoutRequestId).toBe(first.checkoutRequestId);
    // No new outbound HTTP calls.
    expect(calls.length).toBe(before);
  });

  it('derives an idempotency key from (tenantId, orderId, amount) when header is absent', async () => {
    installFetchMock();
    const store = getStkIdempotencyStore();
    const spy = vi.spyOn(store, 'begin');

    await initiateStkPush(CONFIG, {
      amount: { amountMinorUnits: 100_00, currency: 'KES' },
      phone: '0712345678',
      reference: 'INV-3',
      tenantId: 'tenant-xyz',
      orderId: 'order-xyz',
    });
    expect(spy).toHaveBeenCalledOnce();
    const key = spy.mock.calls[0]![0];
    expect(key).toMatch(/^stk:/);
    expect(key).not.toContain('tenant-xyz'); // hashed, not plaintext
  });

  it('rejects with RateLimitExceededError after the configured burst', async () => {
    installFetchMock();
    const params = (i: number) => ({
      amount: { amountMinorUnits: (100 + i) * 100, currency: 'KES' as const },
      phone: '0712345678',
      reference: `INV-${i}`,
      tenantId: 't-rl',
      orderId: `order-${i}`,
    });
    await initiateStkPush(CONFIG, params(1));
    await initiateStkPush(CONFIG, params(2));
    await initiateStkPush(CONFIG, params(3));
    await expect(initiateStkPush(CONFIG, params(4))).rejects.toBeInstanceOf(
      RateLimitExceededError
    );
  });

  it('rate-limit buckets are scoped per tenant', async () => {
    installFetchMock();
    const params = (tenant: string, i: number) => ({
      amount: { amountMinorUnits: (100 + i) * 100, currency: 'KES' as const },
      phone: '0712345678',
      reference: `INV-${tenant}-${i}`,
      tenantId: tenant,
      orderId: `order-${tenant}-${i}`,
    });
    await initiateStkPush(CONFIG, params('a', 1));
    await initiateStkPush(CONFIG, params('a', 2));
    await initiateStkPush(CONFIG, params('a', 3));
    // Tenant b is fresh -- should be allowed.
    await expect(
      initiateStkPush(CONFIG, params('b', 1))
    ).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('redacts MSISDN via maskMsisdn helper', () => {
    expect(maskMsisdn('254712345678')).toBe('254***5678');
    expect(maskMsisdn('+254712345678')).toBe('254***5678');
    expect(maskMsisdn('0712345678')).toBe('071***5678');
    expect(maskMsisdn(undefined)).toBe('***REDACTED***');
  });

  it('rejects invalid currency', async () => {
    installFetchMock();
    await expect(
      initiateStkPush(CONFIG, {
        amount: { amountMinorUnits: 100_00, currency: 'USD' },
        phone: '0712345678',
        reference: 'INV-X',
      })
    ).rejects.toThrow(/only supports KES/);
  });

  it('rejects amounts outside the Daraja bounds', async () => {
    installFetchMock();
    await expect(
      initiateStkPush(CONFIG, {
        amount: { amountMinorUnits: 0, currency: 'KES' },
        phone: '0712345678',
        reference: 'INV-Y',
      })
    ).rejects.toThrow(/between 1 and 150,000/);
  });

  it('does not poison the idempotency cache on a failed request', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (
      input: string | URL | Request
    ) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/oauth/v1/generate')) {
        return new Response(
          JSON.stringify({ access_token: 'tok', expires_in: '3599' }),
          { status: 200 }
        );
      }
      callCount += 1;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            ResponseCode: '1',
            ResponseDescription: 'Bad request',
            errorMessage: 'Bad request',
          }),
          { status: 400 }
        );
      }
      return new Response(
        JSON.stringify({
          MerchantRequestID: 'MR-2',
          CheckoutRequestID: 'CR-2',
          ResponseCode: '0',
          CustomerMessage: 'OK',
        }),
        { status: 200 }
      );
    }) as typeof fetch);

    const params = {
      amount: { amountMinorUnits: 100_00, currency: 'KES' as const },
      phone: '0712345678',
      reference: 'INV-RETRY',
      tenantId: 't-retry',
      orderId: 'order-retry',
      idempotencyKey: 'retry-key',
    };

    await expect(initiateStkPush(CONFIG, params)).rejects.toThrow();
    // After a failure the same key must be retryable.
    const ok = await initiateStkPush(CONFIG, params);
    expect(ok.status).toBe('PENDING');
    expect(ok.checkoutRequestId).toBe('CR-2');
  });
});
