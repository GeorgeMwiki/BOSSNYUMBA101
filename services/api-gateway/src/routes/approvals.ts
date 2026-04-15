/**
 * Approvals scaffold routes for the owner portal.
 *
 * Approval inbox (for expenses, vendor proposals, etc.) isn't yet
 * backed by a real store. Scaffold returns the standard envelope with
 * empty data so the owner approvals screen can render its empty state.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { idParamSchema, validationErrorHook } from './validators';

const app = new Hono();
app.use('*', authMiddleware);

const decisionBodySchema = z.object({
  note: z.string().max(2000).optional(),
  reason: z.string().max(2000).optional(),
});

// TODO: wire to real store — list pending approvals for the signed-in owner.
app.get('/', (c) => {
  return c.json({ success: true, data: [] });
});

// TODO: wire to real store — approve an item.
app.post(
  '/:id/approve',
  zValidator('param', idParamSchema),
  zValidator('json', decisionBodySchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    return c.json({
      success: true,
      data: {
        id,
        decision: 'approved',
        note: body.note,
        decidedBy: auth.userId,
        decidedAt: new Date().toISOString(),
      },
    });
  }
);

// TODO: wire to real store — reject an item.
app.post(
  '/:id/reject',
  zValidator('param', idParamSchema),
  zValidator('json', decisionBodySchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    return c.json({
      success: true,
      data: {
        id,
        decision: 'rejected',
        reason: body.reason,
        decidedBy: auth.userId,
        decidedAt: new Date().toISOString(),
      },
    });
  }
);

export const approvalsRouter = app;
