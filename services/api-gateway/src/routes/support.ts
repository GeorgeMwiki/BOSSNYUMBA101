/**
 * Customer support scaffold routes for the admin portal.
 *
 * Real case / escalation storage lives in the (future) support service.
 * Until that is wired, these endpoints return the standard envelope with
 * empty collections so UI pages don't crash on an unset backend.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { idParamSchema, validationErrorHook } from './validators';

const app = new Hono();
app.use('*', authMiddleware);

const escalateBodySchema = z.object({
  level: z.number().int().min(1).max(5),
  reason: z.string().min(1).max(2000),
});

const resolveBodySchema = z.object({
  note: z.string().min(1).max(2000),
});

const escalationListQuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'all']).default('open'),
  priority: z.enum(['any', 'p1', 'p2', 'p3']).default('any'),
});

const timelineQuerySchema = z.object({
  category: z.enum(['all', 'auth', 'payment', 'ticket', 'system']).default('all'),
});

// TODO: wire to real store — list support cases.
app.get('/cases', (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — escalate a support case.
app.post(
  '/cases/:id/escalate',
  zValidator('param', idParamSchema),
  zValidator('json', escalateBodySchema, validationErrorHook),
  (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    return c.json({
      success: true,
      data: {
        id,
        escalationLevel: body.level,
        reason: body.reason,
        escalatedAt: new Date().toISOString(),
      },
    });
  }
);

// TODO: wire to real store — list escalations.
app.get('/escalations', zValidator('query', escalationListQuerySchema), (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — mark an escalation as resolved.
app.post(
  '/escalations/:id/resolve',
  zValidator('param', idParamSchema),
  zValidator('json', resolveBodySchema, validationErrorHook),
  (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    return c.json({
      success: true,
      data: {
        id,
        status: 'resolved',
        note: body.note,
        resolvedAt: new Date().toISOString(),
      },
    });
  }
);

// TODO: wire to real store — customer support timeline events.
app.get(
  '/customers/:id/timeline',
  zValidator('param', idParamSchema),
  zValidator('query', timelineQuerySchema),
  (c) => {
    return c.json({ success: true, data: [] });
  }
);

export const supportRouter = app;
