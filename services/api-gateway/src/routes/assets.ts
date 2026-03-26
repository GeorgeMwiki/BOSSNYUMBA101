/**
 * Assets API routes - Asset register CRUD
 * GET /, GET /:id, POST /, PUT /:id, DELETE /:id
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
const assetConditionSchema = z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL']);
const occupancyStatusSchema = z.enum(['OCCUPIED', 'VACANT', 'PARTIALLY_OCCUPIED', 'UNDER_MAINTENANCE']);
const assetTypeSchema = z.enum([
  'BUILDING',
  'LAND',
  'INFRASTRUCTURE',
  'EQUIPMENT',
  'VEHICLE',
  'FURNITURE',
  'OTHER',
]);

const listAssetsQuerySchema = paginationQuerySchema.extend({
  condition: assetConditionSchema.optional(),
  occupancyStatus: occupancyStatusSchema.optional(),
  type: assetTypeSchema.optional(),
  search: z.string().max(200).optional(),
});

const createAssetSchema = z.object({
  assetCode: z.string().min(1, 'Asset code is required').max(100),
  name: z.string().min(1, 'Asset name is required').max(200),
  type: assetTypeSchema,
  description: z.string().max(2000).optional(),
  condition: assetConditionSchema.default('GOOD'),
  occupancyStatus: occupancyStatusSchema.optional(),
  location: z.object({
    address: z.string().max(500).optional(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional(),
    propertyId: z.string().optional(),
    unitId: z.string().optional(),
  }).optional(),
  acquisitionDate: z.string().optional(),
  acquisitionCost: z.number().min(0).optional(),
  currentValue: z.number().min(0).optional(),
  depreciationRate: z.number().min(0).max(100).optional(),
  usefulLifeYears: z.number().int().positive().optional(),
  warrantyExpiry: z.string().optional(),
  manufacturer: z.string().max(200).optional(),
  model: z.string().max(200).optional(),
  serialNumber: z.string().max(200).optional(),
  images: z.array(z.string().url()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

const updateAssetSchema = createAssetSchema.partial();

app.use('*', authMiddleware);

// GET /assets - List assets with pagination and filters
app.get('/', zValidator('query', listAssetsQuerySchema), (c) => {
  const auth = c.get('auth');
  const { page, pageSize, condition, occupancyStatus, type, search } = c.req.valid('query');

  const assets: unknown[] = [];

  const paginated = {
    data: assets,
    pagination: {
      page,
      pageSize,
      total: 0,
      totalPages: 0,
    },
  };

  return c.json({ success: true, ...paginated });
});

// POST /assets - Create an asset
app.post(
  '/',
  zValidator('json', createAssetSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const asset = {
      id: crypto.randomUUID(),
      tenantId: auth.tenantId,
      ...body,
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: asset }, 201);
  }
);

// GET /assets/:id - Get asset by ID
app.get('/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  const asset = {
    id,
    tenantId: auth.tenantId,
    assetCode: '',
    name: '',
    type: 'BUILDING',
    condition: 'GOOD',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return c.json({ success: true, data: asset });
});

// PUT /assets/:id - Update asset
app.put(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateAssetSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const asset = {
      id,
      tenantId: auth.tenantId,
      ...body,
      updatedBy: auth.userId,
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: asset });
  }
);

// DELETE /assets/:id - Delete asset
app.delete('/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  return c.json({ success: true, data: { id, deleted: true } });
});

export const assetsRouter = app;
