/**
 * Parcels API routes - Land parcels CRUD + portions
 * GET /, GET /:id, POST /, PUT /:id, DELETE /:id
 * GET /:id/portions, POST /:id/portions
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

// Schemas
const parcelTypeSchema = z.enum(['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'AGRICULTURAL', 'MIXED_USE']);
const parcelStatusSchema = z.enum(['AVAILABLE', 'ALLOCATED', 'DISPUTED', 'RESERVED', 'SUBDIVIDED']);

const listParcelsQuerySchema = paginationQuerySchema.extend({
  type: parcelTypeSchema.optional(),
  status: parcelStatusSchema.optional(),
  search: z.string().max(200).optional(),
});

const createParcelSchema = z.object({
  parcelNumber: z.string().min(1, 'Parcel number is required').max(100),
  type: parcelTypeSchema,
  status: parcelStatusSchema.default('AVAILABLE'),
  area: z.number().positive('Area must be positive'),
  areaUnit: z.enum(['sqm', 'hectares', 'acres']).default('sqm'),
  address: z.string().min(1).max(500),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  boundaries: z.array(z.object({
    latitude: z.number(),
    longitude: z.number(),
  })).optional(),
  zoning: z.string().max(100).optional(),
  titleDeedNumber: z.string().max(100).optional(),
  ownerId: z.string().optional(),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateParcelSchema = createParcelSchema.partial();

const createPortionSchema = z.object({
  portionNumber: z.string().min(1, 'Portion number is required').max(100),
  area: z.number().positive('Area must be positive'),
  areaUnit: z.enum(['sqm', 'hectares', 'acres']).default('sqm'),
  purpose: z.string().max(200).optional(),
  status: z.enum(['AVAILABLE', 'ALLOCATED', 'RESERVED']).default('AVAILABLE'),
  allocatedTo: z.string().optional(),
  description: z.string().max(2000).optional(),
});

app.use('*', authMiddleware);

// GET /parcels - List parcels with pagination and filters
app.get('/', zValidator('query', listParcelsQuerySchema), (c) => {
  const auth = c.get('auth');
  const { page, pageSize, type, status, search } = c.req.valid('query');

  const parcels: unknown[] = [];

  const paginated = {
    data: parcels,
    pagination: {
      page,
      pageSize,
      total: 0,
      totalPages: 0,
    },
  };

  return c.json({ success: true, ...paginated });
});

// POST /parcels - Create a parcel
app.post(
  '/',
  zValidator('json', createParcelSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const parcel = {
      id: crypto.randomUUID(),
      tenantId: auth.tenantId,
      ...body,
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: parcel }, 201);
  }
);

// GET /parcels/:id - Get parcel by ID
app.get('/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  const parcel = {
    id,
    tenantId: auth.tenantId,
    parcelNumber: '',
    type: 'RESIDENTIAL',
    status: 'AVAILABLE',
    area: 0,
    areaUnit: 'sqm',
    address: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return c.json({ success: true, data: parcel });
});

// PUT /parcels/:id - Update parcel
app.put(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateParcelSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const parcel = {
      id,
      tenantId: auth.tenantId,
      ...body,
      updatedBy: auth.userId,
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: parcel });
  }
);

// DELETE /parcels/:id - Delete parcel
app.delete('/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  return c.json({ success: true, data: { id, deleted: true } });
});

// GET /parcels/:id/portions - List portions for a parcel
app.get('/:id/portions', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  return c.json({ success: true, data: { parcelId: id, portions: [] } });
});

// POST /parcels/:id/portions - Create a portion for a parcel
app.post(
  '/:id/portions',
  zValidator('param', idParamSchema),
  zValidator('json', createPortionSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const portion = {
      id: crypto.randomUUID(),
      parcelId: id,
      tenantId: auth.tenantId,
      ...body,
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: portion }, 201);
  }
);

export const parcelsRouter = app;
