/**
 * Approvals API routes - stub endpoints for the approvals queue
 * Returns placeholder responses so the mobile app does not crash on 404s.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real data source
app.get('/', (c) => {
  const status = c.req.query('status') || 'pending';
  return c.json({
    success: true,
    data: [],
    pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
  });
});

// TODO: wire to real data source
app.get('/:id', (c) => {
  const id = c.req.param('id');
  return c.json({
    success: true,
    data: {
      id,
      status: 'pending',
      type: 'work_order',
      requestedAt: new Date().toISOString(),
      requestedBy: null,
      details: {},
    },
  });
});

// TODO: wire to real data source
app.post('/:id/approve', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  return c.json({
    success: true,
    data: {
      id,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: auth.userId,
      comments: body.comments || undefined,
    },
  });
});

// TODO: wire to real data source
app.post('/:id/reject', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  return c.json({
    success: true,
    data: {
      id,
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: auth.userId,
      reason: body.reason || undefined,
    },
  });
});

export const approvalsRouter = app;
