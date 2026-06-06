/**
 * Tests for the payments-ledger HTTP client (gateway side) and the engine
 * status -> gateway DB enum mapping.
 *
 * The client is the gateway's only door to the real STK + ledger engine, so
 * these tests pin: the wire-shape of the create-intent call (engine
 * `/api/v1/payments` contract), Authorization passthrough, zod validation of
 * responses, and the typed error surface the route depends on to fail
 * closed (never fabricate a fake STK ack).
 */
import { describe, it, expect, vi } from 'vitest';

import {
  createPaymentsLedgerClient,
  PaymentsLedgerError,
} from '../payments-ledger-client';
import { ledgerStatusToDb } from '../payments-ledger-status';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const BASE = 'http://payments-ledger:3000';
const AUTH = 'Bearer test.jwt.token';

describe('createPaymentsLedgerClient — isConfigured', () => {
  it('is false when no base URL is provided', () => {
    const client = createPaymentsLedgerClient({ baseUrl: undefined });
    expect(client.isConfigured).toBe(false);
  });

  it('is true when a base URL is provided', () => {
    const client = createPaymentsLedgerClient({ baseUrl: BASE });
    expect(client.isConfigured).toBe(true);
  });
});

describe('createPaymentsLedgerClient — createIntent', () => {
  it('POSTs to /api/v1/payments with the engine contract and forwards the JWT', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return jsonResponse(201, {
        paymentIntentId: 'pi_123',
        status: 'PROCESSING',
        instructions: 'Check your phone',
      });
    }) as unknown as typeof fetch;

    const client = createPaymentsLedgerClient({ baseUrl: BASE, fetchImpl });
    const result = await client.createIntent(
      {
        customerId: 'cust_1',
        leaseId: 'lease_1',
        type: 'RENT_PAYMENT',
        amountMinor: 50_000,
        currency: 'KES',
        description: 'June rent',
        paymentMethodId: '254712345678',
        metadata: { accountReference: 'PAY-001', gatewayPaymentId: 'gw_1' },
        idempotencyKey: 'gw-pay-gw_1',
      },
      AUTH,
    );

    expect(capturedUrl).toBe(`${BASE}/api/v1/payments`);
    expect(capturedInit?.method).toBe('POST');
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(AUTH);
    expect(headers['Content-Type']).toBe('application/json');

    const sentBody = JSON.parse(String(capturedInit?.body));
    expect(sentBody).toMatchObject({
      customerId: 'cust_1',
      leaseId: 'lease_1',
      type: 'RENT_PAYMENT',
      amount: { amount: 50_000, currency: 'KES' },
      description: 'June rent',
      paymentMethodId: '254712345678',
      idempotencyKey: 'gw-pay-gw_1',
    });
    expect(sentBody.metadata).toMatchObject({ accountReference: 'PAY-001', gatewayPaymentId: 'gw_1' });

    expect(result).toEqual({
      paymentIntentId: 'pi_123',
      status: 'PROCESSING',
      instructions: 'Check your phone',
    });
  });

  it('throws NOT_CONFIGURED when no base URL is set (never silently succeeds)', async () => {
    const client = createPaymentsLedgerClient({ baseUrl: undefined });
    await expect(
      client.createIntent(
        {
          customerId: 'c',
          type: 'RENT_PAYMENT',
          amountMinor: 1,
          currency: 'KES',
          description: 'x',
          paymentMethodId: '254700000000',
        },
        AUTH,
      ),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });

  it('throws UPSTREAM_ERROR with the status on a non-2xx engine response', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(502, { error: 'M-PESA STK Push failed' }),
    ) as unknown as typeof fetch;
    const client = createPaymentsLedgerClient({ baseUrl: BASE, fetchImpl });

    const err = await client
      .createIntent(
        {
          customerId: 'c',
          type: 'RENT_PAYMENT',
          amountMinor: 1,
          currency: 'KES',
          description: 'x',
          paymentMethodId: '254700000000',
        },
        AUTH,
      )
      .catch((e) => e);
    expect(err).toBeInstanceOf(PaymentsLedgerError);
    expect(err.code).toBe('UPSTREAM_ERROR');
    expect(err.status).toBe(502);
  });

  it('throws BAD_RESPONSE when the engine returns an unexpected shape', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(201, { paymentIntentId: 'pi_1', status: 'NOT_A_REAL_STATUS' }),
    ) as unknown as typeof fetch;
    const client = createPaymentsLedgerClient({ baseUrl: BASE, fetchImpl });

    await expect(
      client.createIntent(
        {
          customerId: 'c',
          type: 'RENT_PAYMENT',
          amountMinor: 1,
          currency: 'KES',
          description: 'x',
          paymentMethodId: '254700000000',
        },
        AUTH,
      ),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });
});

describe('createPaymentsLedgerClient — getIntent', () => {
  it('GETs /api/v1/payments/:id and returns the parsed intent', async () => {
    let capturedUrl = '';
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return jsonResponse(200, {
        id: 'pi_123',
        status: 'SUCCEEDED',
        receiptUrl: 'https://receipts.example/pi_123.pdf',
        paidAt: '2026-06-06T00:00:00.000Z',
      });
    }) as unknown as typeof fetch;

    const client = createPaymentsLedgerClient({ baseUrl: BASE, fetchImpl });
    const intent = await client.getIntent('pi_123', AUTH);

    expect(capturedUrl).toBe(`${BASE}/api/v1/payments/pi_123`);
    expect(intent.status).toBe('SUCCEEDED');
    expect(intent.receiptUrl).toBe('https://receipts.example/pi_123.pdf');
  });

  it('tolerates null receiptUrl/failureReason on a still-processing intent', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        id: 'pi_9',
        status: 'PROCESSING',
        receiptUrl: null,
        failureReason: null,
      }),
    ) as unknown as typeof fetch;
    const client = createPaymentsLedgerClient({ baseUrl: BASE, fetchImpl });
    const intent = await client.getIntent('pi_9', AUTH);
    expect(intent.status).toBe('PROCESSING');
    expect(intent.receiptUrl ?? null).toBeNull();
  });
});

describe('ledgerStatusToDb', () => {
  it('maps engine statuses onto the gateway DB enum', () => {
    expect(ledgerStatusToDb('SUCCEEDED')).toBe('completed');
    expect(ledgerStatusToDb('PROCESSING')).toBe('processing');
    expect(ledgerStatusToDb('REQUIRES_ACTION')).toBe('processing');
    expect(ledgerStatusToDb('FAILED')).toBe('failed');
    expect(ledgerStatusToDb('CANCELLED')).toBe('cancelled');
    expect(ledgerStatusToDb('REFUNDED')).toBe('refunded');
    expect(ledgerStatusToDb('PARTIALLY_REFUNDED')).toBe('partially_refunded');
    expect(ledgerStatusToDb('PENDING')).toBe('pending');
  });
});
