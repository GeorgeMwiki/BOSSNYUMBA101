import { NextResponse, type NextRequest } from 'next/server';

import { PLATFORM_SESSION_COOKIE } from './lib/session';
import { safeRedirectTarget } from './lib/safe-redirect';
import { verifyPlatformSession } from './lib/session-verifier';

/**
 * Gate every route on a valid platform-staff session cookie.
 *
 * Exemptions:
 *   - `/login` — where staff obtain a session
 *   - `/api/platform/health` — liveness probe for the ops mesh
 *   - `/api/platform/login` — the login route itself (must be reachable
 *     pre-auth so the login form can POST)
 *   - static Next assets (excluded via matcher below)
 *
 * When the cookie is missing OR fails server-side verification on a
 * protected path, users are redirected to `/login` with a `next=` param
 * so we can bounce them back after auth.
 *
 * Round-3 finding M-4: previously this middleware admitted any non-empty
 * cookie value. It now defers to `verifyPlatformSession()` which calls
 * the identity service `/sessions/verify` endpoint (with a TTL cache to
 * amortise the cost). The downstream identity-service re-check on every
 * API call is still the source of truth — this middleware now matches
 * that level of rigour BEFORE leaking page chrome / analytics events.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPublicPath =
    pathname === '/login' ||
    pathname === '/api/platform/health' ||
    pathname === '/api/platform/login';

  if (isPublicPath) {
    return NextResponse.next();
  }

  const session = request.cookies.get(PLATFORM_SESSION_COOKIE)?.value;
  if (session && session.length > 0) {
    const valid = await verifyPlatformSession(session, PLATFORM_SESSION_COOKIE);
    if (valid) {
      return NextResponse.next();
    }
  }

  // Validate the `next` target before persisting it in the redirect
  // URL. Same allow-list LoginForm enforces — closes round-3 C-2.
  const requestedTarget = pathname + search;
  const safeNext = safeRedirectTarget(requestedTarget, '/');
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = `?next=${encodeURIComponent(safeNext)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Protect every path except Next internals and static files.
  matcher: ['/((?!_next/|favicon.ico|.*\\..*).*)'],
};
