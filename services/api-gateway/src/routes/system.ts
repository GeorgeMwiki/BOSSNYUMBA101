/**
 * System/service health scaffold for admin tooling.
 *
 * Mirrors the top-level /health endpoint but exposes a structured list
 * of downstream service statuses used by the admin portal's system
 * health page (via the `useSystemHealth` hook).
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real store — pull actual uptime / latency / error-rate
// metrics from a monitoring backend.
app.get('/health', (c) => {
  return c.json({ success: true, data: [] });
});

export const systemRouter = app;
