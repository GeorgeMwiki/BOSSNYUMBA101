/**
 * Maintenance Requests API routes - Module F
 * POST /api/v1/maintenance/requests - Submit maintenance request
 * GET  /api/v1/maintenance/requests - List requests with filters
 * GET  /api/v1/maintenance/requests/:id - Get request details
 * PATCH /api/v1/maintenance/requests/:id - Update request status
 * POST /api/v1/maintenance/work-orders - Create work order
 * POST /api/v1/maintenance/work-orders/:id/dispatch - Dispatch to vendor
 * POST /api/v1/maintenance/work-orders/:id/complete - Complete with proof
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/hono-auth';
import { validationErrorHook } from '../validators';

const app = new Hono();

// Schemas
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const statusSchema = z.enum(['submitted', 'acknowledged', 'in_review', 'approved', 'work_order_created', 'in_progress', 'completed', 'closed', 'rejected', 'cancelled']);
const prioritySchema = z.enum(['low', 'medium', 'high', 'emergency']);
const categorySchema = z.enum(['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'pest_control', 'security', 'cleaning', 'landscaping', 'general']);

const listSchema = paginationSchema.extend({
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  category: categorySchema.optional(),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  customerId: z.string().optional(),
});

const submitSchema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().min(1),
  customerId: z.string().optional(),
  category: categorySchema,
  priority: prioritySchema.default('medium'),
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  attachments: z.array(z.object({ type: z.string(), url: z.string().url(), description: z.string().optional() })).max(10).optional(),
  contactPhone: z.string().max(50).optional(),
});

const updateSchema = z.object({
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  assignedTo: z.string().optional(),
  internalNotes: z.string().max(2000).optional(),
});

const idSchema = z.object({ id: z.string().min(1) });

const dispatchSchema = z.object({
  vendorId: z.string().min(1),
  scheduledDate: z.string().min(1),
  scheduledTimeSlot: z.enum(['morning', 'afternoon', 'evening']).optional(),
  instructions: z.string().max(2000).optional(),
  notifyCustomer: z.boolean().default(true),
});

const completeSchema = z.object({
  completionNotes: z.string().min(1).max(2000),
  actualCost: z.number().min(0).optional(),
  laborHours: z.number().min(0).optional(),
  proofOfCompletion: z.array(z.object({ type: z.string(), url: z.string().url() })).min(1),
  requiresFollowUp: z.boolean().default(false),
});

// In-memory storage
interface Request {
  id: string; tenantId: string; propertyId: string; unitId: string; customerId?: string;
  category: string; priority: string; status: string; title: string; description: string;
  attachments: any[]; contactPhone?: string; assignedTo?: string; workOrderId?: string;
  internalNotes?: string; createdAt: string; createdBy: string; updatedAt: string; updatedBy: string;
}

interface WorkOrder {
  id: string; tenantId: string; maintenanceRequestId: string; propertyId: string; unitId: string;
  vendorId?: string; status: string; scheduledDate?: string; scheduledTimeSlot?: string;
  estimatedCost?: number; actualCost?: number; instructions?: string; completionNotes?: string;
  proofOfCompletion?: any[]; requiresFollowUp: boolean; dispatchedAt?: string; completedAt?: string;
  createdAt: string; createdBy: string; updatedAt: string; updatedBy: string;
}

const requests = new Map<string, Request>();
const workOrders = new Map<string, WorkOrder>();

// Seed demo
requests.set('mreq-001', {
  id: 'mreq-001', tenantId: 'tenant-001', propertyId: 'property-001', unitId: 'unit-001',
  customerId: 'customer-001', category: 'plumbing', priority: 'high', status: 'in_progress',
  title: 'Kitchen sink leak', description: 'Water leaking from under kitchen sink', attachments: [],
  createdAt: '2026-02-10T08:00:00Z', createdBy: 'customer-001', updatedAt: '2026-02-11T10:00:00Z', updatedBy: 'user-002',
});

// Helpers
const genId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
const paginate = <T>(items: T[], page: number, size: number) => {
  const total = items.length, pages = Math.ceil(total / size), start = (page - 1) * size;
  return { data: items.slice(start, start + size), pagination: { page, pageSize: size, totalItems: total, totalPages: pages } };
};

app.use('*', authMiddleware);

// POST /requests
app.post('/requests', zValidator('json', submitSchema, validationErrorHook), (c) => {
  const auth = c.get('auth'), body = c.req.valid('json'), now = new Date().toISOString();
  const req: Request = {
    id: genId('mreq'), tenantId: auth.tenantId, ...body, status: 'submitted',
    attachments: body.attachments ?? [], createdAt: now, createdBy: auth.userId, updatedAt: now, updatedBy: auth.userId,
  };
  requests.set(req.id, req);
  return c.json({ success: true, data: { ...req, trackingNumber: req.id } }, 201);
});

// GET /requests
app.get('/requests', zValidator('query', listSchema), (c) => {
  const auth = c.get('auth'), q = c.req.valid('query');
  let items = [...requests.values()].filter(r => r.tenantId === auth.tenantId);
  if (q.status) items = items.filter(r => r.status === q.status);
  if (q.priority) items = items.filter(r => r.priority === q.priority);
  if (q.category) items = items.filter(r => r.category === q.category);
  if (q.propertyId) items = items.filter(r => r.propertyId === q.propertyId);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return c.json({ success: true, ...paginate(items, q.page, q.pageSize) });
});

// GET /requests/:id
app.get('/requests/:id', zValidator('param', idSchema), (c) => {
  const auth = c.get('auth'), { id } = c.req.valid('param');
  const req = requests.get(id);
  if (!req || req.tenantId !== auth.tenantId) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  return c.json({ success: true, data: { ...req, workOrder: req.workOrderId ? workOrders.get(req.workOrderId) : null } });
});

// PATCH /requests/:id
app.patch('/requests/:id', zValidator('param', idSchema), zValidator('json', updateSchema, validationErrorHook), (c) => {
  const auth = c.get('auth'), { id } = c.req.valid('param'), body = c.req.valid('json'), now = new Date().toISOString();
  const req = requests.get(id);
  if (!req || req.tenantId !== auth.tenantId) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  Object.assign(req, body, { updatedAt: now, updatedBy: auth.userId });
  requests.set(id, req);
  return c.json({ success: true, data: req });
});

// POST /work-orders
app.post('/work-orders', zValidator('json', z.object({ maintenanceRequestId: z.string().min(1), vendorId: z.string().optional(), estimatedCost: z.number().min(0).optional() }), validationErrorHook), (c) => {
  const auth = c.get('auth'), body = c.req.valid('json'), now = new Date().toISOString();
  const req = requests.get(body.maintenanceRequestId);
  if (!req || req.tenantId !== auth.tenantId) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  if (req.workOrderId) return c.json({ success: false, error: { code: 'CONFLICT', message: 'Work order exists' } }, 409);
  const wo: WorkOrder = {
    id: genId('wo'), tenantId: auth.tenantId, maintenanceRequestId: body.maintenanceRequestId,
    propertyId: req.propertyId, unitId: req.unitId, vendorId: body.vendorId,
    status: body.vendorId ? 'assigned' : 'pending', estimatedCost: body.estimatedCost, requiresFollowUp: false,
    createdAt: now, createdBy: auth.userId, updatedAt: now, updatedBy: auth.userId,
  };
  workOrders.set(wo.id, wo);
  req.workOrderId = wo.id; req.status = 'work_order_created'; req.updatedAt = now; requests.set(req.id, req);
  return c.json({ success: true, data: { workOrder: wo, maintenanceRequest: req } }, 201);
});

// POST /work-orders/:id/dispatch
app.post('/work-orders/:id/dispatch', zValidator('param', idSchema), zValidator('json', dispatchSchema, validationErrorHook), (c) => {
  const auth = c.get('auth'), { id } = c.req.valid('param'), body = c.req.valid('json'), now = new Date().toISOString();
  const wo = workOrders.get(id);
  if (!wo || wo.tenantId !== auth.tenantId) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  Object.assign(wo, body, { status: 'dispatched', dispatchedAt: now, updatedAt: now, updatedBy: auth.userId });
  workOrders.set(id, wo);
  const req = requests.get(wo.maintenanceRequestId);
  if (req) { req.status = 'in_progress'; req.assignedTo = body.vendorId; req.updatedAt = now; requests.set(req.id, req); }
  return c.json({ success: true, data: { workOrder: wo, dispatchedAt: now } });
});

// POST /work-orders/:id/complete
app.post('/work-orders/:id/complete', zValidator('param', idSchema), zValidator('json', completeSchema, validationErrorHook), (c) => {
  const auth = c.get('auth'), { id } = c.req.valid('param'), body = c.req.valid('json'), now = new Date().toISOString();
  const wo = workOrders.get(id);
  if (!wo || wo.tenantId !== auth.tenantId) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  if (wo.status === 'completed') return c.json({ success: false, error: { code: 'CONFLICT', message: 'Already completed' } }, 409);
  Object.assign(wo, body, { status: 'completed', completedAt: now, updatedAt: now, updatedBy: auth.userId });
  workOrders.set(id, wo);
  const req = requests.get(wo.maintenanceRequestId);
  if (req) { req.status = 'completed'; req.updatedAt = now; requests.set(req.id, req); }
  return c.json({ success: true, data: { workOrder: wo, maintenanceRequest: req } });
});

// GET /work-orders/:id
app.get('/work-orders/:id', zValidator('param', idSchema), (c) => {
  const auth = c.get('auth'), { id } = c.req.valid('param');
  const wo = workOrders.get(id);
  if (!wo || wo.tenantId !== auth.tenantId) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  return c.json({ success: true, data: { ...wo, maintenanceRequest: requests.get(wo.maintenanceRequestId) ?? null } });
});

export const maintenanceRequestsRouter = app;
