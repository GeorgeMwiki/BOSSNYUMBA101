import { NextResponse, type NextRequest } from 'next/server';

import { PLATFORM_SESSION_COOKIE } from './lib/session';

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
 * When the cookie is missing on a protected path, users are redirected
 * to `/login` with a `next=` param so we can bounce them back after auth.
 *
 * ⚠️ SECURITY — READ BEFORE TRUSTING THIS GATE. Cookie PRESENCE is a UX
 * redirect ONLY; it is NOT authentication. This middleware does NOT validate
 * the session token (the `/sessions/verify` integration is an open TODO — see
 * `src/lib/session.ts` + Docs/TODO_BACKLOG.md). A forged non-empty cookie
 * passes this gate and renders the HQ shell. The ONLY real authorization is the
 * api-gateway, which independently enforces a verified JWT + `isPlatformAdmin`
 * on every `/api/platform/*` data route. THEREFORE: every page/route that reads
 * data MUST go through the JWT-gated gateway — NEVER read tenant/HQ data using
 * only this cookie, or it will leak to any unauthenticated caller.
 */
export function middleware(request: NextRequest) {
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
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Protect every path except Next internals and static files.
  matcher: ['/((?!_next/|favicon.ico|.*\\..*).*)'],
};
