/**
 * Budgets scaffold routes for the owner portal.
 *
 * No budgeting service exists yet; these endpoints return the standard
 * envelope with empty data so the UI renders skeletons.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real store — portfolio budget summary.
app.get('/summary', (c) => {
  return c.json({
    success: true,
    data: { totalBudget: 0, totalSpent: 0, variance: 0 },
  });
});

// TODO: wire to real store — budget forecasts.
app.get('/forecasts', (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — per-property budget detail.
app.get('/:propertyId', (c) => {
  const propertyId = c.req.param('propertyId');
  return c.json({
    success: true,
    data: { propertyId, budget: 0, spent: 0, categories: [] },
  });
});

export const budgetsRouter = app;
