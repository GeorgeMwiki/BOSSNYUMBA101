import { NextResponse, type NextRequest } from 'next/server';

import { LOCALE_COOKIE, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './i18n';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (existing && (SUPPORTED_LOCALES as readonly string[]).includes(existing)) {
    return response;
  }

  // English default per CLAUDE.md "English default · bilingual sw/en"
  // (added 2026-05). We no longer auto-detect Swahili from the
  // accept-language header on first launch — users must explicitly
  // toggle to `sw` from the settings panel. Toggle is absolute.
  void request.headers.get('accept-language'); // intentionally unused
  const detected = DEFAULT_LOCALE;

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
