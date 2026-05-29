/**
 * device-push-tokens — smoke + payload-validation tests.
 */
import { describe, expect, it } from 'vitest';

import devicePushTokensRouter from '../device-push-tokens.hono.js';

describe('device-push-tokens.hono router', () => {
  it('rejects unauthenticated POST with 401', async () => {
    const res = await devicePushTokensRouter.request('/', {
      method: 'POST',
      body: JSON.stringify({ platform: 'ios', app: 'tenant-mobile' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated GET /mine with 401', async () => {
    const res = await devicePushTokensRouter.request('/mine');
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated DELETE with 401', async () => {
    const res = await devicePushTokensRouter.request('/abc', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });
});
