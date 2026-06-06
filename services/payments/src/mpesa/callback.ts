import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';

/**
 * Convert a decimal-string money amount (e.g. "5000.00") into integer
 * minor units (cents) so the ledger never holds a float.
 *
 * Bug fix A-BUG-DEEP #5: replaces `parseFloat(...)` to avoid IEEE-754
 * drift accumulating across high-volume reconciliation.
 */
function toIntegerMinor(value: string | number | undefined | null): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export interface StkCallbackMetadataItem {
  Name: string;
  Value: string | number;
}

export interface StkCallbackBody {
  stkCallback: {
    MerchantRequestID: string;
    CheckoutRequestID: string;
    ResultCode: number;
    ResultDesc: string;
    CallbackMetadata?: {
      Item: StkCallbackMetadataItem[];
    };
  };
}

export interface ParsedStkCallback {
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  success: boolean;
  amount?: number;
  mpesaReceiptNumber?: string;
  transactionDate?: Date;
  phoneNumber?: string;
}

export interface C2BConfirmation {
  TransactionType: string;
  TransID: string;
  TransTime: string;
  TransAmount: string;
  BusinessShortCode: string;
  BillRefNumber: string;
  InvoiceNumber: string;
  OrgAccountBalance: string;
  ThirdPartyTransID: string;
  MSISDN: string;
  FirstName: string;
  MiddleName: string;
  LastName: string;
}

export interface ParsedC2BPayment {
  transactionId: string;
  transactionType: string;
  transactionTime: Date;
  /**
   * Payment amount in integer minor units (e.g. KES cents).
   * Bug fix A-BUG-DEEP #5: previously `parseFloat(TransAmount)` returned a
   * potentially-lossy decimal (5000.01 → 5000.009999... in some cases).
   * Now stored as `Math.round(amountMajor * 100)` so all downstream
   * ledger math stays in integer space.
   */
  amountMinor: number;
  shortcode: string;
  accountReference: string;
  invoiceNumber: string;
  /** Org balance in integer minor units (same convention as `amountMinor`). */
  orgBalanceMinor: number;
  phoneNumber: string;
  customerName: string;
}

export type PaymentEventType = 'stk:success' | 'stk:failed' | 'stk:cancelled' | 'c2b:received';

/**
 * Durable idempotency store the handler can be given so dedup survives
 * restarts and is shared across replicas (M3). Mirrors the connectors
 * `IdempotencyStore` contract (`seenRecently` = record-and-check) and
 * adds an optional `release` so a FAILED handler can free the key for a
 * retry (M8). When omitted, the handler falls back to a TTL-bounded
 * in-process map (single-process only).
 */
export interface CallbackIdempotencyStore {
  /** Atomic record-and-check. Returns true if already seen (duplicate). */
  seenRecently(key: string): Promise<boolean>;
  /** Optional: free a previously-recorded key after a failed handler. */
  release?(key: string): Promise<void>;
}

export interface MpesaCallbackHandlerOptions {
  idempotencyStore?: CallbackIdempotencyStore;
  /** TTL for the in-process fallback dedup map. Defaults to 24h. */
  ttlMs?: number;
}

/**
 * Sentinel token returned by `claimKey` when an injected (connectors)
 * idempotency store is in use. That store is record-and-check and owns its
 * own claim identity, so its `release(key)` takes no token; the in-process
 * compare-and-delete path is bypassed for it. Kept distinct so the value
 * is meaningful in logs/debugging.
 */
const INJECTED_STORE_TOKEN = '__injected_store__';

export class MpesaCallbackHandler extends EventEmitter {
  // In-process fallback dedup: key -> { token, expiry epoch ms }. NOT a
  // Set we wipe wholesale — entries expire individually so a periodic
  // sweep cannot open a double-credit window for still-valid keys. The
  // per-claim `token` enables compare-and-delete on release (MUST-FIX 2).
  private processedCallbacks: Map<string, { token: string; expiry: number }> =
    new Map();
  private readonly callbackTTL: number;
  private readonly idempotencyStore?: CallbackIdempotencyStore;

  constructor(options: MpesaCallbackHandlerOptions = {}) {
    super();
    this.callbackTTL = options.ttlMs ?? 24 * 60 * 60 * 1000; // 24 hours
    this.idempotencyStore = options.idempotencyStore;
    // Periodically reap EXPIRED entries only (never a blanket clear).
    setInterval(() => this.cleanupProcessedCallbacks(), 60 * 60 * 1000).unref?.();
  }

  /**
   * Reserve a dedup key. Returns a release TOKEN when newly reserved
   * (caller MUST process and keep the token) or `null` if already seen
   * (duplicate, skip). Uses the injected durable store when present (which
   * is record-and-check, so it has no token — we return a sentinel token
   * the in-process release path ignores), else the in-process map.
   */
  private async claimKey(key: string): Promise<string | null> {
    if (this.idempotencyStore) {
      const seen = await this.idempotencyStore.seenRecently(key);
      // The injected store owns its own dedup; the token is unused for it.
      return seen ? null : INJECTED_STORE_TOKEN;
    }
    const now = Date.now();
    const existing = this.processedCallbacks.get(key);
    if (existing && existing.expiry > now) return null;
    const token = randomUUID();
    this.processedCallbacks.set(key, { token, expiry: now + this.callbackTTL });
    return token;
  }

  /**
   * Release a previously-claimed key so a retry can reprocess after a
   * handler failure (M8). COMPARE-AND-DELETE on the in-process path: only
   * removes the entry when the stored token matches `token`, so a stale
   * releaser (whose claim TTL-expired and was re-won by another delivery)
   * cannot drop the newer claim (MUST-FIX 2).
   */
  private async releaseKey(key: string, token: string): Promise<void> {
    if (this.idempotencyStore) {
      // The injected connectors store is record-and-check; its release
      // takes only the key (it owns its own claim identity).
      await this.idempotencyStore.release?.(key);
      return;
    }
    const existing = this.processedCallbacks.get(key);
    if (existing && existing.token === token) {
      this.processedCallbacks.delete(key);
    }
  }

  /**
   * Parse STK Push callback
   */
  parseStkCallback(body: StkCallbackBody): ParsedStkCallback {
    const { stkCallback } = body;

    const result: ParsedStkCallback = {
      merchantRequestId: stkCallback.MerchantRequestID,
      checkoutRequestId: stkCallback.CheckoutRequestID,
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc,
      success: stkCallback.ResultCode === 0,
    };

    // Extract metadata if present (only on success)
    if (stkCallback.CallbackMetadata?.Item) {
      for (const item of stkCallback.CallbackMetadata.Item) {
        switch (item.Name) {
          case 'Amount':
            result.amount = Number(item.Value);
            break;
          case 'MpesaReceiptNumber':
            result.mpesaReceiptNumber = String(item.Value);
            break;
          case 'TransactionDate':
            result.transactionDate = this.parseTransactionDate(String(item.Value));
            break;
          case 'PhoneNumber':
            result.phoneNumber = String(item.Value);
            break;
        }
      }
    }

    return result;
  }

  /**
   * Parse C2B confirmation callback
   *
   * Bug fix A-BUG-DEEP #5: `TransAmount` is now converted to integer
   * minor units (cents) via `Math.round(Number(x) * 100)` so the rest of
   * the ledger pipeline never sees a float.
   */
  parseC2BConfirmation(body: C2BConfirmation): ParsedC2BPayment {
    return {
      transactionId: body.TransID,
      transactionType: body.TransactionType,
      transactionTime: this.parseTransactionDate(body.TransTime),
      amountMinor: toIntegerMinor(body.TransAmount),
      shortcode: body.BusinessShortCode,
      accountReference: body.BillRefNumber,
      invoiceNumber: body.InvoiceNumber,
      orgBalanceMinor: toIntegerMinor(body.OrgAccountBalance),
      phoneNumber: body.MSISDN,
      customerName: [body.FirstName, body.MiddleName, body.LastName].filter(Boolean).join(' '),
    };
  }

  /**
   * Parse M-Pesa transaction date format (YYYYMMDDHHmmss).
   *
   * Bug fix A-BUG-DEEP #4: the prior implementation used the
   * `new Date(y, m, d, h, m, s)` constructor which interprets the args
   * in the *runtime's local timezone*. M-Pesa always emits times in
   * East-Africa-Time (UTC+3, no DST), so on a UTC server every callback
   * was being recorded 3 hours late. Build the UTC instant explicitly,
   * then subtract the +3h EAT offset to land on the real wall clock.
   */
  private parseTransactionDate(dateStr: string): Date {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10);
    const day = parseInt(dateStr.slice(6, 8), 10);
    const hour = parseInt(dateStr.slice(8, 10), 10);
    const minute = parseInt(dateStr.slice(10, 12), 10);
    const second = parseInt(dateStr.slice(12, 14), 10);

    // Build the timestamp as if the parsed parts were in UTC, then
    // shift back by the EAT offset (+3h) to get the true UTC instant.
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
    return new Date(utcMs - 3 * 3600 * 1000);
  }

  /**
   * Handle STK Push callback - main entry point for STK callbacks
   */
  async handleStkCallback(
    body: StkCallbackBody,
    onSuccess?: (data: ParsedStkCallback) => Promise<void>,
    onFailure?: (data: ParsedStkCallback) => Promise<void>
  ): Promise<{ success: boolean; message: string }> {
    const parsed = this.parseStkCallback(body);

    // Dedup key: prefer the M-Pesa receipt number for a successful
    // payment (the authoritative settlement id); fall back to the
    // CheckoutRequestID on failure (no receipt is issued).
    const dedupId =
      parsed.success && parsed.mpesaReceiptNumber
        ? parsed.mpesaReceiptNumber
        : parsed.checkoutRequestId;
    const callbackKey = `stk:${dedupId}`;
    const claimToken = await this.claimKey(callbackKey);
    if (!claimToken) {
      return { success: true, message: 'Callback already processed' };
    }

    try {
      if (parsed.success) {
        this.emit('stk:success', parsed);
        if (onSuccess) {
          await onSuccess(parsed);
        }
        return { success: true, message: 'Payment processed successfully' };
      } else {
        // Determine failure type
        const eventType = parsed.resultCode === 1032 ? 'stk:cancelled' : 'stk:failed';
        this.emit(eventType, parsed);
        if (onFailure) {
          await onFailure(parsed);
        }
        return { success: false, message: parsed.resultDesc };
      }
    } catch (error) {
      // Release the claim so a provider retry reprocesses (M8). Compare-
      // and-delete on our claim token so we only drop OUR claim (MUST-FIX 2).
      await this.releaseKey(callbackKey, claimToken);
      throw error;
    }
  }

  /**
   * Handle C2B confirmation callback
   */
  async handleC2BConfirmation(
    body: C2BConfirmation,
    onReceived?: (data: ParsedC2BPayment) => Promise<void>
  ): Promise<{ success: boolean; message: string }> {
    const parsed = this.parseC2BConfirmation(body);

    // Check for duplicate (TransID is M-Pesa's authoritative receipt for C2B).
    const callbackKey = `c2b:${parsed.transactionId}`;
    const claimToken = await this.claimKey(callbackKey);
    if (!claimToken) {
      return { success: true, message: 'Confirmation already processed' };
    }

    try {
      this.emit('c2b:received', parsed);
      if (onReceived) {
        await onReceived(parsed);
      }
      return { success: true, message: 'Confirmation received' };
    } catch (error) {
      // Release the claim so a provider retry reprocesses (M8). Compare-
      // and-delete on our claim token so we only drop OUR claim (MUST-FIX 2).
      await this.releaseKey(callbackKey, claimToken);
      throw error;
    }
  }

  /**
   * Generate validation response for C2B
   */
  generateValidationResponse(accept: boolean, reason?: string): object {
    return {
      ResultCode: accept ? 0 : 1,
      ResultDesc: accept ? 'Accepted' : reason || 'Rejected',
    };
  }

  /**
   * Generate acknowledgment response for callbacks
   */
  generateAckResponse(): object {
    return {
      ResultCode: 0,
      ResultDesc: 'Success',
    };
  }

  /**
   * Reap ONLY expired in-process dedup entries.
   *
   * The previous implementation `.clear()`ed the entire set every 24h —
   * which deleted still-valid keys and re-opened the double-credit window
   * for callbacks Safaricom was still retrying (M3). We now expire each
   * key individually by its recorded TTL. No-op when a durable store is
   * injected (it owns its own expiry).
   */
  private cleanupProcessedCallbacks(): void {
    if (this.idempotencyStore) return;
    const now = Date.now();
    for (const [key, entry] of this.processedCallbacks.entries()) {
      if (entry.expiry <= now) this.processedCallbacks.delete(key);
    }
  }

  /** Test hook: run the periodic cleanup synchronously. */
  runCleanupForTest(): void {
    this.cleanupProcessedCallbacks();
  }

  /**
   * Test hook: read the in-process claim token currently stored for a key
   * (regardless of expiry), or undefined if absent. Used to assert the
   * compare-and-delete behaviour on release (MUST-FIX 2).
   */
  peekClaimTokenForTest(key: string): string | undefined {
    return this.processedCallbacks.get(key)?.token;
  }

  /**
   * Check if a callback was already processed (in-process fallback only;
   * the durable store is authoritative when injected).
   */
  isProcessed(type: 'stk' | 'c2b', id: string): boolean {
    const entry = this.processedCallbacks.get(`${type}:${id}`);
    return entry !== undefined && entry.expiry > Date.now();
  }

  /**
   * Get error message for result code
   */
  getErrorMessage(resultCode: number): string {
    const errorMessages: Record<number, string> = {
      0: 'Success',
      1: 'Insufficient balance',
      1032: 'Request cancelled by user',
      1037: 'Timeout waiting for user input',
      2001: 'Wrong PIN entered',
      17: 'System busy, please try again',
    };

    return errorMessages[resultCode] || `Transaction failed with code ${resultCode}`;
  }
}

export const mpesaCallbackHandler = new MpesaCallbackHandler();
