import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

export function createProtectedLiveDataRouter(feature: string) {
  const app = new Hono();

  app.use('*', authMiddleware);
  app.all('*', (c) =>
    c.json(
      {
        success: false,
        error: {
          code: 'LIVE_DATA_NOT_IMPLEMENTED',
          message: `${feature} is not wired to live production data yet.`,
        },
      },
      503
    )
  );

  return app;
}
