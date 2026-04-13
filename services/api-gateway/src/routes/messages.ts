/**
 * Messages API routes - stub endpoint for tenant messages threads
 * Returns placeholder responses so the mobile app does not crash on 404s.
 * Note: The main messaging routes are under /messaging/conversations.
 * This provides a /messages/threads alias used by the customer app.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real data source (alias for /messaging/conversations)
app.get('/threads', (c) => {
  return c.json({
    success: true,
    data: [],
    pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
  });
});

// TODO: wire to real data source
app.get('/threads/:id', (c) => {
  const id = c.req.param('id');
  return c.json({
    success: true,
    data: {
      id,
      messages: [],
      participants: [],
    },
  });
});

// TODO: wire to real data source
app.post('/threads/:id/messages', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  return c.json({
    success: true,
    data: {
      id: `msg-${Date.now()}`,
      threadId: id,
      content: body.content || '',
      createdAt: new Date().toISOString(),
    },
  }, 201);
});

export const messagesRouter = app;
