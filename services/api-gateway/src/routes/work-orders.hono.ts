// @ts-nocheck

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { majorToMinor, mapWorkOrderRow, paginateArray } from './db-mappers';
import { dispatchWorkOrderNotification } from './notifications-dispatcher';

function workOrderNumber() {
  return `WO-${Date.now().toString().slice(-6)}`;
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

async function updateWorkOrder(c: any) {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  const estimatedCost =
    body.estimatedCost && typeof body.estimatedCost === 'object'
      ? body.estimatedCost.amount
      : body.estimatedCost;
  const actualCost =
    body.actualCost && typeof body.actualCost === 'object'
      ? body.actualCost.amount
      : body.actualCost;

  const row = await repos.workOrders.update(c.req.param('id'), auth.tenantId, {
    vendorId: body.vendorId,
    priority: body.priority ? String(body.priority).toLowerCase() : undefined,
    status: body.status ? String(body.status).toLowerCase() : undefined,
    category: body.category ? String(body.category).toLowerCase() : undefined,
    title: body.title,
    description: body.description,
    location: body.location,
    attachments: body.attachments,
    estimatedCost: estimatedCost != null ? majorToMinor(estimatedCost) : undefined,
    actualCost: actualCost != null ? majorToMinor(actualCost) : undefined,
    scheduledAt: body.scheduledAt || body.scheduledDate ? new Date(body.scheduledAt || body.scheduledDate) : undefined,
    completedAt: body.completedAt ? new Date(body.completedAt) : undefined,
    completionNotes: body.completionNotes,
    updatedBy: auth.userId,
  });
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
  return c.json({ success: true, data: mapWorkOrderRow(row) });
}

function appendTimeline(existing: any, entry: any) {
  const list = Array.isArray(existing) ? [...existing] : [];
  list.push(entry);
  return list;
}

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const propertyId = c.req.query('propertyId');
  const customerId = c.req.query('customerId');
  const vendorId = c.req.query('vendorId');
  const status = c.req.query('status')?.toLowerCase();

  let result;
  if (propertyId) result = await repos.workOrders.findByProperty(propertyId, auth.tenantId, 1000, 0);
  else if (customerId) result = await repos.workOrders.findByCustomer(customerId, auth.tenantId, 1000, 0);
  else if (vendorId) result = await repos.workOrders.findByVendor(vendorId, auth.tenantId, 1000, 0);
  else if (status) result = await repos.workOrders.findByStatus(status, auth.tenantId, 1000, 0);
  else result = await repos.workOrders.findMany(auth.tenantId, 1000, 0);

  const items = result.items.map(mapWorkOrderRow);
  const paginated = paginateArray(items, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/my-tasks', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const result = await repos.workOrders.findByVendor(auth.userId, auth.tenantId, 1000, 0);
  // Fallback to all work orders for managers / admins when no vendor match
  if (!result.items?.length) {
    const fallback = await repos.workOrders.findMany(auth.tenantId, 1000, 0);
    return c.json({ success: true, data: fallback.items.map(mapWorkOrderRow) });
  }
  return c.json({ success: true, data: result.items.map(mapWorkOrderRow) });
});

app.get('/my-requests', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const result = await repos.workOrders.findByCustomer(auth.userId, auth.tenantId, 1000, 0);
  return c.json({ success: true, data: result.items.map(mapWorkOrderRow) });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.workOrders.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
  return c.json({ success: true, data: mapWorkOrderRow(row) });
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  const number = workOrderNumber();
  const row = await repos.workOrders.create({
    id: crypto.randomUUID(),
    tenantId: auth.tenantId,
    propertyId: body.propertyId,
    unitId: body.unitId,
    customerId: body.customerId ?? auth.userId,
    vendorId: body.vendorId,
    workOrderNumber: number,
    priority: String(body.priority || 'medium').toLowerCase(),
    status: 'submitted',
    category: String(body.category || 'other').toLowerCase(),
    source: body.customerId || auth.userId ? 'customer_request' : 'manager_created',
    title: body.title,
    description: body.description,
    location: body.location,
    attachments: body.attachments || [],
    estimatedCost: body.estimatedCost != null ? majorToMinor(body.estimatedCost) : undefined,
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

app.put('/:id', async (c) => updateWorkOrder(c));
app.patch('/:id', async (c) => updateWorkOrder(c));

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  await repos.workOrders.delete(c.req.param('id'), auth.tenantId, auth.userId);
  return c.json({ success: true, data: { message: 'Work order deleted' } });
});

// ---------------------------------------------------------------------------
// Lifecycle endpoints: triage → assign → schedule → start → complete → rate
// ---------------------------------------------------------------------------

app.post('/:id/triage', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json().catch(() => ({}));
  const current = await repos.workOrders.findById(c.req.param('id'), auth.tenantId);
  if (!current) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
  }
  const row = await repos.workOrders.update(c.req.param('id'), auth.tenantId, {
    status: 'triaged',
    priority: body.priority ? String(body.priority).toLowerCase() : undefined,
    category: body.category ? String(body.category).toLowerCase() : undefined,
    timeline: appendTimeline(current.timeline, {
      at: new Date().toISOString(),
      status: 'triaged',
      by: auth.userId,
      notes: body.notes,
    }),
    updatedBy: auth.userId,
  });
  return c.json({ success: true, data: mapWorkOrderRow(row) });
});

app.post('/:id/assign', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json().catch(() => ({}));
  const current = await repos.workOrders.findById(c.req.param('id'), auth.tenantId);
  if (!current) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
  }
  const row = await repos.workOrders.update(c.req.param('id'), auth.tenantId, {
    status: 'assigned',
    vendorId: body.vendorId ?? body.assignedToUserId ?? current.vendorId,
    timeline: appendTimeline(current.timeline, {
      at: new Date().toISOString(),
      status: 'assigned',
      by: auth.userId,
      notes: body.notes,
      assignedToUserId: body.assignedToUserId,
      vendorId: body.vendorId,
    }),
    updatedBy: auth.userId,
  });

  await dispatchWorkOrderNotification({
    event: 'work_order.assigned',
    tenantId: auth.tenantId,
    workOrderId: row.id,
    workOrderNumber: row.workOrderNumber,
    customerId: row.customerId ?? undefined,
    vendorId: row.vendorId ?? undefined,
    managerId: auth.userId,
    title: row.title,
    priority: row.priority,
    status: row.status,
  });

  return c.json({ success: true, data: mapWorkOrderRow(row) });
});

app.post('/:id/schedule', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json().catch(() => ({}));
  const current = await repos.workOrders.findById(c.req.param('id'), auth.tenantId);
  if (!current) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
  }
  const scheduledAt = body.scheduledDate || body.scheduledAt;
  const row = await repos.workOrders.update(c.req.param('id'), auth.tenantId, {
    status: 'scheduled',
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    timeline: appendTimeline(current.timeline, {
      at: new Date().toISOString(),
      status: 'scheduled',
      by: auth.userId,
      scheduledAt,
      scheduledTimeSlot: body.scheduledTimeSlot,
    }),
    updatedBy: auth.userId,
  });

  await dispatchWorkOrderNotification({
    event: 'work_order.scheduled',
    tenantId: auth.tenantId,
    workOrderId: row.id,
    workOrderNumber: row.workOrderNumber,
    customerId: row.customerId ?? undefined,
    vendorId: row.vendorId ?? undefined,
    status: row.status,
    meta: { scheduledAt, scheduledTimeSlot: body.scheduledTimeSlot },
  });

  return c.json({ success: true, data: mapWorkOrderRow(row) });
});

app.post('/:id/start', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json().catch(() => ({}));
  const current = await repos.workOrders.findById(c.req.param('id'), auth.tenantId);
  if (!current) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
  }
  const row = await repos.workOrders.update(c.req.param('id'), auth.tenantId, {
    status: 'in_progress',
    timeline: appendTimeline(current.timeline, {
      at: new Date().toISOString(),
      status: 'in_progress',
      by: auth.userId,
      notes: body.notes,
    }),
    updatedBy: auth.userId,
  });

  await dispatchWorkOrderNotification({
    event: 'work_order.started',
    tenantId: auth.tenantId,
    workOrderId: row.id,
    workOrderNumber: row.workOrderNumber,
    customerId: row.customerId ?? undefined,
    vendorId: row.vendorId ?? undefined,
    status: row.status,
  });

  return c.json({ success: true, data: mapWorkOrderRow(row) });
});

app.post('/:id/complete', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const contentType = c.req.header('content-type') || '';

  let body: any = {};
  let proofAttachments: any[] = [];

  if (contentType.includes('multipart/form-data')) {
    // Proof upload via multipart. We accept a JSON `payload` field plus files.
    const form = await c.req.parseBody({ all: true });
    const payloadRaw = form.payload ?? form.data ?? '{}';
    try {
      body = typeof payloadRaw === 'string' ? JSON.parse(payloadRaw) : {};
    } catch {
      body = {};
    }
    const photoFields = ['afterPhotos', 'photos', 'proof', 'proof[]'];
    for (const field of photoFields) {
      const value = form[field];
      if (!value) continue;
      const files = Array.isArray(value) ? value : [value];
      for (const f of files) {
        if (typeof f === 'string') {
          proofAttachments.push({ type: 'image', url: f, filename: f.split('/').pop() || 'proof' });
        } else if (f && typeof f === 'object' && 'name' in f) {
          // File object: in production this would be uploaded to object storage.
          // TODO: integrate with document-intelligence / S3 uploader.
          proofAttachments.push({
            type: 'image',
            url: `pending-upload://${(f as any).name}`,
            filename: (f as any).name,
          });
        }
      }
    }
  } else {
    body = await c.req.json().catch(() => ({}));
    if (Array.isArray(body.afterPhotos)) {
      proofAttachments = body.afterPhotos.map((url: string) => ({
        type: 'image',
        url,
        filename: url.split('/').pop() || 'proof',
      }));
    }
    if (Array.isArray(body.attachments)) proofAttachments = proofAttachments.concat(body.attachments);
  }

  const current = await repos.workOrders.findById(c.req.param('id'), auth.tenantId);
  if (!current) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
  }

  const mergedAttachments = Array.isArray(current.attachments)
    ? current.attachments.concat(proofAttachments)
    : proofAttachments;

  const row = await repos.workOrders.update(c.req.param('id'), auth.tenantId, {
    status: 'pending_verification',
    completedAt: new Date(),
    completionNotes: body.completionNotes,
    attachments: mergedAttachments,
    actualCost: body.actualCost?.amount != null ? majorToMinor(body.actualCost.amount) : undefined,
    timeline: appendTimeline(current.timeline, {
      at: new Date().toISOString(),
      status: 'pending_verification',
      by: auth.userId,
      notes: body.completionNotes,
      proofAttachmentCount: proofAttachments.length,
    }),
    updatedBy: auth.userId,
  });

  await dispatchWorkOrderNotification({
    event: 'work_order.completed',
    tenantId: auth.tenantId,
    workOrderId: row.id,
    workOrderNumber: row.workOrderNumber,
    customerId: row.customerId ?? undefined,
    vendorId: row.vendorId ?? undefined,
    status: row.status,
    meta: { proofAttachmentCount: proofAttachments.length },
  });

  return c.json({ success: true, data: mapWorkOrderRow(row) });
});

app.post('/:id/rating', async (c) => {
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
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
  }

  const ratingEntry = {
    at: new Date().toISOString(),
    status: 'rated',
    by: auth.userId,
    rating,
    feedback: body.feedback,
    tags: body.tags,
    wouldRecommend: body.wouldRecommend,
    categoryRatings: body.categoryRatings,
  };

  const row = await repos.workOrders.update(c.req.param('id'), auth.tenantId, {
    status: current.status === 'pending_verification' ? 'completed' : current.status,
    timeline: appendTimeline(current.timeline, ratingEntry),
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

// Legacy alias - some clients post to `/rate` for backward compatibility
app.post('/:id/rate', async (c) => {
  // Re-dispatch to /rating handler by forwarding the request body.
  const body = await c.req.json().catch(() => ({}));
  const req = new Request(new URL(c.req.url).origin + c.req.path.replace(/\/rate$/, '/rating'), {
    method: 'POST',
    headers: c.req.raw.headers,
    body: JSON.stringify(body),
  });
  return app.fetch(req, c.env);
});

app.post('/:id/cancel', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json().catch(() => ({}));
  const current = await repos.workOrders.findById(c.req.param('id'), auth.tenantId);
  if (!current) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
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
    vendorId: row.vendorId ?? undefined,
    status: row.status,
    meta: { reason: body.reason },
  });

  return c.json({ success: true, data: mapWorkOrderRow(row) });
});

export const workOrdersRouter = app;
