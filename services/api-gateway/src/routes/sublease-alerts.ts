/**
 * Sublease Alerts API routes - Sublease monitoring
 * GET /, GET /:id, POST /
 * POST /:id/investigate, POST /:id/confirm, POST /:id/dismiss, POST /:id/resolve
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
const alertStatusSchema = z.enum([
  'NEW',
  'INVESTIGATING',
  'CONFIRMED',
  'DISMISSED',
  'RESOLVED',
]);

const alertSourceSchema = z.enum([
  'MANUAL_REPORT',
  'FIELD_INSPECTION',
  'SYSTEM_DETECTION',
  'COMMUNITY_TIP',
  'ONLINE_LISTING',
]);

const listAlertsQuerySchema = paginationQuerySchema.extend({
  status: alertStatusSchema.optional(),
  source: alertSourceSchema.optional(),
});

const createAlertSchema = z.object({
  source: alertSourceSchema,
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  parcelId: z.string().optional(),
  leaseId: z.string().optional(),
  tenantName: z.string().max(200).optional(),
  suspectedSublessee: z.string().max(200).optional(),
  description: z.string().min(1, 'Description is required').max(5000),
  evidenceUrls: z.array(z.string().url()).default([]),
  listingUrl: z.string().url().optional(),
  reportedBy: z.string().max(200).optional(),
  reportedDate: z.string().optional(),
  location: z.object({
    address: z.string().max(500).optional(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional(),
  }).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  metadata: z.record(z.unknown()).optional(),
});

const investigateSchema = z.object({
  assignedTo: z.string().min(1, 'Investigator assignment is required'),
  notes: z.string().max(2000).optional(),
  priority: z.enum(['normal', 'urgent']).default('normal'),
});

const confirmSchema = z.object({
  findings: z.string().min(1, 'Findings are required').max(5000),
  evidenceUrls: z.array(z.string().url()).default([]),
  recommendedAction: z.string().max(1000).optional(),
});

const dismissSchema = z.object({
  reason: z.string().min(1, 'Dismissal reason is required').max(2000),
  notes: z.string().max(2000).optional(),
});

const resolveSchema = z.object({
  resolution: z.string().min(1, 'Resolution is required').max(2000),
  actionTaken: z.string().max(2000).optional(),
  penaltyApplied: z.boolean().default(false),
  penaltyAmount: z.number().min(0).optional(),
  leaseTerminated: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
});

app.use('*', authMiddleware);

// GET /sublease-alerts - List alerts with filters
app.get('/', zValidator('query', listAlertsQuerySchema), (c) => {
  const auth = c.get('auth');
  const { page, pageSize, status, source } = c.req.valid('query');

  const alerts: unknown[] = [];

  const paginated = {
    data: alerts,
    pagination: {
      page,
      pageSize,
      total: 0,
      totalPages: 0,
    },
  };

  return c.json({ success: true, ...paginated });
});

// POST /sublease-alerts - Create an alert
app.post(
  '/',
  zValidator('json', createAlertSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const alert = {
      id: crypto.randomUUID(),
      tenantId: auth.tenantId,
      status: 'NEW' as const,
      ...body,
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: alert }, 201);
  }
);

// GET /sublease-alerts/:id - Get alert by ID
app.get('/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  const alert = {
    id,
    tenantId: auth.tenantId,
    status: 'NEW',
    source: 'MANUAL_REPORT',
    description: '',
    severity: 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return c.json({ success: true, data: alert });
});

// POST /sublease-alerts/:id/investigate - Start investigation
app.post(
  '/:id/investigate',
  zValidator('param', idParamSchema),
  zValidator('json', investigateSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = {
      id,
      status: 'INVESTIGATING',
      assignedTo: body.assignedTo,
      investigationStartedAt: new Date().toISOString(),
      investigationStartedBy: auth.userId,
      notes: body.notes,
      priority: body.priority,
    };

    return c.json({ success: true, data: result });
  }
);

// POST /sublease-alerts/:id/confirm - Confirm sublease violation
app.post(
  '/:id/confirm',
  zValidator('param', idParamSchema),
  zValidator('json', confirmSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = {
      id,
      status: 'CONFIRMED',
      confirmedBy: auth.userId,
      confirmedAt: new Date().toISOString(),
      findings: body.findings,
      evidenceUrls: body.evidenceUrls,
      recommendedAction: body.recommendedAction,
    };

    return c.json({ success: true, data: result });
  }
);

// POST /sublease-alerts/:id/dismiss - Dismiss alert
app.post(
  '/:id/dismiss',
  zValidator('param', idParamSchema),
  zValidator('json', dismissSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = {
      id,
      status: 'DISMISSED',
      dismissedBy: auth.userId,
      dismissedAt: new Date().toISOString(),
      reason: body.reason,
      notes: body.notes,
    };

    return c.json({ success: true, data: result });
  }
);

// POST /sublease-alerts/:id/resolve - Resolve alert
app.post(
  '/:id/resolve',
  zValidator('param', idParamSchema),
  zValidator('json', resolveSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = {
      id,
      status: 'RESOLVED',
      resolvedBy: auth.userId,
      resolvedAt: new Date().toISOString(),
      ...body,
    };

    return c.json({ success: true, data: result });
  }
);

export const subleaseAlertsRouter = app;
