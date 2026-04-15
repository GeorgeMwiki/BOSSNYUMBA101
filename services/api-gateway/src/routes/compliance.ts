/**
 * Compliance scaffold routes.
 *
 * Used by admin portal (platform compliance overview) and owner portal
 * (portfolio compliance). Stub returns { success, data } so pages render
 * empty states instead of crashing.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real store — platform compliance overview (admin).
app.get('/overview', (c) => {
  return c.json({
    success: true,
    data: { licenses: 0, insurance: 0, openFindings: 0, dataRequests: 0 },
  });
});

// TODO: wire to real store — owner-scoped compliance summary.
app.get('/summary', (c) => {
  return c.json({ success: true, data: {} });
});

// TODO: wire to real store — insurance policies.
app.get('/insurance', (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — compliance inspections.
app.get('/inspections', (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — operating licenses.
app.get('/licenses', (c) => {
  return c.json({ success: true, data: [] });
});

export const complianceRouter = app;
