// @ts-nocheck
/**
 * Maintenance tickets router (customer-facing intake).
 *
 * The customer app talks to `/api/v1/maintenance/tickets` which is a thin
 * view over the work-order domain. This keeps the customer-facing vocabulary
 * ("ticket") separate from the internal work-order model while routing to
 * the same underlying repository and lifecycle handlers.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { majorToMinor, mapWorkOrderRow, paginateArray } from './db-mappers';
import { dispatchWorkOrderNotification } from './notifications-dispatcher';
import {
  uploadFile,
  readAndValidateUpload,
  uploadErrorToResponse,
} from '../lib/storage';

function workOrderNumber() {
  return `WO-${Date.now().toString().slice(-6)}`;
}

function appendTimeline(existing: any, entry: any) {
  const list = Array.isArray(existing) ? [...existing] : [];
  list.push(entry);
  return list;
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

/**
 * GET /api/v1/maintenance/tickets
 * Lists tickets for the authenticated customer by default, or a filtered set
 * when `tenantId`, `customerId`, or `status` are provided (manager view).
 */
app.get('/tickets', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const customerIdQuery = c.req.query('customerId');
  const status = c.req.query('status')?.toLowerCase();
  const tenantOverride = c.req.query('tenantId');

  // Tenant isolation is enforced by auth; tenantId query is accepted for
  // symmetry with documented API surface but must match the auth context.
  if (tenantOverride && tenantOverride !== auth.tenantId) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Tenant mismatch' } },
      403
    );
  }

  // Customer self-service default: show tickets owned by the caller.
  const customerId = customerIdQuery ?? auth.userId;

  let result = await repos.workOrders.findByCustomer(customerId, auth.tenantId, 1000, 0);
  if (status) {
    result = {
      ...result,
      items: result.items.filter((row: any) => String(row.status).toLowerCase() === status),
    };
  }

  const items = result.items.map(mapWorkOrderRow);
  const paginated = paginateArray(items, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

/**
 * GET /api/v1/maintenance/tickets/:id
 */
app.get('/tickets/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.workOrders.findById(c.req.param('id'), auth.tenantId);
  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } }, 404);
  }
  return c.json({ success: true, data: mapWorkOrderRow(row) });
});

/**
 * POST /api/v1/maintenance/tickets
 * Customer intake. Creates a work order with source = customer_request and
 * dispatches a `work_order.submitted` notification so the manager is paged.
 */
app.post('/tickets', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const contentType = c.req.header('content-type') || '';

  // Pre-allocate the ticket ID so storage keys can include it before the row
  // is created. This keeps photo URLs stable from the moment they are written.
  const ticketId = crypto.randomUUID();

  let body: any = {};
  let intakeAttachments: any[] = [];

  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.parseBody({ all: true });
    const payloadRaw = form.payload ?? form.data ?? '{}';
    try {
      body = typeof payloadRaw === 'string' ? JSON.parse(payloadRaw) : {};
    } catch {
      body = {};
    }
    const photoFields = ['photos', 'photos[]', 'attachments', 'attachments[]'];
    let totalBytes = 0;
    for (const field of photoFields) {
      const value = form[field];
      if (!value) continue;
      const files = Array.isArray(value) ? value : [value];
      for (const f of files) {
        if (typeof f === 'string') {
          intakeAttachments.push({ type: 'image', url: f, filename: f.split('/').pop() || 'photo' });
          continue;
        }
        if (!f || typeof f !== 'object' || !('arrayBuffer' in f)) continue;

        try {
          const validated = await readAndValidateUpload(f as any, totalBytes);
          totalBytes += validated.size;
          const fileId = crypto.randomUUID();
          const key = `maintenance-tickets/${auth.tenantId}/${ticketId}/${fileId}-${validated.filename}`;
          const uploaded = await uploadFile({
            tenantId: auth.tenantId,
            key,
            body: validated.buffer,
            contentType: validated.contentType,
          });
          intakeAttachments.push({
            type: 'image',
            url: uploaded.url,
            key: uploaded.key,
            filename: validated.filename,
            contentType: validated.contentType,
            size: validated.size,
          });
        } catch (err) {
          const mapped = uploadErrorToResponse(err);
          if (mapped) return c.json(mapped.body, mapped.status);
          throw err;
        }
      }
    }
  } else {
    body = await c.req.json().catch(() => ({}));
    if (Array.isArray(body.photos)) {
      intakeAttachments = body.photos.map((url: string) => ({
        type: 'image',
        url,
        filename: url.split('/').pop() || 'photo',
      }));
    }
    if (Array.isArray(body.attachments)) {
      intakeAttachments = intakeAttachments.concat(body.attachments);
    }
  }

  if (!body.title && !body.description) {
    return c.json(
      { success: false, error: { code: 'VALIDATION', message: 'title or description is required' } },
      400
    );
  }

  const row = await repos.workOrders.create({
    id: ticketId,
    tenantId: auth.tenantId,
    propertyId: body.propertyId,
    unitId: body.unitId,
    customerId: body.customerId ?? auth.userId,
    workOrderNumber: workOrderNumber(),
    priority: String(body.priority || 'medium').toLowerCase(),
    status: 'submitted',
    category: String(body.category || 'other').toLowerCase(),
    source: 'customer_request',
    title: body.title || (body.description ? String(body.description).slice(0, 80) : 'Maintenance request'),
    description: body.description,
    location: body.location,
    attachments: intakeAttachments,
    currency: body.currency || 'KES',
    timeline: [{ at: new Date().toISOString(), status: 'submitted', by: auth.userId }],
    createdBy: auth.userId,
    updatedBy: auth.userId,
  });

  await dispatchWorkOrderNotification({
    event: 'work_order.submitted',
    tenantId: auth.tenantId,
    workOrderId: row.id,
    workOrderNumber: row.workOrderNumber,
    customerId: row.customerId ?? undefined,
    title: row.title,
    priority: row.priority,
    status: row.status,
  });

  return c.json({ success: true, data: mapWorkOrderRow(row) }, 201);
});

/**
 * POST /api/v1/maintenance/tickets/:id/cancel
 */
app.post('/tickets/:id/cancel', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json().catch(() => ({}));
  const current = await repos.workOrders.findById(c.req.param('id'), auth.tenantId);
  if (!current) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } }, 404);
  }
  const row = await repos.workOrders.update(c.req.param('id'), auth.tenantId, {
    status: 'cancelled',
    timeline: appendTimeline(current.timeline, {
      at: new Date().toISOString(),
      status: 'cancelled',
      by: auth.userId,
      reason: body.reason,
    }),
    updatedBy: auth.userId,
  });
  await dispatchWorkOrderNotification({
    event: 'work_order.cancelled',
    tenantId: auth.tenantId,
    workOrderId: row.id,
    workOrderNumber: row.workOrderNumber,
    customerId: row.customerId ?? undefined,
    status: row.status,
    meta: { reason: body.reason },
  });
  return c.json({ success: true, data: mapWorkOrderRow(row) });
});

/**
 * POST /api/v1/maintenance/tickets/:id/rating
 * Customer submits satisfaction rating after completion.
 */
app.post('/tickets/:id/rating', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json().catch(() => ({}));
  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return c.json(
      { success: false, error: { code: 'INVALID_RATING', message: 'Rating must be between 1 and 5' } },
      400
    );
  }
  const current = await repos.workOrders.findById(c.req.param('id'), auth.tenantId);
  if (!current) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } }, 404);
  }
  const row = await repos.workOrders.update(c.req.param('id'), auth.tenantId, {
    status: current.status === 'pending_verification' ? 'completed' : current.status,
    timeline: appendTimeline(current.timeline, {
      at: new Date().toISOString(),
      status: 'rated',
      by: auth.userId,
      rating,
      feedback: body.feedback,
      tags: body.tags,
      wouldRecommend: body.wouldRecommend,
      categoryRatings: body.categoryRatings,
    }),
    updatedBy: auth.userId,
  });
  await dispatchWorkOrderNotification({
    event: 'work_order.rated',
    tenantId: auth.tenantId,
    workOrderId: row.id,
    workOrderNumber: row.workOrderNumber,
    customerId: row.customerId ?? undefined,
    vendorId: row.vendorId ?? undefined,
    status: row.status,
    meta: { rating, wouldRecommend: body.wouldRecommend },
  });
  return c.json({ success: true, data: mapWorkOrderRow(row) });
});

export const maintenanceRouter = app;
