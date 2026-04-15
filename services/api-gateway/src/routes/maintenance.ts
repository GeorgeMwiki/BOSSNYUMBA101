/**
 * Maintenance scaffold routes.
 *
 * The customer app posts to `/maintenance/requests` to create a new
 * maintenance ticket. Real work-order creation lives at /work-orders;
 * this route bridges the customer-facing "request" terminology until
 * the client is migrated to the canonical path.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real store — currently echoes the submitted request. The
// UI expects { id } back so it can navigate to the detail page.
app.post('/requests', async (c) => {
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  return c.json(
    {
      success: true,
      data: {
        id: `request-${Date.now()}`,
        tenantId: auth.tenantId,
        userId: auth.userId,
        status: 'submitted',
        createdAt: new Date().toISOString(),
        ...body,
      },
    },
    201
  );
});

export const maintenanceRouter = app;
