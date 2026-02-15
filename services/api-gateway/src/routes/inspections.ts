/**
 * Inspections API routes - Hono with Zod validation
 * POST /, GET /, GET /:id
 * PUT /:id/start, POST /:id/items, PUT /:id/complete
 * POST /:id/sign, GET /compare
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import {
  idParamSchema,
  paginationQuerySchema,
  validationErrorHook,
} from './validators';
import { z } from 'zod';

const app = new Hono();

const scheduleInspectionSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  unitId: z.string().min(1, 'Unit ID is required'),
  type: z.enum(['move_in', 'move_out', 'periodic', 'maintenance']),
  scheduledAt: z.union([z.string(), z.coerce.date()]),
  customerId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const addItemSchema = z.object({
  room: z.string().min(1, 'Room is required'),
  item: z.string().min(1, 'Item is required'),
  condition: z.enum(['good', 'fair', 'damaged', 'missing']),
  notes: z.string().max(500).optional(),
  photos: z.array(z.string().url()).optional(),
});

const completeInspectionSchema = z.object({
  notes: z.string().max(2000).optional(),
});

const signInspectionSchema = z.object({
  signature: z.string().min(1, 'Signature is required'),
  signedBy: z.string().optional(),
  signedAt: z.string().optional(),
});

const compareInspectionsQuerySchema = z.object({
  inspectionIdA: z.string().min(1),
  inspectionIdB: z.string().min(1),
});

const listInspectionsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  type: z.enum(['move_in', 'move_out', 'periodic', 'maintenance']).optional(),
});

app.use('*', authMiddleware);

// GET /inspections/compare - Must be before /:id
app.get('/compare', zValidator('query', compareInspectionsQuerySchema), (c) => {
  const { inspectionIdA, inspectionIdB } = c.req.valid('query');

  const comparison = {
    inspectionA: inspectionIdA,
    inspectionB: inspectionIdB,
    differences: [
      { room: 'Living Room', item: 'Wall', before: 'good', after: 'damaged' },
    ],
    summary: { totalItems: 15, changed: 1, newDamage: 1 },
  };

  return c.json({ success: true, data: comparison });
});

// POST /inspections - Schedule inspection
app.post(
  '/',
  zValidator('json', scheduleInspectionSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const inspection = {
      id: `inspection-${Date.now()}`,
      tenantId: auth.tenantId,
      propertyId: body.propertyId,
      unitId: body.unitId,
      type: body.type,
      scheduledAt: new Date(body.scheduledAt).toISOString(),
      customerId: body.customerId,
      notes: body.notes,
      status: 'scheduled',
      items: [],
      createdAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: inspection }, 201);
  }
);

// GET /inspections - List inspections
app.get('/', zValidator('query', listInspectionsQuerySchema), (c) => {
  const auth = c.get('auth');
  const { page, pageSize, status, propertyId, unitId, type } = c.req.valid('query');

  const inspections = [
    {
      id: 'inspection-1',
      tenantId: auth.tenantId,
      propertyId: 'property-001',
      unitId: 'unit-001',
      type: 'move_in',
      status: 'completed',
      scheduledAt: new Date().toISOString(),
    },
  ];

  let filtered = inspections.filter((i) => i.tenantId === auth.tenantId);
  if (status) filtered = filtered.filter((i) => i.status === status);
  if (propertyId) filtered = filtered.filter((i) => i.propertyId === propertyId);
  if (unitId) filtered = filtered.filter((i) => i.unitId === unitId);
  if (type) filtered = filtered.filter((i) => i.type === type);

  const paginated = {
    data: filtered.slice((page - 1) * pageSize, page * pageSize),
    pagination: {
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / pageSize),
    },
  };

  return c.json({ success: true, ...paginated });
});

// GET /inspections/:id - Get inspection
app.get('/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  const inspection = {
    id,
    tenantId: auth.tenantId,
    propertyId: 'property-001',
    unitId: 'unit-001',
    type: 'move_in',
    status: 'completed',
    items: [
      { room: 'Living Room', item: 'Walls', condition: 'good' },
    ],
    scheduledAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  return c.json({ success: true, data: inspection });
});

// PUT /inspections/:id/start - Start inspection
app.put('/:id/start', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  return c.json({
    success: true,
    data: {
      id,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    },
  });
});

// POST /inspections/:id/items - Add item
app.post(
  '/:id/items',
  zValidator('param', idParamSchema),
  zValidator('json', addItemSchema, validationErrorHook),
  (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const item = {
      id: `item-${Date.now()}`,
      ...body,
      addedAt: new Date().toISOString(),
    };

    return c.json({
      success: true,
      data: { inspectionId: id, item },
    }, 201);
  }
);

// PUT /inspections/:id/complete - Complete
app.put(
  '/:id/complete',
  zValidator('param', idParamSchema),
  zValidator('json', completeInspectionSchema, validationErrorHook),
  (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        id,
        status: 'completed',
        completedAt: new Date().toISOString(),
        notes: body.notes,
      },
    });
  }
);

// POST /inspections/:id/sign - Sign inspection
app.post(
  '/:id/sign',
  zValidator('param', idParamSchema),
  zValidator('json', signInspectionSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        id,
        signed: true,
        signedBy: body.signedBy ?? auth.userId,
        signedAt: body.signedAt ?? new Date().toISOString(),
      },
    });
  }
);

export const inspectionsRouter = app;
