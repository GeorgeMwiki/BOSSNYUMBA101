/**
 * OPay Business real adapter — production wiring for the Nigeria OPay
 * Merchant API. Lives alongside the existing `MockOpayAdapter` /
 * `OpayMerchantAdapter` stubs in `adapter.ts`. Composition root selects
 * this adapter when `OPAY_MERCHANT_ID` + `OPAY_PUBLIC_KEY` +
 * `OPAY_PRIVATE_KEY` env vars are all set; otherwise falls back to the
 * mock.
 *
 * Endpoints covered (OPay v3 Merchant API):
 *   - `POST /api/v3/payment/initialize`  — initiate payment.
 *   - `GET  /api/v3/payment/status/{ref}` — verify payment by reference.
 *   - `GET  /api/v3/account/balance`     — cashflow / wallet balance.
 *
 * Auth: OPay uses a Bearer signature: `Authorization: Bearer <publicKey>`
 * plus an HMAC-SHA512 of the request body in the `MerchantId` and
 * `Signature` headers. We compute the HMAC via Node's `crypto` module
 * — no third-party deps.
 *
 * Sandbox vs production: `OPAY_ENV=sandbox|production` selects the
 * default base URL.
 *
 * Tests inject `fetch`; no real network in CI.
 */

import { createHmac } from 'node:crypto';
import type {
  CashflowLookupArgs,
  CashflowLookupResult,
  CashflowSample,
  InitiatePaymentArgs,
  InitiatePaymentResult,
  OpayAdapter,
  VerifyPaymentArgs,
  VerifyPaymentResult,
} from './types.js';

export type OpayEnv = 'sandbox' | 'production';

const BASE_URLS: Readonly<Record<OpayEnv, string>> = Object.freeze({
  sandbox: 'https://sandboxapi.opaycheckout.com',
  production: 'https://liveapi.opaypayments.com',
});

const NG_PHONE = /^(?:\+234|0)[789][01]\d{8}$/;

export interface OpayRealCredentials {
  readonly merchantId: string;
  readonly publicKey: string;
  /** HMAC-SHA512 secret. */
  readonly privateKey: string;
}

export interface OpayRealAdapterDeps {
  readonly env?: OpayEnv;
  readonly baseUrl?: string;
  readonly credentials: OpayRealCredentials;
  readonly fetch?: typeof fetch;
  readonly clock?: () => number;
  /** Defaults to 12s. */
  readonly timeoutMs?: number;
}

interface OpayInitializeResponse {
  readonly code?: string;
  readonly message?: string;
  readonly data?: {
    readonly reference?: string;
    readonly orderNo?: string;
    readonly status?: string;
    readonly cashierUrl?: string;
  };
}

interface OpayStatusResponse {
  readonly code?: string;
  readonly message?: string;
  readonly data?: {
    readonly reference?: string;
    readonly status?: string;
    readonly amount?: { readonly total?: number; readonly currency?: string };
    readonly completedAt?: string;
  };
}

interface OpayBalanceResponse {
  readonly code?: string;
  readonly message?: string;
  readonly data?: {
    readonly balanceKobo?: number;
    readonly samples?: ReadonlyArray<{
      readonly date?: string;
      readonly inflowsKobo?: number;
      readonly outflowsKobo?: number;
    }>;
  };
}

/**
 * Production OPay Business adapter — drop-in for `OpayAdapter`.
 */
export class OpayRealAdapter implements OpayAdapter {
  private readonly env: OpayEnv;
  private readonly baseUrl: string;
  private readonly credentials: OpayRealCredentials;
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => number;
  private readonly timeoutMs: number;

  constructor(deps: OpayRealAdapterDeps) {
    this.env = deps.env ?? 'sandbox';
    this.baseUrl = deps.baseUrl ?? BASE_URLS[this.env];
    this.credentials = deps.credentials;
    this.clock = deps.clock ?? Date.now;
    this.timeoutMs = deps.timeoutMs ?? 12_000;

    const fetchImpl = deps.fetch ?? globalThis.fetch;
    if (!fetchImpl) throw new Error('OpayRealAdapter: no fetch implementation');
    this.fetchImpl = fetchImpl;

    if (!this.credentials.merchantId || !this.credentials.publicKey || !this.credentials.privateKey) {
      throw new Error('OpayRealAdapter: merchantId + publicKey + privateKey required');
    }
  }

  // HIGH-5 (audit .audit/post-pr90-api-mcp-bug-sweep.md):
  //
  //  1. The old GET helper signed `hmac(path)` only — any captured
  //     signature could be replayed forever.
  //  2. The old POST signed `hmac(body)` only — same body re-submittable.
  //  3. Error messages echoed back the upstream response body, leaking
  //     OPay error details (occasionally including merchant credentials)
  //     into our logs.
  //
  // Fix:
  //  - Sign `${timestamp}.${path}` for GET and `${timestamp}.${body}`
  //    for POST.
  //  - Emit `X-OPay-Timestamp` so the receiver can enforce a window.
  //  - Strip the upstream body from thrown error messages — only path +
  //    status survive.
  private hmacSignature(payload: string): string {
    return createHmac('sha512', this.credentials.privateKey).update(payload, 'utf8').digest('hex');
  }

  private async post<R>(path: string, body: unknown): Promise<R> {
    const serialised = JSON.stringify(body);
    const timestamp = String(Date.now());
    const signature = this.hmacSignature(`${timestamp}.${serialised}`);
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this.credentials.publicKey}`,
          MerchantId: this.credentials.merchantId,
          Signature: signature,
          'X-OPay-Timestamp': timestamp,
        },
        body: serialised,
        signal: controller.signal,
      });
      const text = await res.text();
      const parsed = text.length > 0 ? (JSON.parse(text) as R) : (null as unknown as R);
      if (!res.ok) {
        // HIGH-5: NEVER echo upstream body. status + path only.
        throw new Error(`opay ${path} status=${res.status}`);
      }
      return parsed;
    } finally {
      clearTimeout(handle);
    }
  }

  private async get<R>(path: string): Promise<R> {
    const timestamp = String(Date.now());
    const signature = this.hmacSignature(`${timestamp}.${path}`);
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.credentials.publicKey}`,
          MerchantId: this.credentials.merchantId,
          Signature: signature,
          'X-OPay-Timestamp': timestamp,
        },
        signal: controller.signal,
      });
      const text = await res.text();
      const parsed = text.length > 0 ? (JSON.parse(text) as R) : (null as unknown as R);
      if (!res.ok) {
        // HIGH-5: status + path only; never echo upstream body.
        throw new Error(`opay ${path} status=${res.status}`);
      }
      return parsed;
    } finally {
      clearTimeout(handle);
    }
  }

  async initiatePayment(args: InitiatePaymentArgs): Promise<InitiatePaymentResult> {
    if (!NG_PHONE.test(args.payerPhone)) {
      return Object.freeze({
        transactionId: '',
        status: 'failed' as const,
        reason: 'invalid_payer_phone',
      });
    }
    if (args.amountKobo <= 0) {
      return Object.freeze({
        transactionId: '',
        status: 'failed' as const,
        reason: 'invalid_amount',
      });
    }
    const body = {
      country: 'NG',
      reference: args.reference,
      amount: { total: args.amountKobo, currency: 'NGN' },
      product: { name: args.narration ?? 'BossNyumba', description: args.narration ?? '' },
      payMethod: 'BankCard',
      callbackUrl: '',
      userInfo: { userPhone: args.payerPhone, userId: args.tenantId },
      expireAt: 30,
    };
    try {
      const res = await this.post<OpayInitializeResponse>('/api/v3/payment/initialize', body);
      if (res.code !== '00000' || !res.data?.reference) {
        return Object.freeze({
          transactionId: res.data?.reference ?? '',
          status: 'failed' as const,
          reason: res.message ?? `code=${res.code ?? 'unknown'}`,
        });
      }
      return Object.freeze({
        transactionId: res.data.reference,
        status: 'pending' as const,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown';
      return Object.freeze({
        transactionId: '',
        status: 'failed' as const,
        reason,
      });
    }
  }

  async verifyPayment(args: VerifyPaymentArgs): Promise<VerifyPaymentResult> {
    try {
      const res = await this.get<OpayStatusResponse>(
        `/api/v3/payment/status/${encodeURIComponent(args.transactionId)}`,
      );
      if (res.code !== '00000' || !res.data) {
        return Object.freeze({ status: 'failed' as const, amountKobo: 0 });
      }
      const status = mapOpayStatus(res.data.status ?? '');
      const settled = res.data.completedAt;
      const amount = res.data.amount?.total ?? 0;
      const result: VerifyPaymentResult = settled
        ? { status, amountKobo: amount, settledAt: settled }
        : { status, amountKobo: amount };
      return Object.freeze(result);
    } catch {
      return Object.freeze({ status: 'failed' as const, amountKobo: 0 });
    }
  }

  async cashflowLookup(args: CashflowLookupArgs): Promise<CashflowLookupResult> {
    try {
      // CRITICAL #7 — Phone number (PII) MUST NOT appear in URL query
      // strings. L7 proxies, WAFs, CDNs and access logs all retain the
      // query string verbatim, so any `?phone=+234...` leaks the
      // payer's number into long-retention infra logs. We POST the
      // lookup with the phone in the request BODY (HMAC-signed) so
      // the URL only carries an opaque RPC path.
      const path = `/api/v3/account/balance`;
      const body = {
        phone: args.payerPhone,
        from: args.fromDate,
        to: args.toDate,
      };
      const res = await this.post<OpayBalanceResponse>(path, body);
      if (res.code !== '00000' || !res.data) {
        return Object.freeze({
          samples: Object.freeze([] as ReadonlyArray<CashflowSample>),
          totalInflowsKobo: 0,
          totalOutflowsKobo: 0,
        });
      }
      const samples: CashflowSample[] = (res.data.samples ?? []).map((s) =>
        Object.freeze({
          date: s.date ?? '',
          inflowsKobo: s.inflowsKobo ?? 0,
          outflowsKobo: s.outflowsKobo ?? 0,
        }),
      );
      let totalIn = 0;
      let totalOut = 0;
      for (const s of samples) {
        totalIn += s.inflowsKobo;
        totalOut += s.outflowsKobo;
      }
      return Object.freeze({
        samples: Object.freeze(samples),
        totalInflowsKobo: totalIn,
        totalOutflowsKobo: totalOut,
      });
    } catch {
      return Object.freeze({
        samples: Object.freeze([] as ReadonlyArray<CashflowSample>),
        totalInflowsKobo: 0,
        totalOutflowsKobo: 0,
      });
    }
  }

  /** Diagnostic — surface env so the composition root can log. */
  diagnostics(): { readonly env: OpayEnv; readonly baseUrl: string; readonly now: number } {
    return Object.freeze({ env: this.env, baseUrl: this.baseUrl, now: this.clock() });
  }
}

function mapOpayStatus(raw: string): VerifyPaymentResult['status'] {
  const v = raw.toUpperCase();
  if (v === 'SUCCESS' || v === 'PAID') return 'succeeded';
  if (v === 'PENDING' || v === 'INITIAL' || v === 'INPROGRESS') return 'pending';
  if (v === 'REVERSED' || v === 'REFUNDED') return 'reversed';
  return 'failed';
}
