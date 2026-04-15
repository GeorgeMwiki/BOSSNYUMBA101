import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { majorToMinor, mapWorkOrderRow, paginateArray } from './db-mappers';

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
  const result = await repos.workOrders.findMany(auth.tenantId, 1000, 0);
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
  const row = await repos.workOrders.create({
    id: crypto.randomUUID(),
    tenantId: auth.tenantId,
    propertyId: body.propertyId,
    unitId: body.unitId,
    customerId: body.customerId,
    vendorId: body.vendorId,
    workOrderNumber: workOrderNumber(),
    priority: String(body.priority || 'medium').toLowerCase(),
    status: 'submitted',
    category: String(body.category || 'other').toLowerCase(),
    source: body.customerId ? 'customer_request' : 'manager_created',
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
  return c.json({ success: true, data: mapWorkOrderRow(row) }, 201);
});

app.put('/:id', async (c) => {
  return updateWorkOrder(c);
});

app.patch('/:id', async (c) => {
  return updateWorkOrder(c);
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  await repos.workOrders.delete(c.req.param('id'), auth.tenantId, auth.userId);
  return c.json({ success: true, data: { message: 'Work order deleted' } });
});

export const workOrdersRouter = app;
