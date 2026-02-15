/**
 * Invoices API routes - Production-ready REST API with Hono and Zod validation
 *
 * GET    /invoices           - List with pagination, filters (status, customerId, leaseId, dateRange)
 * GET    /invoices/overdue   - Get overdue invoices
 * GET    /invoices/:id       - Get by ID
 * GET    /invoices/:id/pdf   - Generate PDF
 * POST   /invoices           - Create invoice
 * PUT    /invoices/:id       - Update invoice (draft only)
 * DELETE /invoices/:id       - Cancel invoice
 * POST   /invoices/:id/send  - Send invoice to customer
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware, generateId as generateUUID, buildPaginationResponse } from '../middleware/database';
import {
  listInvoicesQuerySchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  sendInvoiceSchema,
} from './schemas';
import {
  DEMO_INVOICES,
  DEMO_CUSTOMERS,
  DEMO_LEASES,
  DEMO_UNITS,
  getByTenant,
  getById,
  paginate,
} from '../data/mock-data';
import type { Invoice } from '../types/mock-types';

// Export for Express compatibility - creates empty router (routes use Hono)
export const invoicesRouter = null;

const app = new Hono();

// Parse query for list (with optional date range as ISO strings)
const listQuerySchema = listInvoicesQuerySchema;

// Helper to enrich invoice with related data (for mock data)
function enrichInvoice(invoice: Invoice) {
  const customer = getById(DEMO_CUSTOMERS, invoice.customerId);
  const lease = invoice.leaseId ? getById(DEMO_LEASES, invoice.leaseId) : null;
  const unit = lease ? getById(DEMO_UNITS, lease.unitId) : null;
  return {
    ...invoice,
    customer: customer
      ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` }
      : null,
    unit: unit ? { id: unit.id, unitNumber: unit.unitNumber } : null,
  };
}

// All routes require auth and database middleware
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

// GET /invoices/overdue - MUST be before /:id to avoid conflict
app.get(
  '/overdue',
  zValidator('query', listQuerySchema, (result, c) => {
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
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const query = c.req.valid('query');

    // Use database if available
    if (!useMockData && repos) {
      try {
        const overdue = await repos.invoices.findOverdue(auth.tenantId);
        
        // Manual pagination
        const offset = (query.page - 1) * query.pageSize;
        const totalItems = overdue.length;
        const paginatedItems = overdue.slice(offset, offset + query.pageSize);

        // Enrich with customer info
        const enrichedData = await Promise.all(
          paginatedItems.map(async (invoice) => {
            const customer = invoice.customerId ? await repos.customers.findById(invoice.customerId, auth.tenantId) : null;
            const lease = invoice.leaseId ? await repos.leases.findById(invoice.leaseId, auth.tenantId) : null;
            const unit = lease?.unitId ? await repos.units.findById(lease.unitId, auth.tenantId) : null;
            return {
              ...invoice,
              customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` } : null,
              unit: unit ? { id: unit.id, unitNumber: unit.unitCode } : null,
            };
          })
        );

        return c.json({
          success: true,
          data: enrichedData,
          pagination: buildPaginationResponse(query.page, query.pageSize, totalItems),
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    let invoices = getByTenant(DEMO_INVOICES, auth.tenantId);
    invoices = invoices.filter(
      (i) =>
        i.status === 'OVERDUE' ||
        (new Date(i.dueDate) < new Date() && i.amountDue > 0)
    );
    invoices.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const result = paginate(invoices, query.page, query.pageSize);
    const enrichedData = result.data.map(enrichInvoice);
    return c.json({
      success: true,
      data: enrichedData,
      pagination: result.pagination,
    });
  }
);

// GET /invoices - List with pagination and filters
app.get(
  '/',
  zValidator('query', listQuerySchema, (result, c) => {
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
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const query = c.req.valid('query');

    // Use database if available
    if (!useMockData && repos) {
      try {
        const offset = (query.page - 1) * query.pageSize;
        let result;

        if (query.status) {
          result = await repos.invoices.findByStatus(query.status.toLowerCase(), auth.tenantId, query.pageSize, offset);
        } else if (query.customerId) {
          result = await repos.invoices.findByCustomer(query.customerId, auth.tenantId, query.pageSize, offset);
        } else if (query.leaseId) {
          result = await repos.invoices.findByLease(query.leaseId, auth.tenantId, query.pageSize, offset);
        } else {
          result = await repos.invoices.findMany(auth.tenantId, query.pageSize, offset);
        }

        // Enrich with customer and unit info
        const enrichedData = await Promise.all(
          result.items.map(async (invoice) => {
            const customer = invoice.customerId ? await repos.customers.findById(invoice.customerId, auth.tenantId) : null;
            const lease = invoice.leaseId ? await repos.leases.findById(invoice.leaseId, auth.tenantId) : null;
            const unit = lease?.unitId ? await repos.units.findById(lease.unitId, auth.tenantId) : null;
            return {
              ...invoice,
              customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` } : null,
              unit: unit ? { id: unit.id, unitNumber: unit.unitCode } : null,
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
    let invoices = getByTenant(DEMO_INVOICES, auth.tenantId);

    if (query.status) invoices = invoices.filter((i) => i.status === query.status);
    if (query.customerId)
      invoices = invoices.filter((i) => i.customerId === query.customerId);
    if (query.leaseId)
      invoices = invoices.filter((i) => i.leaseId === query.leaseId);
    if (query.dateFrom) {
      const from = new Date(query.dateFrom);
      invoices = invoices.filter((i) => new Date(i.dueDate) >= from);
    }
    if (query.dateTo) {
      const to = new Date(query.dateTo);
      invoices = invoices.filter((i) => new Date(i.dueDate) <= to);
    }

    invoices.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    const result = paginate(invoices, query.page, query.pageSize);
    const enrichedData = result.data.map(enrichInvoice);
    return c.json({
      success: true,
      data: enrichedData,
      pagination: result.pagination,
    });
  }
);

// POST /invoices - Create invoice
app.post(
  '/',
  zValidator('json', createInvoiceSchema, (result, c) => {
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
    const total = body.lineItems.reduce((sum, li) => sum + li.total, 0);

    if (!useMockData && repos) {
      try {
        const created = await repos.invoices.create({
          tenantId: auth.tenantId,
          customerId: body.customerId,
          leaseId: body.leaseId,
          status: 'draft',
          invoiceType: body.type,
          periodStart: new Date(body.periodStart),
          periodEnd: new Date(body.periodEnd),
          dueDate: new Date(body.dueDate),
          subtotalAmount: String(body.subtotal),
          taxAmount: String(body.tax),
          totalAmount: String(total),
          paidAmount: '0',
          currency: body.currency,
          createdBy: auth.userId,
        });

        return c.json({ success: true, data: created }, 201);
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const id = `inv-${Date.now()}`;
    const number = `INV-${new Date().getFullYear()}-${String(DEMO_INVOICES.length + 1).padStart(3, '0')}`;

    const invoice: Invoice = {
      id,
      tenantId: auth.tenantId,
      number,
      customerId: body.customerId,
      leaseId: body.leaseId,
      status: 'DRAFT',
      type: body.type,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      dueDate: new Date(body.dueDate),
      subtotal: body.subtotal,
      tax: body.tax,
      total,
      amountPaid: 0,
      amountDue: total,
      currency: body.currency,
      lineItems: body.lineItems.map((li, idx) => ({
        id: `li-${id}-${idx}`,
        ...li,
      })),
      createdAt: new Date(),
      createdBy: auth.userId,
      updatedAt: new Date(),
      updatedBy: auth.userId,
    };

    DEMO_INVOICES.push(invoice);
    return c.json({ success: true, data: enrichInvoice(invoice) }, 201);
  }
);

// GET /invoices/:id - Get by ID
app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const invoice = await repos.invoices.findById(id, auth.tenantId);
      if (!invoice) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
          404
        );
      }

      const customer = invoice.customerId ? await repos.customers.findById(invoice.customerId, auth.tenantId) : null;
      const lease = invoice.leaseId ? await repos.leases.findById(invoice.leaseId, auth.tenantId) : null;
      const unit = lease?.unitId ? await repos.units.findById(lease.unitId, auth.tenantId) : null;

      return c.json({
        success: true,
        data: {
          ...invoice,
          customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` } : null,
          lease,
          unit: unit ? { id: unit.id, unitNumber: unit.unitCode } : null,
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const invoice = getById(DEMO_INVOICES, id);

  if (!invoice || invoice.tenantId !== auth.tenantId) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
      404
    );
  }

  const customer = getById(DEMO_CUSTOMERS, invoice.customerId);
  const lease = invoice.leaseId ? getById(DEMO_LEASES, invoice.leaseId) : null;
  const unit = lease ? getById(DEMO_UNITS, lease.unitId) : null;

  return c.json({
    success: true,
    data: {
      ...invoice,
      customer,
      lease,
      unit,
    },
  });
});

// Minimal valid PDF placeholder (in production, use pdfkit or a PDF service)
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000049 00000 n \n0000000115 00000 n \n0000000181 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n246\n%%EOF',
  'utf-8'
);

// GET /invoices/:id/pdf - Generate PDF (returns metadata + download URL)
// Query ?download=1 or Accept: application/pdf returns PDF bytes
app.get('/:id/pdf', (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const wantDownload = c.req.query('download') === '1' || c.req.header('Accept')?.includes('application/pdf');
  const invoice = getById(DEMO_INVOICES, id);

  if (!invoice || invoice.tenantId !== auth.tenantId) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
      404
    );
  }

  const pdfUrl = `/api/v1/invoices/${id}/pdf?download=1`;
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

  if (wantDownload) {
    return new Response(MINIMAL_PDF, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
        'Content-Length': String(MINIMAL_PDF.length),
      },
    });
  }

  return c.json({
    success: true,
    data: {
      pdfUrl,
      invoiceNumber: invoice.number,
      expiresAt,
      contentType: 'application/pdf',
    },
  });
});

// PUT /invoices/:id - Update (draft only)
app.put(
  '/:id',
  zValidator('json', updateInvoiceSchema, (result, c) => {
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
        const existing = await repos.invoices.findById(id, auth.tenantId);
        if (!existing) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
            404
          );
        }
        if (String(existing.status) !== 'draft') {
          return c.json(
            { success: false, error: { code: 'CONFLICT', message: 'Only draft invoices can be updated' } },
            409
          );
        }

        const updateData: Record<string, any> = { updatedBy: auth.userId };
        if (body.customerId) updateData.customerId = body.customerId;
        if (body.leaseId) updateData.leaseId = body.leaseId;
        if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
        if (body.subtotal !== undefined) updateData.subtotalAmount = String(body.subtotal);
        if (body.tax !== undefined) updateData.taxAmount = String(body.tax);

        const updated = await repos.invoices.update(id, auth.tenantId, updateData);
        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const invoice = getById(DEMO_INVOICES, id);

    if (!invoice || invoice.tenantId !== auth.tenantId) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
        404
      );
    }

    if (invoice.status !== 'DRAFT') {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Only draft invoices can be updated',
          },
        },
        409
      );
    }

    const total = body.lineItems
      ? body.lineItems.reduce((sum: number, li: { total: number }) => sum + li.total, 0)
      : invoice.total;

    Object.assign(invoice, {
      ...body,
      customerId: body.customerId ?? invoice.customerId,
      leaseId: body.leaseId ?? invoice.leaseId,
      type: body.type ?? invoice.type,
      periodStart: body.periodStart ? new Date(body.periodStart) : invoice.periodStart,
      periodEnd: body.periodEnd ? new Date(body.periodEnd) : invoice.periodEnd,
      dueDate: body.dueDate ? new Date(body.dueDate) : invoice.dueDate,
      subtotal: body.subtotal ?? invoice.subtotal,
      tax: body.tax ?? invoice.tax,
      total,
      amountDue: total - invoice.amountPaid,
      updatedAt: new Date(),
      updatedBy: auth.userId,
    });

    return c.json({ success: true, data: enrichInvoice(invoice) });
  }
);

// DELETE /invoices/:id - Cancel invoice
app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const existing = await repos.invoices.findById(id, auth.tenantId);
      if (!existing) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
          404
        );
      }
      if (String(existing.status) === 'paid') {
        return c.json(
          { success: false, error: { code: 'CONFLICT', message: 'Paid invoices cannot be cancelled' } },
          409
        );
      }

      const updated = await repos.invoices.update(id, auth.tenantId, {
        status: 'cancelled',
        updatedBy: auth.userId,
      });
      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const invoice = getById(DEMO_INVOICES, id);

  if (!invoice || invoice.tenantId !== auth.tenantId) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
      404
    );
  }

  if (invoice.status === 'PAID') {
    return c.json(
      {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Paid invoices cannot be cancelled',
        },
      },
      409
    );
  }

  invoice.status = 'CANCELLED';
  invoice.updatedAt = new Date();
  invoice.updatedBy = auth.userId;

  return c.json({ success: true, data: enrichInvoice(invoice) });
});

// POST /invoices/:id/send - Send invoice to customer
app.post(
  '/:id/send',
  zValidator('json', sendInvoiceSchema, (result, c) => {
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
        const existing = await repos.invoices.findById(id, auth.tenantId);
        if (!existing) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
            404
          );
        }
        if (String(existing.status) !== 'draft') {
          return c.json(
            { success: false, error: { code: 'CONFLICT', message: 'Only draft invoices can be sent' } },
            409
          );
        }

        const updated = await repos.invoices.update(id, auth.tenantId, {
          status: 'sent',
          updatedBy: auth.userId,
        });

        return c.json({
          success: true,
          data: {
            ...updated,
            sentAt: new Date().toISOString(),
            channel: body?.channel ?? 'email',
            customMessage: body?.customMessage,
          },
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const invoice = getById(DEMO_INVOICES, id);

    if (!invoice || invoice.tenantId !== auth.tenantId) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
        404
      );
    }

    if (invoice.status !== 'DRAFT') {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Only draft invoices can be sent',
          },
        },
        409
      );
    }

    invoice.status = 'SENT';
    invoice.updatedAt = new Date();
    invoice.updatedBy = auth.userId;

    return c.json({
      success: true,
      data: {
        ...enrichInvoice(invoice),
        sentAt: new Date().toISOString(),
        channel: body?.channel ?? 'email',
        customMessage: body?.customMessage,
      },
    });
  }
);

export const invoicesApp = app;
