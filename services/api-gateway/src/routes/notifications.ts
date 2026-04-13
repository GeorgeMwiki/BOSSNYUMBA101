/**
 * Notifications API routes - stub endpoints for mobile companion app
 * Provides placeholder responses so the Flutter app does not crash on 404s.
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
app.get('/unread-count', (c) => {
  return c.json({ success: true, data: { count: 0 } });
});

// TODO: wire to real data source
app.post('/:id/read', (c) => {
  const id = c.req.param('id');
  return c.json({ success: true, data: { id, read: true, readAt: new Date().toISOString() } });
});

// TODO: wire to real data source
app.post('/read-all', (c) => {
  return c.json({ success: true, data: { count: 0 } });
});

// TODO: wire to real data source
app.get('/preferences', (c) => {
  return c.json({
    success: true,
    data: {
      email: true,
      sms: false,
      push: true,
      whatsapp: false,
      categories: {},
    },
  });
});

// TODO: wire to real data source
app.put('/preferences', async (c) => {
  const body = await c.req.json();
  return c.json({ success: true, data: body });
});

// TODO: wire to real data source
app.post('/devices', async (c) => {
  const body = await c.req.json();
  return c.json({
    success: true,
    data: {
      token: body.token,
      platform: body.platform,
      registeredAt: new Date().toISOString(),
    },
  });
});

// TODO: wire to real data source
app.delete('/devices/:token', (c) => {
  return c.json({ success: true, data: { message: 'Device unregistered' } });
});

export const notificationsRouter = app;
