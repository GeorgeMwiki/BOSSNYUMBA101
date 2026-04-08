/**
 * M-Pesa STK Push (Lipa Na M-Pesa) payment initiation.
 *
 * Week-0 hardening:
 *   1. Idempotency: every request is keyed on a client-supplied
 *      `Idempotency-Key` (or a deterministic derivation of
 *      {tenantId, orderId, amount}). Replays within the retention window
 *      return the cached response instead of hitting Daraja a second time.
 *   2. Per-tenant rate limiting (default 10/min, env-tunable).
 *   3. MSISDN redaction in every log record.
 *   4. No plaintext phone numbers in structured log context -- callers that
 *      need to correlate should use the `reference` field.
 */
import { ValidationError } from '../../common/errors';
import {
  deriveIdempotencyKey,
  InMemoryIdempotencyStore,
  type IdempotencyStore,
} from '../../common/idempotency';
import { logger } from '../../common/logger';
import {
  defaultStkRateLimiter,
  type RateLimiter,
  type RateLimitResult,
} from '../../common/rate-limit';
import { maskMsisdn } from '../../common/redact';
import { withRetry } from '../../common/retry';
import type { Money } from '../../common/types';
import { getMpesaAccessToken } from './auth';
import type { MpesaConfig } from './types';

const STK_PUSH_PATH = '/mpesa/stkpush/v1/processrequest';

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned;
  }
  return cleaned;
}

function generatePassword(shortCode: string, passKey: string): {
  password: string;
  timestamp: string;
} {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .substring(0, 14);
  const password = Buffer.from(`${shortCode}${passKey}${timestamp}`).toString(
    'base64'
  );
  return { password, timestamp };
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  status: 'PENDING';
  message: string;
  /** True when the result was served from the idempotency cache. */
  replayed?: boolean;
}

export interface StkPushParams {
  amount: Money;
  phone: string;
  reference: string;
  description?: string;
  /**
   * Tenant scope for rate limiting + idempotency derivation. Defaults to
   * "default" but should always be supplied in production traffic.
   */
  tenantId?: string;
  /** Business order/invoice id used when deriving an idempotency key. */
  orderId?: string;
  /**
   * Idempotency-Key supplied by the client. If absent, a key is derived
   * from (tenantId, orderId, amount).
   */
  idempotencyKey?: string;
}

export class RateLimitExceededError extends ValidationError {
  public readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(
      `M-Pesa STK push rate limit exceeded; retry after ${Math.ceil(retryAfterMs / 1000)}s`,
      'mpesa'
    );
    this.retryAfterMs = retryAfterMs;
    this.name = 'RateLimitExceededError';
  }
}

/**
 * Module-level idempotency store shared by `initiateStkPush`. Tests can
 * override via `setStkIdempotencyStore` or reset via
 * `stkIdempotencyStore.clear()`.
 */
let stkIdempotencyStore: IdempotencyStore<StkPushResult> =
  new InMemoryIdempotencyStore<StkPushResult>();

export function setStkIdempotencyStore(
  store: IdempotencyStore<StkPushResult>
): void {
  stkIdempotencyStore = store;
}

export function getStkIdempotencyStore(): IdempotencyStore<StkPushResult> {
  return stkIdempotencyStore;
}

let stkRateLimiter: RateLimiter = defaultStkRateLimiter;

export function setStkRateLimiter(limiter: RateLimiter): void {
  stkRateLimiter = limiter;
}

export function getStkRateLimiter(): RateLimiter {
  return stkRateLimiter;
}

function resolveIdempotencyKey(params: StkPushParams): string {
  if (params.idempotencyKey && params.idempotencyKey.trim()) {
    return `stk:hdr:${params.idempotencyKey.trim()}`;
  }
  return deriveIdempotencyKey({
    tenantId: params.tenantId ?? 'default',
    orderId: params.orderId ?? params.reference,
    amount: params.amount.amountMinorUnits,
  });
}

export async function initiateStkPush(
  config: MpesaConfig,
  params: StkPushParams
): Promise<StkPushResult> {
  if (params.amount.currency !== 'KES') {
    throw new ValidationError('M-Pesa only supports KES', 'mpesa');
  }

  const amountMajor = Math.round(params.amount.amountMinorUnits / 100);
  if (amountMajor < 1 || amountMajor > 150000) {
    throw new ValidationError(
      'M-Pesa amount must be between 1 and 150,000 KES',
      'mpesa'
    );
  }

  const phoneNumber = normalizePhone(params.phone);
  if (phoneNumber.length !== 12) {
    throw new ValidationError('Invalid phone number format', 'mpesa');
  }

  // --- Rate limit (per tenant) ---------------------------------------------
  const tenantId = params.tenantId ?? 'default';
  const rate: RateLimitResult = stkRateLimiter.check(`stk:${tenantId}`);
  if (!rate.allowed) {
    logger.warn(
      {
        tenantId,
        reference: params.reference,
        count: rate.count,
        limit: rate.limit,
        retryAfterMs: rate.retryAfterMs,
        msisdn: maskMsisdn(phoneNumber),
        provider: 'mpesa',
      },
      'M-Pesa STK push rate limit exceeded'
    );
    throw new RateLimitExceededError(rate.retryAfterMs);
  }

  // --- Idempotency ---------------------------------------------------------
  const idempotencyKey = resolveIdempotencyKey(params);
  const lookup = await stkIdempotencyStore.begin(idempotencyKey);
  if (lookup.status === 'replayed') {
    logger.info(
      {
        idempotencyKey,
        tenantId,
        reference: params.reference,
        msisdn: maskMsisdn(phoneNumber),
        provider: 'mpesa',
      },
      'M-Pesa STK push served from idempotency cache'
    );
    return { ...lookup.value, replayed: true };
  }
  if (lookup.status === 'in-flight') {
    // Another request with the same key is already hitting Daraja. Bail out
    // fast with a validation error rather than double-charging the customer.
    throw new ValidationError(
      'Duplicate STK push in flight for this idempotency key',
      'mpesa'
    );
  }

  try {
    const accessToken = await getMpesaAccessToken(config);
    const { password, timestamp } = generatePassword(
      config.shortCode,
      config.passKey
    );

    const baseUrl =
      config.environment === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';

    const body = {
      BusinessShortCode: config.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline' as const,
      Amount: amountMajor,
      PartyA: phoneNumber,
      PartyB: config.shortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: `${config.callbackBaseUrl}/webhooks/mpesa/stk`,
      AccountReference: params.reference.substring(0, 12),
      TransactionDesc: (params.description || 'Payment').substring(0, 13),
    };

    const doRequest = async () => {
      const response = await fetch(`${baseUrl}${STK_PUSH_PATH}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as {
        MerchantRequestID?: string;
        CheckoutRequestID?: string;
        ResponseCode?: string;
        ResponseDescription?: string;
        CustomerMessage?: string;
        errorMessage?: string;
      };

      if (!response.ok || data.ResponseCode !== '0') {
        const msg =
          data.errorMessage || data.ResponseDescription || response.statusText;
        throw new ValidationError(`M-Pesa STK Push failed: ${msg}`, 'mpesa');
      }

      return {
        checkoutRequestId: data.CheckoutRequestID!,
        merchantRequestId: data.MerchantRequestID!,
        status: 'PENDING' as const,
        message: data.CustomerMessage || 'Enter PIN on your phone',
      };
    };

    const result = await withRetry(doRequest);
    await stkIdempotencyStore.complete(idempotencyKey, result);

    logger.info(
      {
        checkoutRequestId: result.checkoutRequestId,
        merchantRequestId: result.merchantRequestId,
        reference: params.reference,
        tenantId,
        amount: amountMajor,
        msisdn: maskMsisdn(phoneNumber),
        idempotencyKey,
        provider: 'mpesa',
      },
      'M-Pesa STK push initiated'
    );

    return result;
  } catch (err) {
    // Drop the in-flight marker so a subsequent retry from the client is
    // allowed to try again. We deliberately do NOT cache failures -- the
    // customer must be able to retry transient errors.
    await stkIdempotencyStore.fail(idempotencyKey);

    logger.error(
      {
        err,
        reference: params.reference,
        tenantId,
        msisdn: maskMsisdn(phoneNumber),
        idempotencyKey,
        provider: 'mpesa',
      },
      'M-Pesa STK push failed'
    );
    throw err;
  }
}
