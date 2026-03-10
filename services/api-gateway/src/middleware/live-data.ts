import { createMiddleware } from 'hono/factory';

export function liveDataRequired(feature: string) {
  return createMiddleware(async (c) => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    return c.json(
      {
        success: false,
        error: {
          code: 'LIVE_DATA_NOT_IMPLEMENTED',
          message: `${feature} is not wired to live production data yet.`,
        },
      },
      503
    );
  });
}
