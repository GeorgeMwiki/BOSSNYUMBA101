/**
 * Analytics API routes - stub endpoints
 * Returns placeholder responses so the mobile app does not crash on 404s.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real analytics data source
app.get('/overview', (c) => {
  return c.json({
    success: true,
    data: {
      revenue: { current: 0, previous: 0, change: 0 },
      occupancy: { rate: 0, change: 0 },
      collections: { rate: 0, change: 0 },
      maintenance: { open: 0, completed: 0, avgResolutionHours: 0 },
    },
  });
});

// TODO: wire to real analytics data source
app.get('/revenue', (c) => {
  return c.json({
    success: true,
    data: { trend: [], summary: { total: 0, projected: 0 } },
  });
});

// TODO: wire to real analytics data source
app.get('/occupancy', (c) => {
  return c.json({
    success: true,
    data: { trend: [], byProperty: [] },
  });
});

export const analyticsRouter = app;
