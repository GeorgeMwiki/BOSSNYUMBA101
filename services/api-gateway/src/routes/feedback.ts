/**
 * Feedback API routes - Hono with Zod validation
 * POST /, GET /, GET /:id
 * POST /complaints, GET /complaints/:id, PUT /complaints/:id/resolve
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

const submitFeedbackSchema = z.object({
  type: z.enum(['general', 'bug', 'feature', 'improvement']),
  subject: z.string().min(1, 'Subject is required').max(200),
  message: z.string().min(1, 'Message is required').max(5000),
  rating: z.number().int().min(1).max(5).optional(),
  context: z.record(z.unknown()).optional(),
});

const createComplaintSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  category: z.enum(['maintenance', 'neighbor', 'payment', 'lease', 'other']).optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

const resolveComplaintSchema = z.object({
  resolution: z.string().min(1, 'Resolution is required').max(2000),
  resolutionNotes: z.string().max(1000).optional(),
});

const listFeedbackQuerySchema = paginationQuerySchema.extend({
  type: z.enum(['general', 'bug', 'feature', 'improvement']).optional(),
});

const complaintIdParamSchema = z.object({
  id: z.string().min(1, 'Complaint ID is required'),
});

app.use('*', authMiddleware);

// POST /feedback - Submit feedback
app.post(
  '/',
  zValidator('json', submitFeedbackSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const feedback = {
      id: `feedback-${Date.now()}`,
      tenantId: auth.tenantId,
      userId: auth.userId,
      type: body.type,
      subject: body.subject,
      message: body.message,
      rating: body.rating,
      context: body.context ?? {},
      status: 'submitted',
      createdAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: feedback }, 201);
  }
);

// GET /feedback - List feedback
app.get('/', zValidator('query', listFeedbackQuerySchema), (c) => {
  const auth = c.get('auth');
  const { page, pageSize, type } = c.req.valid('query');

  const feedbacks = [
    {
      id: 'feedback-1',
      tenantId: auth.tenantId,
      type: 'general',
      subject: 'Great platform',
      status: 'submitted',
      createdAt: new Date().toISOString(),
    },
  ];

  let filtered = feedbacks.filter((f) => f.tenantId === auth.tenantId);
  if (type) filtered = filtered.filter((f) => f.type === type);

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

// POST /feedback/complaints - Create complaint (must be before /:id)
app.post(
  '/complaints',
  zValidator('json', createComplaintSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const complaint = {
      id: `complaint-${Date.now()}`,
      tenantId: auth.tenantId,
      userId: auth.userId,
      subject: body.subject,
      description: body.description,
      category: body.category ?? 'other',
      relatedEntityType: body.relatedEntityType,
      relatedEntityId: body.relatedEntityId,
      priority: body.priority,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: complaint }, 201);
  }
);

// GET /feedback/complaints/:id - Get complaint
app.get('/complaints/:id', zValidator('param', complaintIdParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  const complaint = {
    id,
    tenantId: auth.tenantId,
    subject: 'Complaint details',
    description: 'Full complaint description',
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  return c.json({ success: true, data: complaint });
});

// PUT /feedback/complaints/:id/resolve - Resolve complaint
app.put(
  '/complaints/:id/resolve',
  zValidator('param', complaintIdParamSchema),
  zValidator('json', resolveComplaintSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const complaint = {
      id,
      tenantId: auth.tenantId,
      status: 'resolved',
      resolution: body.resolution,
      resolutionNotes: body.resolutionNotes,
      resolvedAt: new Date().toISOString(),
      resolvedBy: auth.userId,
    };

    return c.json({ success: true, data: complaint });
  }
);

// GET /feedback/:id - Get feedback (must be after /complaints/:id)
app.get('/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  const feedback = {
    id,
    tenantId: auth.tenantId,
    type: 'general',
    subject: 'Feedback details',
    message: 'Full feedback message',
    status: 'submitted',
    createdAt: new Date().toISOString(),
  };

  return c.json({ success: true, data: feedback });
});

export const feedbackRouter = app;
