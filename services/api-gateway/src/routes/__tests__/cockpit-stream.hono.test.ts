/**
 * cockpit-stream.hono — smoke test.
 *
 * Verifies the route is wired with the authMiddleware, rejects an
 * unauthenticated client with 401, and exports a default Hono app.
 *
 * The full SSE streaming happy-path is covered by an integration test
 * once the auth shim is available at the api-gateway boot level.
 */
import { describe, expect, it } from 'vitest';

import cockpitStreamRouter from '../cockpit-stream.hono.js';

describe('cockpit-stream.hono router', () => {
  it('rejects a missing bearer with 401', async () => {
    const res = await cockpitStreamRouter.request('/stream');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed bearer with 401', async () => {
    const res = await cockpitStreamRouter.request('/stream', {
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    expect(res.status).toBe(401);
  });
});
