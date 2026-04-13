/**
 * Devices API routes - stub endpoint for push notification device registration
 * Returns placeholder responses so the mobile app does not crash on 404s.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real push notification service (FCM, APNs)
app.post('/register', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));

  return c.json({
    success: true,
    data: {
      deviceId: `device-${Date.now()}`,
      userId: auth.userId,
      token: body.token,
      platform: body.platform || 'unknown',
      registeredAt: new Date().toISOString(),
    },
  });
});

// TODO: wire to real push notification service
app.delete('/unregister', async (c) => {
  const body = await c.req.json().catch(() => ({}));

  return c.json({
    success: true,
    data: {
      token: body.token,
      unregisteredAt: new Date().toISOString(),
    },
  });
});

export const devicesRouter = app;
