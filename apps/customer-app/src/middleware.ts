import { NextResponse, type NextRequest } from 'next/server';

import { LOCALE_COOKIE, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './i18n';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

/**
 * Public route prefixes. Any path NOT matching one of these is treated as
 * authenticated and gets a strict `Cache-Control` header so SSR responses
 * cannot leak across users via a CDN. The actual auth check still happens
 * client-side because the customer-app uses a localStorage bearer
 * (H-1 deferred). Server Components on these protected paths MUST NOT
 * fetch tenant data without a session — closes round-3 finding M-3 by
 * making the routing intent explicit and preventing accidental caching.
 */
const PUBLIC_PREFIXES: readonly string[] = [
  '/auth',
  '/blog',
  '/for-managers',
  '/for-owners',
  '/for-station-masters',
  '/for-tenants',
  '/how-it-works',
  '/pricing',
  '/marketplace',
  '/compare',
  '/community',
  '/offline',
  '/error',
  '/not-found',
  '/favicon.ico',
  '/manifest.json',
  '/icons',
];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next();

  // ---- 1. Locale cookie hydration (existing) -----------------------------
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

  // ---- 2. Route-class header + cache hardening (M-3) ---------------------
  const isPublic = isPublicPath(pathname);
  response.headers.set('x-bn-route-class', isPublic ? 'public' : 'protected');

  if (!isPublic) {
    // Defence-in-depth: even if a future Server Component on a protected
    // route forgot to opt out of caching, the CDN/edge cache MUST treat
    // the response as user-private. `no-store` prevents any cache layer
    // from holding the payload.
    response.headers.set(
      'Cache-Control',
      'private, no-store, no-cache, must-revalidate, max-age=0'
    );
    response.headers.set('Pragma', 'no-cache');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/|api/|.*\\..*).*)'],
};
