import { NextRequest, NextResponse } from 'next/server';

import { getIdentityBase, proxyJson, readJsonBody } from '@/lib/proxy';
import { withRateLimit } from '@/lib/with-rate-limit';

/**
 * Platform-staff login proxy.
 *
 * Forwards the JSON body to the identity service's `POST /sessions`
 * (login) endpoint and mirrors the response. The identity service is
 * responsible for setting the session cookie via `Set-Cookie` on the
 * response — Next preserves upstream headers when we use NextResponse
 * with the mirrored body.
 *
 * In production `IDENTITY_URL` must be set; the proxy helper throws if
 * not. In dev it falls back to `http://localhost:4001`.
 */
async function postHandler(req: NextRequest) {
  const body = await readJsonBody(req);
  if (body === null) {
    return NextResponse.json(
      { error: 'json body required' },
      { status: 400 },
    );
  }
  const identityBase = getIdentityBase();
  return proxyJson(`${identityBase}/sessions`, {
    method: 'POST',
    body,
    contentType: 'application/json',
  });
}

// Auth-sensitive endpoint — stricter cap than the default to discourage
// credential stuffing.
export const POST = withRateLimit(postHandler, {
  key: 'platform-login',
  max: 10,
  window: '1m',
});
