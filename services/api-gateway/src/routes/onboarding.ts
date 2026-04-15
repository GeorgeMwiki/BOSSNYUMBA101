/**
 * Onboarding scaffold routes.
 *
 * Customer onboarding is still in design; these endpoints return the
 * standard envelope with placeholder data so the customer app can
 * progress through its onboarding screens without hitting 503s.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real store — compute current onboarding progress.
app.get('/status', (c) => {
  const auth = c.get('auth');
  return c.json({
    success: true,
    data: {
      userId: auth.userId,
      step: 'welcome',
      completed: false,
      stepsCompleted: [],
      stepsRemaining: ['welcome', 'profile', 'payment', 'inspection', 'complete'],
    },
  });
});

// TODO: wire to real store — record completion of a named step.
app.post('/steps/:step', async (c) => {
  const step = c.req.param('step');
  const body = await c.req.json().catch(() => ({}));
  return c.json({
    success: true,
    data: {
      step,
      recordedAt: new Date().toISOString(),
      payload: body,
    },
  });
});

// TODO: wire to real store — record move-in inspection acknowledgement.
app.post('/inspection', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ success: true, data: { acknowledged: true, payload: body } });
});

// TODO: wire to real store — mark onboarding complete.
app.post('/complete', async (c) => {
  const auth = c.get('auth');
  return c.json({
    success: true,
    data: { userId: auth.userId, completed: true, completedAt: new Date().toISOString() },
  });
});

export const onboardingRouter = app;
