/**
 * Utilities scaffold routes.
 *
 * Accepts meter reading submissions from the customer app. A real
 * implementation lives in @bossnyumba/database packages/utilities.repository
 * but isn't yet wired here; scaffold accepts + echoes.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real store — persist reading via utilities repository.
app.post('/readings', async (c) => {
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  return c.json(
    {
      success: true,
      data: {
        id: `reading-${Date.now()}`,
        tenantId: auth.tenantId,
        submittedBy: auth.userId,
        submittedAt: new Date().toISOString(),
        ...body,
      },
    },
    201
  );
});

export const utilitiesRouter = app;
