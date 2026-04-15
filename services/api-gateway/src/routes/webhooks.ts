// @ts-nocheck
/**
 * Webhook endpoints (unauthenticated, signature-verified).
 *
 * Currently hosts:
 *   POST /mpesa/callback - Safaricom STK Push callback
 *
 * Security: Safaricom does not sign its callbacks, so we enforce a shared
 * secret via either:
 *   - An HMAC-SHA256 signature over the raw body in `X-Mpesa-Signature`
 *     (format `sha256=<hex>`), or
 *   - A static `X-Mpesa-Token` header matching MPESA_CALLBACK_SECRET,
 *     verified with a constant-time compare.
 *
 * In development (when MPESA_CALLBACK_SECRET is unset) the check is
 * bypassed so local tests / sandbox work without ceremony. In production
 * a missing/invalid secret returns 401.
 */

import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'crypto';
import { databaseMiddleware, isUsingMockData } from '../middleware/database';
import { minorToMajor } from './db-mappers';

function verifyMpesaSignature(rawBody: string, headers: Headers): { ok: boolean; reason?: string } {
  const secret = process.env.MPESA_CALLBACK_SECRET;

  // In non-production deployments without a secret, accept the callback.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, reason: 'MPESA_CALLBACK_SECRET not configured' };
    }
    return { ok: true };
  }

  const signatureHeader = headers.get('x-mpesa-signature');
  if (signatureHeader) {
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    try {
      const a = Buffer.from(signatureHeader);
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true };
    } catch {
      // fall through
    }
    return { ok: false, reason: 'Invalid HMAC signature' };
  }

  const tokenHeader = headers.get('x-mpesa-token');
  if (tokenHeader) {
    try {
      const a = Buffer.from(tokenHeader);
      const b = Buffer.from(secret);
      if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true };
    } catch {
      // fall through
    }
    return { ok: false, reason: 'Invalid token' };
  }

  return { ok: false, reason: 'Missing X-Mpesa-Signature or X-Mpesa-Token header' };
}

interface StkCallbackItem {
  Name: string;
  Value: string | number;
}

interface StkCallbackPayload {
  Body?: {
    stkCallback?: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: { Item: StkCallbackItem[] };
    };
  };
}

function parseStkCallback(payload: StkCallbackPayload) {
  const stk = payload?.Body?.stkCallback;
  if (!stk) return null;
  const out: {
    merchantRequestId: string;
    checkoutRequestId: string;
    resultCode: number;
    resultDesc: string;
    success: boolean;
    amount?: number;
    mpesaReceiptNumber?: string;
    transactionDate?: Date;
    phoneNumber?: string;
  } = {
    merchantRequestId: stk.MerchantRequestID,
    checkoutRequestId: stk.CheckoutRequestID,
    resultCode: Number(stk.ResultCode),
    resultDesc: stk.ResultDesc,
    success: Number(stk.ResultCode) === 0,
  };
  for (const item of stk.CallbackMetadata?.Item ?? []) {
    switch (item.Name) {
      case 'Amount':
        out.amount = Number(item.Value);
        break;
      case 'MpesaReceiptNumber':
        out.mpesaReceiptNumber = String(item.Value);
        break;
      case 'TransactionDate': {
        const s = String(item.Value);
        out.transactionDate = new Date(
          Number(s.slice(0, 4)),
          Number(s.slice(4, 6)) - 1,
          Number(s.slice(6, 8)),
          Number(s.slice(8, 10)),
          Number(s.slice(10, 12)),
          Number(s.slice(12, 14))
        );
        break;
      }
      case 'PhoneNumber':
        out.phoneNumber = String(item.Value);
        break;
    }
  }
  return out;
}

/**
 * Best-effort receipt email queueing. The notifications service exposes a
 * BullMQ producer; if Redis/BullMQ is not available (local dev) we no-op
 * rather than failing the callback (Safaricom must see a 200).
 */
async function queueReceiptEmail(params: {
  customerId: string;
  paymentId: string;
  paymentNumber: string;
  receiptNumber: string;
  amount: number;
  currency: string;
  invoiceId?: string;
}): Promise<void> {
  try {
    // Lazy-import so a missing/broken notifications service does not crash
    // the gateway route resolution.
    const mod: any = await import('@bossnyumba/notifications-service/queue/producer').catch(
      () => null
    );
    if (!mod?.addToQueue) return;
    await mod.addToQueue({
      recipient: { type: 'customer', id: params.customerId },
      channel: 'email',
      templateId: 'payment-receipt',
      data: {
        paymentId: params.paymentId,
        paymentNumber: params.paymentNumber,
        receiptNumber: params.receiptNumber,
        amount: String(params.amount),
        currency: params.currency,
        invoiceId: params.invoiceId ?? '',
      },
    });
  } catch {
    // swallow: callback must remain idempotent and 200
  }
}

/** In-memory dedupe of processed callbacks for the life of the process. */
const processedCallbacks = new Set<string>();

const app = new Hono();

// We deliberately skip `databaseMiddleware` here: it returns 503 when the
// database is unavailable (e.g. mock-mode), but Safaricom expects a 200
// on every callback attempt or it will retry indefinitely. Instead we
// call `databaseMiddleware` only when a real DB is present.
app.use('*', async (c, next) => {
  if (!isUsingMockData()) {
    return databaseMiddleware(c, next);
  }
  return next();
});

/**
 * M-Pesa STK Push callback.
 * Always responds 200 with `{ ResultCode: 0, ResultDesc: 'Success' }` on
 * signature-verified payloads (even on user failure/cancel) so Safaricom
 * does not retry. Signature failures return 401.
 */
app.post('/mpesa/callback', async (c) => {
  const rawBody = await c.req.text();

  const sig = verifyMpesaSignature(rawBody, c.req.raw.headers);
  if (!sig.ok) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: sig.reason ?? 'Unauthorized' } },
      401
    );
  }

  let body: StkCallbackPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ success: false, error: { code: 'INVALID_JSON', message: 'Malformed JSON' } }, 400);
  }

  const parsed = parseStkCallback(body);
  if (!parsed) {
    return c.json(
      { success: false, error: { code: 'INVALID_CALLBACK', message: 'Missing stkCallback' } },
      400
    );
  }

  // Dedupe
  const dedupeKey = `stk:${parsed.checkoutRequestId}`;
  if (processedCallbacks.has(dedupeKey)) {
    return c.json({ ResultCode: 0, ResultDesc: 'Already processed' });
  }
  processedCallbacks.add(dedupeKey);

  const repos = c.get('repos');

  if (!repos) {
    // Still ack to Safaricom.
    return c.json({ ResultCode: 0, ResultDesc: 'Accepted (no repositories)' });
  }

  const match = await repos.payments
    .findByProviderTransactionId('mpesa', parsed.checkoutRequestId)
    .catch(() => null);

  if (!match) {
    return c.json({ ResultCode: 0, ResultDesc: 'No matching payment (acknowledged)' });
  }

  const tenantId = match.tenantId;

  if (parsed.success) {
    await repos.payments.update(match.id, tenantId, {
      status: 'completed',
      completedAt: parsed.transactionDate ?? new Date(),
      receiptNumber: parsed.mpesaReceiptNumber,
      providerResponse: body as any,
      updatedBy: 'mpesa-callback',
    });

    // Invoice matcher: apply payment to invoice balance.
    if (match.invoiceId) {
      const invoice = await repos.invoices.findById(match.invoiceId, tenantId);
      if (invoice) {
        const paidBefore = Number(invoice.paidAmount || 0);
        const total = Number(invoice.totalAmount || 0);
        const applied = Number(match.amount || 0);
        const newPaid = paidBefore + applied;
        const newBalance = Math.max(total - newPaid, 0);
        const newStatus =
          newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : invoice.status;
        await repos.invoices.update(match.invoiceId, tenantId, {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          status: newStatus,
          updatedBy: 'mpesa-callback',
        });
      }
    }

    await queueReceiptEmail({
      customerId: match.customerId,
      paymentId: match.id,
      paymentNumber: match.paymentNumber,
      receiptNumber: parsed.mpesaReceiptNumber ?? '',
      amount: minorToMajor(match.amount),
      currency: match.currency,
      invoiceId: match.invoiceId ?? undefined,
    });
  } else {
    await repos.payments.update(match.id, tenantId, {
      status: parsed.resultCode === 1032 ? 'cancelled' : 'failed',
      failedAt: new Date(),
      failureReason: parsed.resultDesc,
      providerResponse: body as any,
      updatedBy: 'mpesa-callback',
    });
  }

  return c.json({ ResultCode: 0, ResultDesc: 'Success' });
});

export const webhooksApp = app;
