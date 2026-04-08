/**
 * M-Pesa STK Push and B2C callback processing.
 *
 * Week-0 hardening:
 *   1. HMAC-SHA256 signature verification against `MPESA_CALLBACK_SECRET`.
 *      Callers MUST pass the raw request body and the signature header; the
 *      verifier uses `crypto.timingSafeEqual` to avoid leaking the secret
 *      via response-time side channels.
 *   2. Replay protection: the tuple (MerchantRequestID, CheckoutRequestID)
 *      is tracked in a 24h store and a duplicate is rejected with a
 *      dedicated `DuplicateCallbackError`.
 *   3. PII redaction in logs: MSISDNs are masked before any log emission.
 *   4. Secret is read fresh from env on every verification call so that
 *      rotation does not require a redeploy.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { CallbackError } from '../../common/errors';
import { logger } from '../../common/logger';
import { maskMsisdn } from '../../common/redact';
import {
  defaultCallbackReplayStore,
  type ReplayStore,
} from '../../common/replay-store';
import type { PaymentStatus } from '../../common/types';
import type {
  StkCallbackPayload,
  StkCallbackMetadataItem,
  B2CCallbackResult,
} from './types';

export interface StkCallbackResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  status: PaymentStatus;
  mpesaReceiptNumber?: string;
  amount?: number;
  phoneNumber?: string;
  transactionDate?: string;
}

export interface B2CCallbackResultParsed {
  conversationId: string;
  transactionId?: string;
  status: PaymentStatus;
  amount?: number;
  recipientPhone?: string;
}

export class InvalidSignatureError extends CallbackError {
  constructor() {
    super('Invalid or missing M-Pesa callback signature', 'mpesa');
    this.name = 'InvalidSignatureError';
  }
}

export class DuplicateCallbackError extends CallbackError {
  constructor(key: string) {
    super(`Duplicate M-Pesa callback rejected: ${key}`, 'mpesa');
    this.name = 'DuplicateCallbackError';
  }
}

function getMetadataItem(
  items: StkCallbackMetadataItem[],
  name: string
): string | number | undefined {
  const item = items.find((i) => i.Name === name);
  return item?.Value;
}

/**
 * Timing-safe comparison of two ASCII strings. Pads to equal length so that
 * length differences do not short-circuit the compare and leak information.
 */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  // timingSafeEqual requires equal-length inputs; normalise by hashing both
  // sides to a fixed length via HMAC. The "secret" here is a constant
  // because we only want equal-length byte comparison, not a new HMAC.
  const lenEqual = aBuf.length === bBuf.length;
  const len = Math.max(aBuf.length, bBuf.length);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  aBuf.copy(padA);
  bBuf.copy(padB);
  // Perform the compare regardless of length to keep timing constant, then
  // AND with the length equality check at the end.
  const equal = timingSafeEqual(padA, padB);
  return equal && lenEqual;
}

/**
 * Resolve the callback HMAC secret. Read fresh from env on every call so
 * rotation is picked up without a redeploy.
 */
function resolveCallbackSecret(override?: string): string {
  const secret = override ?? process.env.MPESA_CALLBACK_SECRET ?? '';
  return secret;
}

/**
 * Verify an M-Pesa callback HMAC signature using `timingSafeEqual`.
 *
 * The signature is expected in one of the following formats in the
 * `X-Mpesa-Signature` header:
 *   - bare hex digest
 *   - `sha256=<hex>`
 *
 * Returns true iff the HMAC-SHA256 of `rawBody` using `MPESA_CALLBACK_SECRET`
 * matches the provided signature, compared in constant time.
 *
 * If the secret is not configured we refuse to verify (return false) --
 * Week-0 policy is fail-closed.
 */
export function verifyMpesaCallbackSignature(
  rawBody: string,
  signature: string | undefined | null,
  secret?: string
): boolean {
  const key = resolveCallbackSecret(secret);
  if (!key) {
    logger.error(
      { provider: 'mpesa' },
      'MPESA_CALLBACK_SECRET not configured; refusing to accept callback'
    );
    return false;
  }
  if (!signature) return false;

  const provided = signature.startsWith('sha256=')
    ? signature.slice('sha256='.length)
    : signature;

  const expected = createHmac('sha256', key).update(rawBody).digest('hex');
  return safeEqual(provided.toLowerCase(), expected.toLowerCase());
}

// --- Replay protection ------------------------------------------------------

let callbackReplayStore: ReplayStore = defaultCallbackReplayStore;

export function setCallbackReplayStore(store: ReplayStore): void {
  callbackReplayStore = store;
}

export function getCallbackReplayStore(): ReplayStore {
  return callbackReplayStore;
}

function replayKey(merchantRequestId: string, checkoutRequestId: string): string {
  return `mpesa:cb:${merchantRequestId}:${checkoutRequestId}`;
}

/**
 * Enforce replay protection for an STK callback. Throws
 * `DuplicateCallbackError` if the (MerchantRequestID, CheckoutRequestID)
 * tuple has already been processed within the retention window.
 */
export function assertStkCallbackNotReplayed(
  merchantRequestId: string,
  checkoutRequestId: string
): void {
  const key = replayKey(merchantRequestId, checkoutRequestId);
  const first = callbackReplayStore.remember(key);
  if (!first) {
    logger.warn(
      { merchantRequestId, checkoutRequestId, provider: 'mpesa' },
      'Duplicate M-Pesa STK callback rejected'
    );
    throw new DuplicateCallbackError(key);
  }
}

// --- Parsing ---------------------------------------------------------------

export function parseStkCallback(payload: unknown): StkCallbackResult {
  const body = payload as StkCallbackPayload;

  if (!body?.Body?.stkCallback) {
    throw new CallbackError('Invalid STK callback structure', 'mpesa');
  }

  const cb = body.Body.stkCallback;
  const checkoutRequestId = cb.CheckoutRequestID;
  const merchantRequestId = cb.MerchantRequestID;

  if (cb.ResultCode === 0 && cb.CallbackMetadata?.Item) {
    const items = cb.CallbackMetadata.Item;
    const mpesaReceipt = String(getMetadataItem(items, 'MpesaReceiptNumber') ?? '');
    const amount = Number(getMetadataItem(items, 'Amount') ?? 0);
    const phone = String(getMetadataItem(items, 'PhoneNumber') ?? '');
    const date = String(getMetadataItem(items, 'TransactionDate') ?? '');

    logger.info(
      {
        checkoutRequestId,
        merchantRequestId,
        mpesaReceipt,
        amount,
        msisdn: maskMsisdn(phone),
        provider: 'mpesa',
      },
      'M-Pesa STK callback: payment succeeded'
    );

    return {
      checkoutRequestId,
      merchantRequestId,
      status: 'SUCCEEDED',
      mpesaReceiptNumber: mpesaReceipt,
      amount,
      phoneNumber: phone,
      transactionDate: date,
    };
  }

  const status: PaymentStatus =
    cb.ResultCode === 1032 ? 'CANCELLED' : 'FAILED';

  logger.info(
    {
      checkoutRequestId,
      merchantRequestId,
      resultCode: cb.ResultCode,
      resultDesc: cb.ResultDesc,
      provider: 'mpesa',
    },
    `M-Pesa STK callback: ${status}`
  );

  return {
    checkoutRequestId,
    merchantRequestId,
    status,
  };
}

export function parseB2CCallback(payload: unknown): B2CCallbackResultParsed {
  const data = payload as B2CCallbackResult;

  if (!data?.Result) {
    throw new CallbackError('Invalid B2C callback structure', 'mpesa');
  }

  const result = data.Result;
  const conversationId = result.ConversationID;

  if (result.ResultCode === 0 && result.ResultParameters?.ResultParameter) {
    const params = result.ResultParameters.ResultParameter;
    const getParam = (key: string) =>
      params.find((p) => p.Key === key)?.Value;

    const recipientPhoneRaw = String(getParam('ReceiverParty') ?? '');

    logger.info(
      {
        conversationId,
        transactionId: result.TransactionID,
        msisdn: maskMsisdn(recipientPhoneRaw),
        provider: 'mpesa',
      },
      'M-Pesa B2C callback: transfer succeeded'
    );

    return {
      conversationId,
      transactionId: result.TransactionID,
      status: 'SUCCEEDED',
      amount: Number(getParam('TransactionAmount')),
      recipientPhone: recipientPhoneRaw,
    };
  }

  logger.warn(
    {
      conversationId,
      resultCode: result.ResultCode,
      resultDesc: result.ResultDesc,
      provider: 'mpesa',
    },
    'M-Pesa B2C callback: transfer failed'
  );

  return {
    conversationId,
    status: 'FAILED',
  };
}

// --- High-level handler ----------------------------------------------------

export interface HandleStkCallbackOptions {
  /** Raw, unparsed request body as received on the webhook endpoint. */
  rawBody: string;
  /** Value of the X-Mpesa-Signature (or equivalent) header. */
  signature: string | undefined | null;
  /** Override secret (mostly for tests). Defaults to env. */
  secret?: string;
}

/**
 * End-to-end helper: verify signature, guard against replay, parse payload.
 *
 * Throws `InvalidSignatureError` if the HMAC does not verify (caller should
 * respond with HTTP 401). Throws `DuplicateCallbackError` if the callback
 * has been seen already (caller should respond with HTTP 200 + "already
 * processed" because Daraja retries aggressively). Throws `CallbackError`
 * for malformed payloads.
 */
export function handleVerifiedStkCallback(
  opts: HandleStkCallbackOptions
): StkCallbackResult {
  if (!verifyMpesaCallbackSignature(opts.rawBody, opts.signature, opts.secret)) {
    logger.warn(
      { provider: 'mpesa' },
      'Rejected M-Pesa STK callback: signature verification failed'
    );
    throw new InvalidSignatureError();
  }

  let payload: unknown;
  try {
    payload = JSON.parse(opts.rawBody);
  } catch (err) {
    throw new CallbackError('Malformed JSON body on M-Pesa callback', 'mpesa', err);
  }

  const parsed = parseStkCallback(payload);
  assertStkCallbackNotReplayed(parsed.merchantRequestId, parsed.checkoutRequestId);
  return parsed;
}
