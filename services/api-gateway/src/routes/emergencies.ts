/**
 * Emergency reports scaffold route.
 *
 * Customer app submits an emergency alert (fire, flood, security). No
 * dispatch engine is wired yet; this persists nothing and returns an
 * acknowledgement so the UI can advance to the confirmation screen.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real store — persist + dispatch the emergency alert.
app.post('/', async (c) => {
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  return c.json(
    {
      success: true,
      data: {
        id: `emergency-${Date.now()}`,
        tenantId: auth.tenantId,
        userId: auth.userId,
        status: 'reported',
        createdAt: new Date().toISOString(),
        payload: body,
      },
    },
    201
  );
});

export const emergenciesRouter = app;
