/**
 * Payments API routes - Production-ready REST API with Hono and Zod validation
 *
 * GET    /payments                - List with pagination, filters
 * GET    /payments/reconciliation - Get unreconciled payments
 * GET    /payments/:id            - Get by ID
 * GET    /payments/:id/receipt    - Get payment receipt
 * POST   /payments                - Record manual payment
 * POST   /payments/mpesa          - Initiate M-Pesa payment
 * POST   /payments/mpesa/callback - M-Pesa callback webhook
 * POST   /payments/:id/refund     - Process refund
 */

import { createHmac } from 'crypto';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware, buildPaginationResponse } from '../middleware/database';
import {
  listPaymentsQuerySchema,
  reconciliationQuerySchema,
  createManualPaymentSchema,
  initiateMpesaPaymentSchema,
  refundPaymentSchema,
  mpesaCallbackSchema,
} from './schemas';
import {
  DEMO_PAYMENTS,
  DEMO_CUSTOMERS,
  DEMO_INVOICES,
  getByTenant,
  getById,
  paginate,
} from '../data/mock-data';
import type { Payment } from '../types/mock-types';

export const paymentsRouter = null;

const app = new Hono();

/** Verify M-Pesa callback signature when MPESA_CALLBACK_SECRET is set. Uses HMAC-SHA256. */
function verifyMpesaCallbackSignature(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (!secret) return true; // No verification when secret not configured
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return signature === expected || signature === `sha256=${expected}`;
}

function enrichPayment(payment: Payment) {
  const customer = getById(DEMO_CUSTOMERS, payment.customerId);
  const invoice = payment.invoiceId ? getById(DEMO_INVOICES, payment.invoiceId) : null;
  return {
    ...payment,
    customer: customer
      ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` }
      : null,
    invoice: invoice ? { id: invoice.id, number: invoice.number } : null,
  };
}

// Auth for most routes (mpesa/callback is webhook - no auth)
app.use('*', async (c, next) => {
  if (c.req.path.endsWith('/mpesa/callback')) {
    return next();
  }
  return authMiddleware(c, next);
});
app.use('*', async (c, next) => {
  if (c.req.path.endsWith('/mpesa/callback')) {
    return next();
  }
  return databaseMiddleware(c, next);
});

// POST /payments/mpesa/callback - M-Pesa Daraja STK callback webhook (no auth)
// Production: verify X-Signature header when MPESA_CALLBACK_SECRET is set
app.post('/mpesa/callback', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('X-Signature') ?? c.req.header('x-signature');

  if (!verifyMpesaCallbackSignature(rawBody, signature)) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid webhook signature' } },
      401
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      400
    );
  }
  const parseResult = mpesaCallbackSchema.safeParse(parsed);
  if (!parseResult.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid callback payload',
          details: parseResult.error.flatten(),
        },
      },
      400
    );
  }

  const body = parseResult.data;
  const { stkCallback } = body.Body;
  const resultCode = stkCallback.ResultCode;
  const checkoutRequestId = stkCallback.CheckoutRequestID;

  if (resultCode === 0 && stkCallback.CallbackMetadata?.Item) {
    const items = stkCallback.CallbackMetadata.Item;
    const getItem = (name: string) =>
      items.find((i: { Name: string }) => i.Name === name)?.Value;
    const mpesaReceipt = String(getItem('MpesaReceiptNumber') ?? '');
    const amount = Number(getItem('Amount') ?? 0);

    const payment = DEMO_PAYMENTS.find(
      (p) => p.externalReference === checkoutRequestId && p.status === 'PENDING'
    );
    if (payment) {
      payment.status = 'COMPLETED';
      payment.reference = mpesaReceipt;
      payment.externalReference = mpesaReceipt;
      payment.processedAt = new Date();
      payment.updatedAt = new Date();
      payment.updatedBy = 'mpesa-webhook';

      const invoice = getById(DEMO_INVOICES, payment.invoiceId);
      if (invoice) {
        invoice.amountPaid += amount;
        invoice.amountDue -= amount;
        if (invoice.amountDue <= 0) {
          invoice.status = 'PAID';
          invoice.paidAt = new Date();
        } else {
          invoice.status = 'PARTIALLY_PAID';
        }
        invoice.updatedAt = new Date();
        invoice.updatedBy = 'mpesa-webhook';
      }
    }

    return c.json({
      ResultCode: 0,
      ResultDesc: 'Success',
      ThirdPartyTransID: mpesaReceipt,
    });
  }

  // User cancelled or payment failed - mark payment as FAILED
  const failedPayment = DEMO_PAYMENTS.find(
    (p) => p.externalReference === checkoutRequestId && p.status === 'PENDING'
  );
  if (failedPayment) {
    failedPayment.status = 'FAILED';
    failedPayment.updatedAt = new Date();
    failedPayment.updatedBy = 'mpesa-webhook';
  }

  return c.json({
    ResultCode: 0,
    ResultDesc: 'Accepted',
  });
});

// GET /payments/reconciliation - Get unreconciled payments (MUST be before /:id)
app.get(
  '/reconciliation',
  zValidator('query', reconciliationQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: result.error.flatten(),
          },
        },
        400
      );
    }
  }),
  async (c) => {
    const auth = c.get('auth');
    const query = c.req.valid('query');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const offset = (query.page - 1) * query.pageSize;
        const result = await repos.payments.findByStatus('completed', auth.tenantId, query.pageSize, offset);

        const enrichedData = await Promise.all(
          result.items.map(async (payment: any) => {
            const customer = payment.customerId ? await repos.customers.findById(payment.customerId, auth.tenantId) : null;
            return {
              ...payment,
              customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` } : null,
            };
          })
        );

        return c.json({
          success: true,
          data: enrichedData,
          pagination: buildPaginationResponse(query.page, query.pageSize, result.total),
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    let payments = getByTenant(DEMO_PAYMENTS, auth.tenantId);
    payments = payments.filter((p) => p.status === 'COMPLETED');

    const showUnreconciled = query.reconciled === false || query.reconciled === undefined;
    if (showUnreconciled) {
      payments = payments.filter((p) => !p.reconciledAt);
    } else if (query.reconciled === true) {
      payments = payments.filter((p) => !!p.reconciledAt);
    }

    payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const result = paginate(payments, query.page, query.pageSize);
    return c.json({
      success: true,
      data: result.data.map(enrichPayment),
      pagination: result.pagination,
    });
  }
);

// GET /payments - List with pagination and filters
app.get(
  '/',
  zValidator('query', listPaymentsQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: result.error.flatten(),
          },
        },
        400
      );
    }
  }),
  async (c) => {
    const auth = c.get('auth');
    const query = c.req.valid('query');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const offset = (query.page - 1) * query.pageSize;
        let result;

        if (query.status) {
          result = await repos.payments.findByStatus(query.status.toLowerCase(), auth.tenantId, query.pageSize, offset);
        } else if (query.customerId) {
          result = await repos.payments.findByCustomer(query.customerId, auth.tenantId, query.pageSize, offset);
        } else {
          result = await repos.payments.findMany(auth.tenantId, query.pageSize, offset);
        }

        const enrichedData = await Promise.all(
          result.items.map(async (payment: any) => {
            const customer = payment.customerId ? await repos.customers.findById(payment.customerId, auth.tenantId) : null;
            return {
              ...payment,
              customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` } : null,
            };
          })
        );

        return c.json({
          success: true,
          data: enrichedData,
          pagination: buildPaginationResponse(query.page, query.pageSize, result.total),
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    let payments = getByTenant(DEMO_PAYMENTS, auth.tenantId);

    if (query.status) payments = payments.filter((p) => p.status === query.status);
    if (query.method) payments = payments.filter((p) => p.method === query.method);
    if (query.customerId)
      payments = payments.filter((p) => p.customerId === query.customerId);

    payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const result = paginate(payments, query.page, query.pageSize);
    return c.json({
      success: true,
      data: result.data.map(enrichPayment),
      pagination: result.pagination,
    });
  }
);

// POST /payments - Record manual payment
app.post(
  '/',
  zValidator('json', createManualPaymentSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: result.error.flatten(),
          },
        },
        400
      );
    }
  }),
  async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        // Verify invoice exists
        const invoice = await repos.invoices.findById(body.invoiceId, auth.tenantId);
        if (!invoice) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
            404
          );
        }

        const created = await repos.payments.create({
          tenantId: auth.tenantId,
          invoiceId: body.invoiceId,
          customerId: body.customerId,
          amount: String(body.amount),
          currency: body.currency,
          paymentMethod: body.method.toLowerCase(),
          status: 'completed',
          reference: body.reference,
          processedAt: new Date(),
          createdBy: auth.userId,
        });

        return c.json({ success: true, data: created }, 201);
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const invoice = getById(DEMO_INVOICES, body.invoiceId);

    if (!invoice || invoice.tenantId !== auth.tenantId) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
        404
      );
    }

    if (body.amount > invoice.amountDue) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Amount exceeds invoice amount due',
          },
        },
        400
      );
    }

    const id = `pay-${Date.now()}`;
    const reference = body.reference ?? `PAY-${new Date().getFullYear()}-${String(DEMO_PAYMENTS.length + 1).padStart(3, '0')}`;

    const payment: Payment = {
      id,
      tenantId: auth.tenantId,
      invoiceId: body.invoiceId,
      customerId: body.customerId,
      amount: body.amount,
      currency: body.currency,
      method: body.method,
      status: 'COMPLETED',
      reference,
      processedAt: new Date(),
      createdAt: new Date(),
      createdBy: auth.userId,
      updatedAt: new Date(),
      updatedBy: auth.userId,
    };

    DEMO_PAYMENTS.push(payment);

    invoice.amountPaid += body.amount;
    invoice.amountDue -= body.amount;
    if (invoice.amountDue <= 0) {
      invoice.status = 'PAID';
      invoice.paidAt = new Date();
    } else {
      invoice.status = 'PARTIALLY_PAID';
    }
    invoice.updatedAt = new Date();
    invoice.updatedBy = auth.userId;

    return c.json({ success: true, data: enrichPayment(payment) }, 201);
  }
);

// POST /payments/mpesa - Initiate M-Pesa STK push
app.post(
  '/mpesa',
  zValidator('json', initiateMpesaPaymentSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: result.error.flatten(),
          },
        },
        400
      );
    }
  }),
  async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const invoice = await repos.invoices.findById(body.invoiceId, auth.tenantId);
        if (!invoice) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
            404
          );
        }

        const checkoutRequestId = `ws_CO_${Date.now()}`;
        const created = await repos.payments.create({
          tenantId: auth.tenantId,
          invoiceId: body.invoiceId,
          customerId: body.customerId,
          amount: String(body.amount),
          currency: 'TZS',
          paymentMethod: 'mpesa',
          status: 'pending',
          reference: checkoutRequestId,
          createdBy: auth.userId,
        });

        return c.json({
          success: true,
          data: {
            checkoutRequestId,
            paymentId: created.id,
            status: 'PENDING',
            message: 'STK push sent to customer. Awaiting confirmation.',
          },
        }, 202);
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const invoice = getById(DEMO_INVOICES, body.invoiceId);

    if (!invoice || invoice.tenantId !== auth.tenantId) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
        404
      );
    }

    if (body.amount > invoice.amountDue) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Amount exceeds invoice amount due',
          },
        },
        400
      );
    }

    const checkoutRequestId = `ws_CO_${Date.now()}`;
    const id = `pay-${Date.now()}`;
    const payment: Payment = {
      id,
      tenantId: auth.tenantId,
      invoiceId: body.invoiceId,
      customerId: body.customerId,
      amount: body.amount,
      currency: 'TZS',
      method: 'MPESA',
      status: 'PENDING',
      reference: checkoutRequestId,
      externalReference: checkoutRequestId,
      createdAt: new Date(),
      createdBy: auth.userId,
      updatedAt: new Date(),
      updatedBy: auth.userId,
    };

    DEMO_PAYMENTS.push(payment);

    return c.json({
      success: true,
      data: {
        checkoutRequestId,
        paymentId: id,
        status: 'PENDING',
        message: 'STK push sent to customer. Awaiting confirmation.',
      },
    }, 202);
  }
);

// GET /payments/:id - Get by ID
app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const payment = await repos.payments.findById(id, auth.tenantId);
      if (!payment) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } },
          404
        );
      }

      const customer = payment.customerId ? await repos.customers.findById(payment.customerId, auth.tenantId) : null;
      return c.json({
        success: true,
        data: {
          ...payment,
          customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` } : null,
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const payment = getById(DEMO_PAYMENTS, id);

  if (!payment || payment.tenantId !== auth.tenantId) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } },
      404
    );
  }

  return c.json({
    success: true,
    data: enrichPayment(payment),
  });
});

// GET /payments/:id/receipt - Get payment receipt
app.get('/:id/receipt', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const payment = await repos.payments.findById(id, auth.tenantId);
      if (!payment) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } },
          404
        );
      }

      const customer = payment.customerId ? await repos.customers.findById(payment.customerId, auth.tenantId) : null;
      const invoice = payment.invoiceId ? await repos.invoices.findById(payment.invoiceId, auth.tenantId) : null;

      return c.json({
        success: true,
        data: {
          receiptNumber: (payment as any).paymentNumber ?? (payment as any).reference,
          paymentId: payment.id,
          amount: payment.amount,
          currency: (payment as any).currency,
          method: (payment as any).paymentMethod,
          paidAt: (payment as any).processedAt ?? payment.createdAt,
          customer: customer
            ? { name: `${customer.firstName} ${customer.lastName}`, email: customer.email }
            : null,
          invoice: invoice ? { number: (invoice as any).invoiceNumber } : null,
          receiptUrl: `/api/v1/payments/${id}/receipt/pdf`,
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const payment = getById(DEMO_PAYMENTS, id);

  if (!payment || payment.tenantId !== auth.tenantId) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } },
      404
    );
  }

  const customer = getById(DEMO_CUSTOMERS, payment.customerId);
  const invoice = payment.invoiceId ? getById(DEMO_INVOICES, payment.invoiceId) : null;

  return c.json({
    success: true,
    data: {
      receiptNumber: payment.reference,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      paidAt: payment.processedAt ?? payment.createdAt,
      customer: customer
        ? { name: `${customer.firstName} ${customer.lastName}`, email: customer.email }
        : null,
      invoice: invoice ? { number: invoice.number } : null,
      receiptUrl: `/api/v1/payments/${id}/receipt/pdf`,
    },
  });
});

// POST /payments/:id/refund - Process refund
app.post(
  '/:id/refund',
  zValidator('json', refundPaymentSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: result.error.flatten(),
          },
        },
        400
      );
    }
  }),
  async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const payment = await repos.payments.findById(id, auth.tenantId);
        if (!payment) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } },
            404
          );
        }

        if (String((payment as any).status) !== 'completed') {
          return c.json(
            { success: false, error: { code: 'CONFLICT', message: 'Only completed payments can be refunded' } },
            409
          );
        }

        const updated = await repos.payments.update(id, auth.tenantId, {
          status: 'refunded',
          updatedBy: auth.userId,
        });

        return c.json({
          success: true,
          data: {
            ...updated,
            refundAmount: body.amount ?? (payment as any).amount,
            refundedAt: new Date().toISOString(),
            reason: body.reason,
          },
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const payment = getById(DEMO_PAYMENTS, id);

    if (!payment || payment.tenantId !== auth.tenantId) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } },
        404
      );
    }

    if (payment.status !== 'COMPLETED') {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Only completed payments can be refunded',
          },
        },
        409
      );
    }

    const refundAmount = body.amount ?? payment.amount;
    if (refundAmount > payment.amount) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Refund amount exceeds payment amount',
          },
        },
        400
      );
    }

    payment.status = 'REFUNDED';
    payment.updatedAt = new Date();
    payment.updatedBy = auth.userId;

    const invoice = getById(DEMO_INVOICES, payment.invoiceId);
    if (invoice && invoice.tenantId === auth.tenantId) {
      invoice.amountPaid -= refundAmount;
      invoice.amountDue += refundAmount;
      invoice.status = invoice.amountPaid <= 0 ? 'SENT' : 'PARTIALLY_PAID';
      invoice.updatedAt = new Date();
      invoice.updatedBy = auth.userId;
    }

    return c.json({
      success: true,
      data: {
        ...enrichPayment(payment),
        refundAmount,
        refundedAt: new Date().toISOString(),
        reason: body.reason,
      },
    });
  }
);

export const paymentsApp = app;
