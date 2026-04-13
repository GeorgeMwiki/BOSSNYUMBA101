/**
 * Memberships API routes - stub endpoints
 * Returns placeholder responses so the mobile app does not crash on 404s.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real data source
app.get('/', (c) => {
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
      status: 'active',
      plan: 'basic',
      createdAt: new Date().toISOString(),
    },
  });
});

// TODO: wire to real data source
app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({
    success: true,
    data: {
      id: `membership-${Date.now()}`,
      ...body,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  }, 201);
});

export const membershipsRouter = app;
