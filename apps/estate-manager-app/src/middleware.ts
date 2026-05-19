import { NextResponse, type NextRequest } from 'next/server';

import { LOCALE_COOKIE, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './i18n';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Estate-manager-app has no public surface — there is no in-app signup
 * (managers are provisioned via the owner/admin onboarding flow). Every
 * route is therefore "protected" and must NOT be cached at the CDN edge.
 *
 * Closes round-3 audit finding **M-5**: the previous middleware only set
 * a locale cookie. We now also stamp `x-bn-route-class: protected` and a
 * strict `Cache-Control: private, no-store` header so even if a Server
 * Component on this app accidentally fetched tenant data without a
 * session (the actual auth lives in localStorage — H-1 deferred), the
 * payload cannot leak across users via shared cache.
 *
 * The `/brain/*` API route is the one path we must permit unconditionally
 * (it handles its own auth at the route-handler layer) but it is already
 * excluded by the matcher below.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // ---- 1. Locale cookie (existing) -------------------------------------
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (!existing || !(SUPPORTED_LOCALES as readonly string[]).includes(existing)) {
    const header = request.headers.get('accept-language') ?? '';
    const detected = header.toLowerCase().includes('sw') ? 'sw' : DEFAULT_LOCALE;
    response.cookies.set(LOCALE_COOKIE, detected, {
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
      sameSite: 'lax',
    });
  }

  // ---- 2. Route-class header + cache hardening (M-5) -------------------
  response.headers.set('x-bn-route-class', 'protected');
  response.headers.set(
    'Cache-Control',
    'private, no-store, no-cache, must-revalidate, max-age=0',
  );
  response.headers.set('Pragma', 'no-cache');

  return response;
}

export const config = {
  matcher: ['/((?!_next/|api/|.*\\..*).*)'],
};
