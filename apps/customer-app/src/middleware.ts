import { NextResponse, type NextRequest } from 'next/server';

import { LOCALE_COOKIE, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './i18n';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (existing && (SUPPORTED_LOCALES as readonly string[]).includes(existing)) {
    return response;
  }

  const header = request.headers.get('accept-language') ?? '';
  const detected = header.toLowerCase().includes('sw') ? 'sw' : DEFAULT_LOCALE;

  response.cookies.set(LOCALE_COOKIE, detected, {
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    sameSite: 'lax',
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/|api/|.*\\..*).*)'],
};
