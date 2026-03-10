import { Router } from 'express';

export function createLiveDataExpressRouter(feature: string) {
  const router = Router();

  router.all('*', (_req, res) => {
    res.status(503).json({
      success: false,
      error: {
        code: 'LIVE_DATA_NOT_IMPLEMENTED',
        message: `${feature} is not wired to live production data yet.`,
      },
    });
  });

  return router;
}
