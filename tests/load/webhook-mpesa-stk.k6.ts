/**
 * k6 load test — M-Pesa STK Push callback simulator (ported from Borjie).
 *
 * Webhook receive is one of the four production paths that must hit a
 * real SLO budget. The Safaricom Daraja STK callback is the highest-
 * volume payments webhook — every customer top-up flows through it.
 *
 * Endpoint: POST {K6_PAYMENTS_URL}/webhooks/mpesa/stk
 *
 * Body shape mirrors Safaricom's documented payload. We send the
 * happy-path (`ResultCode: 0`) variant, populated with fresh
 * CheckoutRequestID per iteration so idempotency-dedup does not
 * short-circuit the ledger writer.
 *
 * Signature: optional. When `K6_MPESA_WEBHOOK_SECRET` is set we attach
 * an `X-Mpesa-Signature: <unix>.<hex>` header computed via
 * HMAC-SHA256 over `${ts}.${rawBody}`.
 *
 * SLO: p95 < 400 ms, p99 < 800 ms — see `lib/config.ts`
 *      `webhook.mpesa.stk`.
 *
 * Run:
 *   K6_PAYMENTS_URL=http://localhost:3001 \
 *   K6_SCENARIO=normal \
 *   k6 run tests/load/webhook-mpesa-stk.k6.ts
 */

import http from 'k6/http';
import crypto from 'k6/crypto';
import { check, sleep } from 'k6';

import { BASE_URL, LOADTEST_RUN_ID, buildOptions } from './lib/config';

export const options = buildOptions('webhook.mpesa.stk');

declare const __ENV: Readonly<Record<string, string | undefined>>;

const PAYMENTS_BASE_URL: string =
  __ENV.K6_PAYMENTS_URL && __ENV.K6_PAYMENTS_URL.trim().length > 0
    ? __ENV.K6_PAYMENTS_URL.trim()
    : 'http://localhost:3001';

const WEBHOOK_SECRET: string = __ENV.K6_MPESA_WEBHOOK_SECRET ?? '';

interface StkCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata: {
        Item: ReadonlyArray<{ Name: string; Value: string | number }>;
      };
    };
  };
}

function buildStkCallback(): StkCallbackPayload {
  const merchantId = `ws_CO_${Date.now()}${Math.floor(
    Math.random() * 100000,
  )}`;
  const checkoutId = `ws_CO_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const amount = Math.floor(1_000 + Math.random() * 9_000);
  const phone = `2547${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: merchantId,
        CheckoutRequestID: checkoutId,
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: amount },
            { Name: 'MpesaReceiptNumber', Value: `LOADTEST-${checkoutId.slice(-8)}` },
            { Name: 'TransactionDate', Value: Number(formatTransactionDate(new Date())) },
            { Name: 'PhoneNumber', Value: phone },
          ],
        },
      },
    },
  };
}

function formatTransactionDate(d: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

interface HeaderBag {
  [k: string]: string;
}

function buildHeaders(rawBody: string): HeaderBag {
  const base: HeaderBag = {
    'Content-Type': 'application/json',
    'User-Agent': `bossnyumba-k6/1 (${LOADTEST_RUN_ID})`,
    'X-Loadtest-Run-Id': LOADTEST_RUN_ID,
    'X-Forwarded-For': '196.201.214.200',
  };

  if (WEBHOOK_SECRET.length > 0) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${timestamp}.${rawBody}`;
    const digest = crypto.hmac('sha256', WEBHOOK_SECRET, message, 'hex');
    base['X-Mpesa-Signature'] = `${timestamp}.${digest}`;
  }

  return base;
}

function endpointUrl(): string {
  return `${PAYMENTS_BASE_URL.replace(/\/+$/u, '')}/webhooks/mpesa/stk`;
}

export default function webhookMpesaStkIteration(): void {
  const payload = buildStkCallback();
  const rawBody = JSON.stringify(payload);
  const headers = buildHeaders(rawBody);

  const res = http.post(endpointUrl(), rawBody, {
    headers,
    tags: { name: 'webhook.mpesa.stk' },
    timeout: '5s',
  });

  check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'response body present': (r) => {
      const body = typeof r.body === 'string' ? r.body : '';
      return body.length > 0;
    },
  });

  sleep(0.5);

  void BASE_URL;
}
