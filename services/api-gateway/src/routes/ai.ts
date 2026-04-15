/**
 * AI operations scaffold routes for the admin portal AI cockpit.
 *
 * No upstream AI decision store exists yet; these endpoints return the
 * standard envelope with empty data so the UI can render its empty state.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { idParamSchema, validationErrorHook } from './validators';

const app = new Hono();
app.use('*', authMiddleware);

const usageQuerySchema = z.object({
  window: z.enum(['1d', '7d', '30d']).default('7d'),
});

const reviewBodySchema = z.object({
  action: z.enum(['approve', 'reject', 'override']),
});

// TODO: wire to real store — list AI decision audit log.
app.get('/decisions', (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — record a human review decision on an AI action.
app.post(
  '/decisions/:id/review',
  zValidator('param', idParamSchema),
  zValidator('json', reviewBodySchema, validationErrorHook),
  (c) => {
    const { id } = c.req.valid('param');
    const { action } = c.req.valid('json');
    return c.json({
      success: true,
      data: { id, action, reviewedAt: new Date().toISOString() },
    });
  }
);

// TODO: wire to real store — AI usage / cost metrics rollup.
app.get('/usage', zValidator('query', usageQuerySchema), (c) => {
  const { window } = c.req.valid('query');
  return c.json({
    success: true,
    data: {
      window,
      requests: 0,
      tokens: 0,
      costCents: 0,
      byModel: [],
      byTenant: [],
    },
  });
});

export const aiRouter = app;
