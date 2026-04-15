/**
 * Admin scaffold routes
 *
 * Top-level helpers used by the admin portal that aren't yet backed by
 * dedicated upstream services. These return the standard { success, data }
 * envelope with empty/placeholder shapes so the UI can render skeletons
 * without crashing.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real store — aggregate downstream service health.
app.get('/health/services', (c) => {
  return c.json({ success: true, data: [] });
});

export const adminRouter = app;
