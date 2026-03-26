/**
 * Applications API routes - Applications CRUD + workflow
 * GET /, GET /:id, POST /, PUT /:id
 * POST /:id/forward, POST /:id/approve, POST /:id/reject
 * GET /:id/routing
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
const applicationStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'FORWARDED',
  'APPROVED',
  'REJECTED',
  'RETURNED',
  'CANCELLED',
]);

const applicationTypeSchema = z.enum([
  'NEW_LEASE',
  'LEASE_RENEWAL',
  'LEASE_TRANSFER',
  'SUBDIVISION',
  'REZONING',
  'BUILDING_PERMIT',
  'CHANGE_OF_USE',
]);

const listApplicationsQuerySchema = paginationQuerySchema.extend({
  status: applicationStatusSchema.optional(),
  type: applicationTypeSchema.optional(),
  search: z.string().max(200).optional(),
});

const createApplicationSchema = z.object({
  type: applicationTypeSchema,
  referenceNumber: z.string().max(100).optional(),
  applicantName: z.string().min(1, 'Applicant name is required').max(200),
  applicantEmail: z.string().email().optional(),
  applicantPhone: z.string().max(50).optional(),
  applicantIdNumber: z.string().max(50).optional(),
  parcelId: z.string().optional(),
  propertyId: z.string().optional(),
  description: z.string().max(5000).optional(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    type: z.string().optional(),
  })).default([]),
  formData: z.record(z.unknown()).optional(),
});

const updateApplicationSchema = createApplicationSchema.partial();

const forwardApplicationSchema = z.object({
  forwardTo: z.string().min(1, 'Forward-to user/department is required'),
  comments: z.string().max(2000).optional(),
  priority: z.enum(['normal', 'urgent']).default('normal'),
});

const approveApplicationSchema = z.object({
  comments: z.string().max(2000).optional(),
  conditions: z.array(z.string()).default([]),
  effectiveDate: z.string().optional(),
});

const rejectApplicationSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(2000),
  comments: z.string().max(2000).optional(),
});

app.use('*', authMiddleware);

// GET /applications - List applications with pagination and filters
app.get('/', zValidator('query', listApplicationsQuerySchema), (c) => {
  const auth = c.get('auth');
  const { page, pageSize, status, type, search } = c.req.valid('query');

  const applications: unknown[] = [];

  const paginated = {
    data: applications,
    pagination: {
      page,
      pageSize,
      total: 0,
      totalPages: 0,
    },
  };

  return c.json({ success: true, ...paginated });
});

// POST /applications - Create/digitize an application
app.post(
  '/',
  zValidator('json', createApplicationSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const application = {
      id: crypto.randomUUID(),
      tenantId: auth.tenantId,
      referenceNumber: body.referenceNumber ?? `APP-${Date.now()}`,
      status: 'SUBMITTED' as const,
      ...body,
      submittedBy: auth.userId,
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: application }, 201);
  }
);

// GET /applications/:id - Get application by ID
app.get('/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  const application = {
    id,
    tenantId: auth.tenantId,
    type: 'NEW_LEASE',
    status: 'SUBMITTED',
    referenceNumber: '',
    applicantName: '',
    description: '',
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return c.json({ success: true, data: application });
});

// PUT /applications/:id - Update application
app.put(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateApplicationSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const application = {
      id,
      tenantId: auth.tenantId,
      ...body,
      updatedBy: auth.userId,
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: application });
  }
);

// POST /applications/:id/forward - Forward application to another department/user
app.post(
  '/:id/forward',
  zValidator('param', idParamSchema),
  zValidator('json', forwardApplicationSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = {
      id,
      status: 'FORWARDED',
      forwardedTo: body.forwardTo,
      forwardedBy: auth.userId,
      forwardedAt: new Date().toISOString(),
      comments: body.comments,
      priority: body.priority,
    };

    return c.json({ success: true, data: result });
  }
);

// POST /applications/:id/approve - Approve application
app.post(
  '/:id/approve',
  zValidator('param', idParamSchema),
  zValidator('json', approveApplicationSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = {
      id,
      status: 'APPROVED',
      approvedBy: auth.userId,
      approvedAt: new Date().toISOString(),
      comments: body.comments,
      conditions: body.conditions,
      effectiveDate: body.effectiveDate,
    };

    return c.json({ success: true, data: result });
  }
);

// POST /applications/:id/reject - Reject application
app.post(
  '/:id/reject',
  zValidator('param', idParamSchema),
  zValidator('json', rejectApplicationSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = {
      id,
      status: 'REJECTED',
      rejectedBy: auth.userId,
      rejectedAt: new Date().toISOString(),
      reason: body.reason,
      comments: body.comments,
    };

    return c.json({ success: true, data: result });
  }
);

// GET /applications/:id/routing - Get application routing history
app.get('/:id/routing', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  return c.json({
    success: true,
    data: {
      applicationId: id,
      routingHistory: [],
      currentAssignee: null,
    },
  });
});

export const applicationsRouter = app;
