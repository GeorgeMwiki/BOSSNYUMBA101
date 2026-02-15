/**
 * Complaints API routes - Hono with Zod validation
 * POST /complaints, GET /complaints/:id, PUT /complaints/:id/resolve
 * Top-level /complaints routes (also available under /feedback/complaints)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { idParamSchema, validationErrorHook } from './validators';
import { z } from 'zod';

const app = new Hono();

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

app.use('*', authMiddleware);

// POST /complaints - Create complaint
app.post(
  '/',
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

// GET /complaints/:id - Get complaint
app.get('/:id', zValidator('param', idParamSchema), (c) => {
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

// PUT /complaints/:id/resolve - Resolve complaint
app.put(
  '/:id/resolve',
  zValidator('param', idParamSchema),
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

export const complaintsRouter = app;
