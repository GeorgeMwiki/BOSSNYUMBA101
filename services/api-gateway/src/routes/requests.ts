/**
 * Customer-facing requests scaffold routes.
 *
 * Used by the customer app's "maintenance request feedback" form. This
 * complements work-order feedback and covers the case where the app
 * references the generic resident-facing "requests" URL.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real store — post-request feedback from the resident.
app.post('/:id/feedback', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  return c.json(
    {
      success: true,
      data: {
        id: `feedback-${Date.now()}`,
        requestId: id,
        tenantId: auth.tenantId,
        userId: auth.userId,
        createdAt: new Date().toISOString(),
        payload: body,
      },
    },
    201
  );
});

export const requestsRouter = app;
