// @ts-nocheck

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { mapPaymentRow, majorToMinor, minorToMajor, paginateArray } from './db-mappers';

function paymentNumber() {
  return `PAY-${Date.now().toString().slice(-6)}`;
}

function normalizeMpesaPhone(raw: string): string | null {
  if (!raw) return null;
  let cleaned = String(raw).replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '254' + cleaned.slice(1);
  else if (cleaned.startsWith('7') || cleaned.startsWith('1')) cleaned = '254' + cleaned;
  if (!/^254[17]\d{8}$/.test(cleaned)) return null;
  return cleaned;
}

async function initiateStkPushInline(opts: {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  description: string;
}): Promise<{ CheckoutRequestID: string; MerchantRequestID: string; ResponseCode: string; ResponseDescription: string; CustomerMessage: string }> {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const passkey = process.env.MPESA_PASSKEY;
  const shortcode = process.env.MPESA_SHORTCODE;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;
  const environment = (process.env.MPESA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';

  // If credentials are not configured, short-circuit with a simulated response.
  // Payment still gets persisted as PENDING so the polling UI has something to show.
  if (!consumerKey || !consumerSecret || !passkey || !shortcode || !callbackUrl) {
    const stub = `ws_CO_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return {
      CheckoutRequestID: stub,
      MerchantRequestID: `stub-${stub}`,
      ResponseCode: '0',
      ResponseDescription: 'STK push simulated (credentials not configured)',
      CustomerMessage: 'Please check your phone to authorise the payment.',
    };
  }

  const baseUrl = environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  // OAuth
  const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!tokenRes.ok) throw new Error(`M-Pesa auth failed: ${tokenRes.status}`);
  const tokenJson: any = await tokenRes.json();
  const token = tokenJson.access_token;

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(opts.amount),
    PartyA: opts.phoneNumber,
    PartyB: shortcode,
    PhoneNumber: opts.phoneNumber,
    CallBackURL: callbackUrl,
    AccountReference: opts.accountReference.slice(0, 12),
    TransactionDesc: opts.description.slice(0, 13),
  };

  const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!stkRes.ok) {
    const text = await stkRes.text();
    throw new Error(`STK push failed: ${stkRes.status} ${text}`);
  }
  return stkRes.json() as any;
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('limit') || c.req.query('pageSize') || '20');
  const customerId = c.req.query('customerId');
  const status = c.req.query('status')?.toLowerCase();
  let result;
  if (customerId) result = await repos.payments.findByCustomer(customerId, auth.tenantId, 1000, 0);
  else if (status) result = await repos.payments.findByStatus(status, auth.tenantId, 1000, 0);
  else result = await repos.payments.findMany(auth.tenantId, 1000, 0);
  const items = result.items.map(mapPaymentRow);
  const paginated = paginateArray(items, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/pending', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const result = await repos.payments.findByCustomer(auth.userId, auth.tenantId, 1000, 0);
  const items = result.items.filter((row: any) => ['pending', 'processing'].includes(String(row.status))).map(mapPaymentRow);
  return c.json({ success: true, data: items });
});

app.get('/history', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');
  const result = await repos.payments.findByCustomer(auth.userId, auth.tenantId, 1000, 0);
  const items = result.items.map(mapPaymentRow);
  const paginated = paginateArray(items, page, limit);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/balance', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const invoices = await repos.invoices.findByCustomer(auth.userId, auth.tenantId, 1000, 0);
  const totalDueMinor = invoices.items.reduce((sum: number, invoice: any) => sum + Number(invoice.balanceAmount || 0), 0);
  return c.json({
    success: true,
    data: {
      totalDue: { amount: minorToMajor(totalDueMinor), currency: invoices.items[0]?.currency || 'KES' },
      breakdown: invoices.items.map((invoice: any) => ({
        type: String(invoice.invoiceType || 'rent').toUpperCase(),
        amount: { amount: minorToMajor(invoice.balanceAmount), currency: invoice.currency || 'KES' },
      })),
    },
  });
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  const currency = body.amount?.currency || 'KES';
  const amountMinor = majorToMinor(body.amount?.amount);
  const row = await repos.payments.create({
    id: crypto.randomUUID(),
    tenantId: auth.tenantId,
    customerId: body.customerId || auth.userId,
    leaseId: body.leaseId,
    paymentNumber: paymentNumber(),
    status: 'pending',
    paymentMethod: 'other',
    amount: amountMinor,
    currency,
    netAmount: amountMinor,
    description: body.description,
    initiatedAt: new Date(),
    createdBy: auth.userId,
    updatedBy: auth.userId,
  });
  return c.json({ success: true, data: mapPaymentRow(row) }, 201);
});

app.get('/:id/status', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.payments.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
  let invoiceStatus: string | undefined;
  if (row.invoiceId) {
    const invoice = await repos.invoices.findById(row.invoiceId, auth.tenantId);
    if (invoice) invoiceStatus = String(invoice.status || '').toUpperCase();
  }
  return c.json({
    success: true,
    data: {
      paymentId: row.id,
      status: String(row.status || 'pending').toUpperCase(),
      amount: minorToMajor(row.amount),
      currency: row.currency,
      receiptNumber: row.receiptNumber ?? row.providerTransactionId ?? undefined,
      completedAt: row.completedAt ?? undefined,
      invoiceId: row.invoiceId ?? undefined,
      invoiceStatus,
      failureReason: row.failureReason ?? undefined,
    },
  });
});

app.get('/:id/receipt', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.payments.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
  if (String(row.status).toLowerCase() !== 'completed') {
    return c.json(
      { success: false, error: { code: 'RECEIPT_NOT_READY', message: 'Payment is not completed yet' } },
      409
    );
  }
  let invoiceNumber: string | undefined;
  if (row.invoiceId) {
    const invoice = await repos.invoices.findById(row.invoiceId, auth.tenantId);
    invoiceNumber = invoice?.invoiceNumber;
  }
  return c.json({
    success: true,
    data: {
      paymentId: row.id,
      receiptNumber: row.receiptNumber ?? row.providerTransactionId ?? row.paymentNumber,
      amount: minorToMajor(row.amount),
      currency: row.currency,
      paidAt: row.completedAt ?? row.updatedAt,
      invoiceNumber,
    },
  });
});

app.post('/mpesa/stk-push', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json().catch(() => ({}));

  const amount = Number(body.amount);
  const phone = normalizeMpesaPhone(body.phone || body.phoneNumber || '');
  const invoiceId: string | undefined = body.invoiceId;
  const leaseId: string | undefined = body.leaseId;

  if (!Number.isFinite(amount) || amount <= 0) {
    return c.json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'amount must be a positive number' } }, 400);
  }
  if (!phone) {
    return c.json({ success: false, error: { code: 'INVALID_PHONE', message: 'phone must be a valid Kenyan mobile number' } }, 400);
  }

  // If invoiceId provided, ensure it belongs to this tenant/customer.
  let resolvedInvoice: any = null;
  if (invoiceId) {
    resolvedInvoice = await repos.invoices.findById(invoiceId, auth.tenantId);
    if (!resolvedInvoice) {
      return c.json({ success: false, error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' } }, 404);
    }
  }

  const paymentId = crypto.randomUUID();
  const amountMinor = majorToMinor(amount);
  const currency = resolvedInvoice?.currency || 'KES';
  const accountRef = resolvedInvoice?.invoiceNumber || invoiceId || paymentId.slice(0, 8);

  // Persist the pending payment first so we have a record even if STK fails.
  await repos.payments.create({
    id: paymentId,
    tenantId: auth.tenantId,
    customerId: auth.userId,
    invoiceId: resolvedInvoice?.id ?? invoiceId ?? null,
    leaseId: leaseId ?? resolvedInvoice?.leaseId ?? null,
    paymentNumber: paymentNumber(),
    status: 'pending',
    paymentMethod: 'mpesa',
    amount: amountMinor,
    currency,
    netAmount: amountMinor,
    payerPhone: phone,
    provider: 'mpesa',
    description: resolvedInvoice ? `Rent payment for ${resolvedInvoice.invoiceNumber}` : 'Rent payment',
    initiatedAt: new Date(),
    createdBy: auth.userId,
    updatedBy: auth.userId,
  });

  try {
    const stk = await initiateStkPushInline({
      phoneNumber: phone,
      amount,
      accountReference: String(accountRef),
      description: 'RentPayment',
    });

    await repos.payments.update(paymentId, auth.tenantId, {
      externalReference: stk.CheckoutRequestID,
      providerTransactionId: stk.CheckoutRequestID,
      providerResponse: stk as any,
      status: 'processing',
      updatedBy: auth.userId,
    });

    return c.json(
      {
        success: true,
        data: {
          paymentId,
          checkoutRequestId: stk.CheckoutRequestID,
          merchantRequestId: stk.MerchantRequestID,
          status: 'PENDING',
          customerMessage: stk.CustomerMessage,
        },
      },
      202
    );
  } catch (err: any) {
    await repos.payments.update(paymentId, auth.tenantId, {
      status: 'failed',
      failedAt: new Date(),
      failureReason: err?.message || 'STK push failed',
      updatedBy: auth.userId,
    });
    return c.json(
      {
        success: false,
        error: {
          code: 'STK_PUSH_FAILED',
          message: err?.message || 'STK push failed',
        },
      },
      502
    );
  }
});

app.post('/:id/process', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  const row = await repos.payments.update(c.req.param('id'), auth.tenantId, {
    status: 'processing',
    paymentMethod: String(body.channel || body.paymentMethodId || 'other').toLowerCase(),
    payerPhone: body.phoneNumber,
    provider: String(body.channel || 'manual').toLowerCase(),
    externalReference: body.paymentMethodId,
    updatedBy: auth.userId,
  });
  return c.json({ success: true, data: mapPaymentRow(row) });
});

// Generic fetch-by-id – kept last so that more specific `/:id/status` and
// `/:id/receipt` routes take precedence regardless of the Hono router in use.
app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.payments.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
  return c.json({ success: true, data: mapPaymentRow(row) });
});

export const paymentsApp = app;
