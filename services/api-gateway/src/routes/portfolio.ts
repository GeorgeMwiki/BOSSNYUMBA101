/**
 * Portfolio analytics scaffold routes for the owner portal.
 *
 * Placeholder until the portfolio aggregation job is wired. Returns empty
 * { success, data } envelopes so the UI can render skeletons.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real store — portfolio aggregate metrics.
app.get('/summary', (c) => {
  return c.json({
    success: true,
    data: {
      propertiesCount: 0,
      unitsCount: 0,
      occupancyRate: 0,
      monthlyRevenue: 0,
    },
  });
});

// TODO: wire to real store — portfolio growth over time.
app.get('/growth', (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — per-property performance.
app.get('/performance', (c) => {
  return c.json({ success: true, data: [] });
});

export const portfolioRouter = app;
