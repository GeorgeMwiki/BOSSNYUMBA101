/**
 * Analytics scaffold routes.
 *
 * Consumed by both admin portal (platform-wide analytics) and owner portal
 * (scoped analytics). Until an analytics aggregation job is wired, these
 * return the standard envelope with empty / zeroed data so UI can render.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

const windowQuerySchema = z.object({
  window: z.enum(['1d', '7d', '30d', '90d']).default('30d'),
});

const usageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const growthQuerySchema = z.object({
  granularity: z.enum(['day', 'week', 'month']).default('month'),
  periods: z.coerce.number().int().min(1).max(36).default(12),
});

// TODO: wire to real store — platform-wide analytics overview.
app.get('/overview', zValidator('query', windowQuerySchema), (c) => {
  const { window } = c.req.valid('query');
  return c.json({
    success: true,
    data: {
      window,
      totals: { tenants: 0, users: 0, properties: 0, mrr: 0 },
      series: [],
    },
  });
});

// TODO: wire to real store — usage analytics.
app.get('/usage', zValidator('query', usageQuerySchema), (c) => {
  const { days } = c.req.valid('query');
  return c.json({
    success: true,
    data: { days, totalRequests: 0, activeUsers: 0, series: [] },
  });
});

// TODO: wire to real store — growth analytics.
app.get('/growth', zValidator('query', growthQuerySchema), (c) => {
  const { granularity, periods } = c.req.valid('query');
  return c.json({
    success: true,
    data: { granularity, periods, series: [] },
  });
});

// TODO: wire to real store — owner-scoped analytics summary.
app.get('/summary', (c) => {
  return c.json({ success: true, data: { totals: {}, series: [] } });
});

// TODO: wire to real store — occupancy trend.
app.get('/occupancy', (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — expense breakdown.
app.get('/expenses', (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — revenue breakdown.
app.get('/revenue', (c) => {
  return c.json({ success: true, data: [] });
});

export const analyticsRouter = app;
