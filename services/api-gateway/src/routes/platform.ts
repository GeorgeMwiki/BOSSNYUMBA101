/**
 * Platform management scaffold routes for the admin portal.
 *
 * Feature flags, billing overview, subscriptions overview — these are
 * stubs until a real configuration / billing service is wired. Returns
 * the standard { success, data } envelope with empty / placeholder data.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { validationErrorHook } from './validators';

const app = new Hono();
app.use('*', authMiddleware);

const flagPatchBodySchema = z.object({
  enabled: z.boolean(),
});

const flagKeyParamSchema = z.object({
  key: z.string().min(1),
});

// TODO: wire to real store — list platform-wide feature flags.
app.get('/feature-flags', (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — toggle a feature flag.
app.patch(
  '/feature-flags/:key',
  zValidator('param', flagKeyParamSchema),
  zValidator('json', flagPatchBodySchema, validationErrorHook),
  (c) => {
    const { key } = c.req.valid('param');
    const { enabled } = c.req.valid('json');
    return c.json({
      success: true,
      data: { key, enabled, updatedAt: new Date().toISOString() },
    });
  }
);

// TODO: wire to real store — platform billing summary.
app.get('/billing', (c) => {
  return c.json({
    success: true,
    data: {
      currentPeriod: { start: null, end: null, totalCents: 0 },
      invoices: [],
      payouts: [],
    },
  });
});

// TODO: wire to real store — retry a failed tenant invoice payment.
app.post('/billing/:tenantId/retry', (c) => {
  const tenantId = c.req.param('tenantId');
  return c.json({
    success: true,
    data: { tenantId, retriedAt: new Date().toISOString(), status: 'queued' },
  });
});

// TODO: wire to real store — platform-wide overview dashboard.
app.get('/overview', (c) => {
  return c.json({
    success: true,
    data: {
      totals: { tenants: 0, users: 0, mrr: 0, activeProperties: 0 },
      recent: [],
    },
  });
});

// TODO: wire to real store — subscriptions list.
app.get('/subscriptions', (c) => {
  return c.json({ success: true, data: [] });
});

export const platformRouter = app;
