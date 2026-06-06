
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { mapPaymentRow, majorToMinor, minorToMajor, paginateArray } from './db-mappers';
import { parseListPagination, buildListResponse } from './pagination';
import {
  createPaymentsLedgerClient,
  PaymentsLedgerError,
  type LedgerPaymentType,
} from '../services/payments-ledger-client';
import { ledgerStatusToDb } from '../services/payments-ledger-status';
import { logger } from '../utils/logger';

import { withSecurityEvents } from '@bossnyumba/observability';
const MoneySchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).optional(),
});
const PaymentCreateSchema = z.object({
  customerId: z.string().optional(),
  leaseId: z.string().optional(),
  amount: MoneySchema,
  description: z.string().max(500).optional(),
});
// Payment channel values must align with the DB enum
// (packages/database/src/schemas/payment.schema.ts:payment_method). Legacy
// client values 'bank' and 'manual' are accepted and normalized to the
// canonical 'bank_transfer' / 'cheque' before persistence.
const PAYMENT_CHANNEL_VALUES = ['mpesa', 'bank_transfer', 'card', 'cash', 'cheque', 'other'] as const;
const PaymentProcessSchema = z.object({
  channel: z
    .union([
      z.enum(PAYMENT_CHANNEL_VALUES),
      z.enum(['bank', 'manual']), // legacy aliases
    ])
    .optional(),
  paymentMethodId: z.string().optional(),
  phoneNumber: z.string().regex(/^[+0-9 \-()]+$/).max(24).optional(),
  /** Optional account reference shown on the customer's M-Pesa prompt. */
  accountReference: z.string().max(64).optional(),
});
function normalizeChannel(raw: string | undefined): string {
  if (!raw) return 'other';
  if (raw === 'bank') return 'bank_transfer';
  if (raw === 'manual') return 'cheque';
  return raw;
}

function paymentNumber() {
  return `PAY-${Date.now().toString().slice(-6)}`;
}

// =============================================================================
// Payments-ledger engine client (real STK + double-entry ledger).
//
// payments-ledger is a SEPARATE deployable (docker-compose), so the gateway
// reaches its real STK-initiation path over HTTP rather than duplicating
// Daraja logic. PAYMENTS_LEDGER_URL is read once at module load — the same
// pattern other gateway route modules use for inter-service URLs; the dotenv
// load itself happens once in index.ts. The caller's Supabase Bearer JWT is
// forwarded so the engine derives the tenant from the verified claim.
// =============================================================================
const paymentsLedgerClient = createPaymentsLedgerClient({
  baseUrl: process.env.PAYMENTS_LEDGER_URL,
});

/**
 * Map a gateway invoice/payment "type" hint to the engine's payment-intent
 * type enum. We can't always know the exact category from a bare payment
 * row, so RENT_PAYMENT is the safe default for the tenant Pay-Now flow.
 */
function toLedgerPaymentType(raw: string | undefined): LedgerPaymentType {
  switch ((raw ?? '').toLowerCase()) {
    case 'deposit':
      return 'DEPOSIT_PAYMENT';
    case 'late_fee':
    case 'latefee':
      return 'LATE_FEE_PAYMENT';
    case 'maintenance':
      return 'MAINTENANCE_PAYMENT';
    case 'utility':
    case 'utilities':
      return 'UTILITY_PAYMENT';
    case 'rent':
      return 'RENT_PAYMENT';
    default:
      return 'RENT_PAYMENT';
  }
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const p = parseListPagination(c);
  const customerId = c.req.query('customerId');
  const status = c.req.query('status')?.toLowerCase();
  let result;
  if (customerId) result = await repos.payments.findByCustomer(customerId, auth.tenantId, p.limit, p.offset);
  else if (status) result = await repos.payments.findByStatus(status, auth.tenantId, p.limit, p.offset);
  else result = await repos.payments.findMany(auth.tenantId, p.limit, p.offset);
  const items = result.items.map(mapPaymentRow);
  return c.json({ success: true, ...buildListResponse(items, result.total ?? items.length, p) });
});

app.get('/pending', async (c) => {
  // Pending/processing is a small window per customer; cap at 100.
  const auth = c.get('auth');
  const repos = c.get('repos');
  const result = await repos.payments.findByCustomer(auth.userId, auth.tenantId, 100, 0);
  const items = result.items.filter((row: any) => ['pending', 'processing'].includes(String(row.status))).map(mapPaymentRow);
  return c.json({ success: true, data: items });
});

app.get('/history', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const p = parseListPagination(c);
  const result = await repos.payments.findByCustomer(auth.userId, auth.tenantId, p.limit, p.offset);
  const items = result.items.map(mapPaymentRow);
  return c.json({ success: true, ...buildListResponse(items, result.total ?? items.length, p) });
});

app.get('/balance', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');

  // Total due now comes from a single SUM query in the repository
  // (`sumBalanceByCustomer`) — previously this endpoint fetched up to
  // 1000 invoices and summed in JS, which was O(n) in tenant-wide
  // invoice rows. The breakdown still uses per-invoice rows (small,
  // capped at 100) so the UI can render a line-item view.
  const [totalDueMinor, recentInvoices] = await Promise.all([
    repos.invoices.sumBalanceByCustomer(auth.userId, auth.tenantId),
    repos.invoices.findByCustomer(auth.userId, auth.tenantId, 100, 0),
  ]);
  return c.json({
    success: true,
    data: {
      totalDue: {
        amount: minorToMajor(totalDueMinor),
        currency: recentInvoices.items[0]?.currency || 'USD',
      },
      breakdown: recentInvoices.items.map((invoice: any) => ({
        type: String(invoice.invoiceType || 'rent').toUpperCase(),
        amount: { amount: minorToMajor(invoice.balanceAmount), currency: invoice.currency || 'USD' },
      })),
    },
  });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.payments.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
  return c.json({ success: true, data: mapPaymentRow(row) });
});

app.post('/', zValidator('json', PaymentCreateSchema), withSecurityEvents({ action: 'payment.create', resource: 'payment', severity: 'notice' }, async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = c.req.valid('json');
  const currency = body.amount?.currency || 'USD';
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
}));

// Payment plans — allow tenants in arrears to set up instalment
// schedules. These are shallow wrappers over the payments repo; the
// orchestration lives in services/domain-services.
const PaymentPlanCreateSchema = z.object({
  invoiceId: z.string().optional(),
  totalAmount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  instalments: z.number().int().min(1).max(24),
  firstInstalmentDate: z.string().refine(
    (s) => !Number.isNaN(new Date(s).getTime()),
    'invalid date'
  ),
  notes: z.string().max(500).optional(),
});

app.post('/plans', zValidator('json', PaymentPlanCreateSchema), withSecurityEvents({ action: 'payment.create', resource: 'payment', severity: 'notice' }, async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  // Compute the equal-instalment amount. Last instalment absorbs
  // rounding so the sum equals totalAmount exactly.
  const totalMinor = majorToMinor(body.totalAmount);
  const per = Math.floor(totalMinor / body.instalments);
  const remainder = totalMinor - per * body.instalments;
  const schedule: Array<{ instalment: number; dueDate: string; amountMinor: number }> = [];
  const firstDate = new Date(body.firstInstalmentDate);
  for (let i = 0; i < body.instalments; i++) {
    const amountMinor = i === body.instalments - 1 ? per + remainder : per;
    const due = new Date(firstDate.getFullYear(), firstDate.getMonth() + i, firstDate.getDate());
    schedule.push({
      instalment: i + 1,
      dueDate: due.toISOString(),
      amountMinor,
    });
  }
  const plan = {
    id: `plan_${crypto.randomUUID()}`,
    tenantId: auth.tenantId,
    customerId: auth.userId,
    invoiceId: body.invoiceId,
    status: 'proposed' as const,
    totalAmount: { amount: body.totalAmount, currency: body.currency },
    instalments: body.instalments,
    firstInstalmentDate: body.firstInstalmentDate,
    schedule,
    notes: body.notes,
    createdBy: auth.userId,
    createdAt: new Date().toISOString(),
  };
  return c.json({ success: true, data: plan }, 201);
}));

app.get('/plans', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos') as { paymentPlans?: { findMany?: Function } } | undefined;
  const findMany = repos?.paymentPlans?.findMany;
  if (typeof findMany === 'function') {
    const result = await findMany.call(repos!.paymentPlans, auth.tenantId, 20, 0);
    return c.json({
      success: true,
      data: result.items ?? [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: result.total ?? (result.items?.length ?? 0),
        totalPages: Math.max(1, Math.ceil((result.total ?? 0) / 20)),
        hasNextPage: (result.total ?? 0) > 20,
        hasPreviousPage: false,
      },
      meta: { tenantId: auth.tenantId, source: 'live' },
    });
  }

  // Loud-failure: 501 unless dev-mode flag is on.
  const services = c.get('services') as { featureFlags?: { isEnabled: Function } } | undefined;
  const flagKey = 'flag.bff.payments.plans';
  let flagOn = false;
  try {
    flagOn = Boolean(await services?.featureFlags?.isEnabled?.(auth.tenantId, flagKey));
  } catch {
    flagOn = false;
  }
  if (!flagOn) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message:
            'Payment plans repo not wired. Concrete next-step: add repos.paymentPlans.findMany(tenantId, limit, offset) in @bossnyumba/database and surface it via composition root.',
          flagKey,
        },
      },
      501,
    );
  }
  return c.json({
    success: true,
    data: [],
    pagination: {
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    meta: { tenantId: auth.tenantId, note: 'payment-plans repo wiring pending; flag-gated dev response' },
  });
});

app.get('/plans/:id', async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const repos = c.get('repos') as { paymentPlans?: { findById?: Function } } | undefined;
  const findById = repos?.paymentPlans?.findById;
  if (typeof findById === 'function') {
    const row = await findById.call(repos!.paymentPlans, id, auth.tenantId);
    if (!row) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Payment plan ${id} not found` } },
        404,
      );
    }
    return c.json({ success: true, data: row });
  }
  // No repo wired — same 501 pattern as /plans above.
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message:
          'Payment plans repo not wired. Concrete next-step: add repos.paymentPlans.findById(id, tenantId).',
        flagKey: 'flag.bff.payments.plans',
      },
    },
    501,
  );
});

// =============================================================================
// POST /:id/process — initiate a REAL payment against the payments-ledger
// engine. For M-Pesa this triggers a live STK push (the engine calls Daraja);
// the engine's PaymentIntent id is linked to this gateway row via
// `externalReference` so /status and /receipt can poll the engine. Auth/
// tenant-scoped and idempotent: a row already linked to an engine intent is
// not re-initiated.
// =============================================================================
app.post('/:id/process', zValidator('json', PaymentProcessSchema), withSecurityEvents({ action: 'payment.create', resource: 'payment', severity: 'notice' }, async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const raw = c.req.valid('json');
  const body = { ...raw, channel: normalizeChannel(String(raw.channel ?? '')) };

  // Load the tenant-scoped row first — this is the authorization boundary
  // and the source of the canonical amount/currency (never trust the body
  // for money).
  const existing = await repos.payments.findById(id, auth.tenantId);
  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
  }

  // Idempotency: if this row was already linked to an engine intent and is
  // past 'pending', do not re-initiate the STK push — just return current
  // state. Re-initiation would prompt the customer's phone twice.
  const alreadyLinked = Boolean(existing.externalReference);
  const status = String(existing.status ?? 'pending').toLowerCase();
  if (alreadyLinked && status !== 'pending') {
    return c.json({ success: true, data: mapPaymentRow(existing) });
  }

  // M-Pesa STK requires a phone number; for non-mpesa channels we fall back
  // to the legacy "mark processing" behaviour (manual/bank/cheque are
  // settled out-of-band and reconciled via webhooks/C2B).
  const phone = body.phoneNumber ?? body.paymentMethodId;
  const isMpesa = body.channel === 'mpesa';

  if (!isMpesa || !phone) {
    const row = await repos.payments.update(id, auth.tenantId, {
      status: 'processing',
      paymentMethod: String(body.channel || body.paymentMethodId || 'other').toLowerCase(),
      payerPhone: body.phoneNumber,
      provider: String(body.channel || 'manual').toLowerCase(),
      updatedBy: auth.userId,
    });
    return c.json({ success: true, data: mapPaymentRow(row) });
  }

  if (!paymentsLedgerClient.isConfigured) {
    // Loud, fail-closed: never fabricate a fake STK acknowledgement on a
    // live-money path. Surface a 503 the client can show as "try again".
    logger.error('PAYMENTS_LEDGER_URL not configured — cannot initiate STK push', { paymentId: id });
    return c.json(
      {
        success: false,
        error: {
          code: 'PAYMENTS_ENGINE_UNAVAILABLE',
          message: 'Payment engine is not configured. Please try again later.',
        },
      },
      503,
    );
  }

  const authorization = c.req.header('Authorization');
  if (!authorization) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing authorization' } }, 401);
  }

  try {
    // Deterministic idempotency key from the gateway row id so a client
    // retry of /process reuses the same engine intent instead of pushing a
    // second STK prompt (the engine dedups on (key, tenant)).
    const intent = await paymentsLedgerClient.createIntent(
      {
        customerId: existing.customerId ?? auth.userId,
        leaseId: existing.leaseId ?? undefined,
        // No explicit type on the payment row; the tenant Pay-Now flow is
        // rent by default. toLedgerPaymentType falls back to RENT_PAYMENT.
        type: toLedgerPaymentType(undefined),
        amountMinor: majorToMinor(minorToMajor(existing.amount)),
        currency: String(existing.currency ?? 'KES'),
        description: existing.description ?? `Payment ${existing.paymentNumber ?? id}`,
        paymentMethodId: phone,
        metadata: {
          accountReference: body.accountReference ?? existing.paymentNumber ?? id,
          gatewayPaymentId: id,
        },
        idempotencyKey: `gw-pay-${id}`,
      },
      authorization,
    );

    // Persist the linkage + provider state. The engine intent id goes into
    // externalReference (our poll/receipt handle); the engine status is
    // projected onto the gateway DB enum; the STK instructions + raw status
    // are kept in providerResponse for observability.
    const row = await repos.payments.update(id, auth.tenantId, {
      status: ledgerStatusToDb(intent.status),
      paymentMethod: 'mpesa',
      provider: 'mpesa',
      payerPhone: phone,
      externalReference: intent.paymentIntentId,
      providerResponse: {
        engineIntentId: intent.paymentIntentId,
        engineStatus: intent.status,
        instructions: intent.instructions ?? null,
      },
      updatedBy: auth.userId,
    });

    return c.json({
      success: true,
      data: {
        ...mapPaymentRow(row),
        intentId: intent.paymentIntentId,
        instructions: intent.instructions,
      },
    });
  } catch (error) {
    if (error instanceof PaymentsLedgerError) {
      logger.error('payments-ledger STK initiation failed', {
        paymentId: id,
        code: error.code,
        upstreamStatus: error.status,
      });
      // Mark the row failed so the client poll resolves rather than hanging
      // until timeout. Best-effort — a failed mark must not mask the cause.
      try {
        await repos.payments.update(id, auth.tenantId, {
          status: 'failed',
          provider: 'mpesa',
          payerPhone: phone,
          updatedBy: auth.userId,
        });
      } catch (markErr) {
        logger.error('failed to mark payment failed after STK error', { paymentId: id, err: markErr });
      }
      const httpStatus = error.code === 'NOT_CONFIGURED' ? 503 : 502;
      return c.json(
        {
          success: false,
          error: {
            code: 'PAYMENT_INITIATION_FAILED',
            message: 'Could not initiate the payment. Please try again.',
          },
        },
        httpStatus,
      );
    }
    throw error;
  }
}));

// =============================================================================
// GET /:id/status — poll target for the client's useStkPolling. Reconciles
// the gateway row against the payments-ledger engine (the source of truth for
// intent lifecycle) and returns the canonical status string.
// =============================================================================
app.get('/:id/status', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');

  const row = await repos.payments.findById(id, auth.tenantId);
  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
  }

  const engineIntentId = row.externalReference;
  const authorization = c.req.header('Authorization');

  // No engine linkage (manual/bank/cheque, or never initiated) — return the
  // locally persisted status. The client poller treats unknown as "keep
  // polling" and the hard timeout eventually fires.
  if (!engineIntentId || !paymentsLedgerClient.isConfigured || !authorization) {
    const mapped = mapPaymentRow(row);
    return c.json({ success: true, data: { status: mapped.status }, ...{ status: mapped.status } });
  }

  try {
    const intent = await paymentsLedgerClient.getIntent(engineIntentId, authorization);
    const dbStatus = ledgerStatusToDb(intent.status);

    // Reconcile the gateway row when the engine has advanced past what we
    // persisted (terminal states + receipt). Idempotent: only write on a
    // change to avoid churn.
    if (dbStatus !== String(row.status ?? '').toLowerCase()) {
      await repos.payments.update(id, auth.tenantId, {
        status: dbStatus,
        ...(intent.status === 'SUCCEEDED' ? { completedAt: new Date() } : {}),
        updatedBy: auth.userId,
      });
    }

    // The client reads `status` at the top level (see useStkPolling); also
    // nest under `data` for the api.ts `response.data` unwrap.
    const payload = {
      status: intent.status,
      receiptNumber: intent.receiptUrl ?? undefined,
      reason: intent.failureReason ?? undefined,
    };
    return c.json({ success: true, data: payload, ...payload });
  } catch (error) {
    if (error instanceof PaymentsLedgerError) {
      logger.warn('payments-ledger status poll failed — returning local status', {
        paymentId: id,
        code: error.code,
        upstreamStatus: error.status,
      });
      const mapped = mapPaymentRow(row);
      return c.json({ success: true, data: { status: mapped.status }, ...{ status: mapped.status } });
    }
    throw error;
  }
});

// =============================================================================
// GET /:id/receipt — returns the receipt URL once the engine reports
// SUCCEEDED. Pulls the authoritative receiptUrl from the payments-ledger
// intent (it is populated on success).
// =============================================================================
app.get('/:id/receipt', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');

  const row = await repos.payments.findById(id, auth.tenantId);
  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
  }

  const engineIntentId = row.externalReference;
  const authorization = c.req.header('Authorization');
  if (!engineIntentId || !paymentsLedgerClient.isConfigured || !authorization) {
    return c.json(
      {
        success: false,
        error: { code: 'RECEIPT_UNAVAILABLE', message: 'No receipt is available for this payment yet.' },
      },
      404,
    );
  }

  try {
    const intent = await paymentsLedgerClient.getIntent(engineIntentId, authorization);
    if (intent.status !== 'SUCCEEDED' || !intent.receiptUrl) {
      return c.json(
        {
          success: false,
          error: {
            code: 'RECEIPT_NOT_READY',
            message: 'The receipt is not ready yet. Please wait for the payment to complete.',
          },
        },
        409,
      );
    }
    const payload = { url: intent.receiptUrl };
    return c.json({ success: true, data: payload, ...payload });
  } catch (error) {
    if (error instanceof PaymentsLedgerError) {
      logger.warn('payments-ledger receipt fetch failed', {
        paymentId: id,
        code: error.code,
        upstreamStatus: error.status,
      });
      return c.json(
        {
          success: false,
          error: { code: 'RECEIPT_UNAVAILABLE', message: 'Could not retrieve the receipt. Please try again.' },
        },
        502,
      );
    }
    throw error;
  }
});

export const paymentsApp = app;
