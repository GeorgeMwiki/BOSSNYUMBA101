/**
 * Communications scaffold routes for the admin portal.
 *
 * Broadcast / campaign lifecycle isn't yet wired to a notification engine.
 * These return the standard envelope with empty data so the UI renders.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real store — list broadcasts.
app.get('/broadcasts', (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — cancel an in-flight broadcast.
app.post('/broadcasts/:id/cancel', (c) => {
  const id = c.req.param('id');
  return c.json({
    success: true,
    data: { id, status: 'cancelled', cancelledAt: new Date().toISOString() },
  });
});

// TODO: wire to real store — list campaigns.
app.get('/campaigns', (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — list templates.
app.get('/templates', (c) => {
  return c.json({ success: true, data: [] });
});

export const communicationsRouter = app;
