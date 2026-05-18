/**
 * Unit tests for OpayRealAdapter — verifies sandbox-vs-prod env,
 * HMAC-signed POSTs, status mapping, balance / cashflow lookup.
 *
 * All IO mocked. No real network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OpayRealAdapter,
  type OpayRealCredentials,
} from '../src/adapter-real.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const CREDS: OpayRealCredentials = Object.freeze({
  merchantId: 'M-001',
  publicKey: 'pubkey-xyz',
  privateKey: 'sekret-key',
});

beforeEach(() => {
  vi.useRealTimers();
});

describe('OpayRealAdapter — env selection', () => {
  it('defaults to sandbox base URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { code: '00000', data: { reference: 'r-1' } }),
      );
    const adapter = new OpayRealAdapter({ credentials: CREDS, fetch: fetchMock });
    await adapter.initiatePayment({
      tenantId: 't1',
      payerPhone: '+2348012345678',
      amountKobo: 50_000,
      reference: 'rent-1',
    });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url.startsWith('https://sandboxapi.opaycheckout.com')).toBe(true);
  });

  it('uses production URL when env=production', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { code: '00000', data: { reference: 'r-1' } }),
      );
    const adapter = new OpayRealAdapter({
      env: 'production',
      credentials: CREDS,
      fetch: fetchMock,
    });
    await adapter.initiatePayment({
      tenantId: 't1',
      payerPhone: '+2348012345678',
      amountKobo: 50_000,
      reference: 'rent-1',
    });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url.startsWith('https://liveapi.opaypayments.com')).toBe(true);
  });

  it('refuses construction without credentials', () => {
    expect(
      () => new OpayRealAdapter({ credentials: { ...CREDS, privateKey: '' }, fetch: vi.fn() }),
    ).toThrowError(/required/);
  });
});

describe('OpayRealAdapter.initiatePayment', () => {
  it('rejects invalid Nigerian phone before fetch', async () => {
    const fetchMock = vi.fn();
    const adapter = new OpayRealAdapter({ credentials: CREDS, fetch: fetchMock });
    const r = await adapter.initiatePayment({
      tenantId: 't1',
      payerPhone: '+254712345678', // Kenya — not Nigeria
      amountKobo: 100,
      reference: 'r',
    });
    expect(r.status).toBe('failed');
    expect(r.reason).toBe('invalid_payer_phone');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-positive amount', async () => {
    const fetchMock = vi.fn();
    const adapter = new OpayRealAdapter({ credentials: CREDS, fetch: fetchMock });
    const r = await adapter.initiatePayment({
      tenantId: 't1',
      payerPhone: '+2348012345678',
      amountKobo: 0,
      reference: 'r',
    });
    expect(r.status).toBe('failed');
    expect(r.reason).toBe('invalid_amount');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns pending on 00000 response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { code: '00000', data: { reference: 'r-abc' } }),
      );
    const adapter = new OpayRealAdapter({ credentials: CREDS, fetch: fetchMock });
    const r = await adapter.initiatePayment({
      tenantId: 't1',
      payerPhone: '+2348012345678',
      amountKobo: 1_000,
      reference: 'r-abc',
    });
    expect(r.status).toBe('pending');
    expect(r.transactionId).toBe('r-abc');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.['MerchantId']).toBe('M-001');
    expect(headers?.['Authorization']).toBe('Bearer pubkey-xyz');
    expect(typeof headers?.['Signature']).toBe('string');
    expect(headers?.['Signature']?.length).toBeGreaterThan(64);
  });

  it('returns failed when upstream returns non-00000 code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { code: 'E-100', message: 'duplicate reference' }),
      );
    const adapter = new OpayRealAdapter({ credentials: CREDS, fetch: fetchMock });
    const r = await adapter.initiatePayment({
      tenantId: 't1',
      payerPhone: '+2348012345678',
      amountKobo: 1_000,
      reference: 'r',
    });
    expect(r.status).toBe('failed');
    expect(r.reason).toBe('duplicate reference');
  });

  it('returns failed on transport error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    const adapter = new OpayRealAdapter({ credentials: CREDS, fetch: fetchMock });
    const r = await adapter.initiatePayment({
      tenantId: 't1',
      payerPhone: '+2348012345678',
      amountKobo: 1_000,
      reference: 'r',
    });
    expect(r.status).toBe('failed');
  });
});

describe('OpayRealAdapter.verifyPayment', () => {
  it('maps SUCCESS upstream to succeeded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        code: '00000',
        data: {
          reference: 'r-1',
          status: 'SUCCESS',
          amount: { total: 5_000, currency: 'NGN' },
          completedAt: '2026-05-18T00:00:00Z',
        },
      }),
    );
    const adapter = new OpayRealAdapter({ credentials: CREDS, fetch: fetchMock });
    const r = await adapter.verifyPayment({ tenantId: 't', transactionId: 'r-1' });
    expect(r.status).toBe('succeeded');
    expect(r.amountKobo).toBe(5_000);
    expect(r.settledAt).toBe('2026-05-18T00:00:00Z');
  });

  it('maps PENDING upstream to pending', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        code: '00000',
        data: { reference: 'r', status: 'PENDING', amount: { total: 1, currency: 'NGN' } },
      }),
    );
    const adapter = new OpayRealAdapter({ credentials: CREDS, fetch: fetchMock });
    const r = await adapter.verifyPayment({ tenantId: 't', transactionId: 'r' });
    expect(r.status).toBe('pending');
  });

  it('maps REFUNDED to reversed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        code: '00000',
        data: { reference: 'r', status: 'REFUNDED', amount: { total: 100, currency: 'NGN' } },
      }),
    );
    const adapter = new OpayRealAdapter({ credentials: CREDS, fetch: fetchMock });
    const r = await adapter.verifyPayment({ tenantId: 't', transactionId: 'r' });
    expect(r.status).toBe('reversed');
  });

  it('returns failed on non-00000 code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { code: 'E-44', message: 'not found' }));
    const adapter = new OpayRealAdapter({ credentials: CREDS, fetch: fetchMock });
    const r = await adapter.verifyPayment({ tenantId: 't', transactionId: 'r' });
    expect(r.status).toBe('failed');
  });
});

describe('OpayRealAdapter.cashflowLookup', () => {
  it('aggregates samples and totals', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        code: '00000',
        data: {
          samples: [
            { date: '2026-05-16', inflowsKobo: 1000, outflowsKobo: 200 },
            { date: '2026-05-17', inflowsKobo: 500, outflowsKobo: 100 },
          ],
        },
      }),
    );
    const adapter = new OpayRealAdapter({ credentials: CREDS, fetch: fetchMock });
    const r = await adapter.cashflowLookup({
      tenantId: 't',
      payerPhone: '+2348012345678',
      fromDate: '2026-05-16',
      toDate: '2026-05-17',
    });
    expect(r.samples).toHaveLength(2);
    expect(r.totalInflowsKobo).toBe(1500);
    expect(r.totalOutflowsKobo).toBe(300);
  });

  it('returns empty result on transport failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('down'));
    const adapter = new OpayRealAdapter({ credentials: CREDS, fetch: fetchMock });
    const r = await adapter.cashflowLookup({
      tenantId: 't',
      payerPhone: '+2348012345678',
      fromDate: '2026-05-16',
      toDate: '2026-05-17',
    });
    expect(r.samples).toHaveLength(0);
    expect(r.totalInflowsKobo).toBe(0);
  });
});
