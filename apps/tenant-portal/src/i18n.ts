// next-intl request config — mirrors apps/customer-app/src/i18n.ts.
// Locale resolution: cookie (NEXT_LOCALE) → accept-language → DEFAULT_LOCALE.
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const SUPPORTED_LOCALES = ['en', 'sw'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * Pre-cookie locale parser. Kept on the call-graph for tests and the
 * server hook but always returns DEFAULT_LOCALE per the CLAUDE.md
 * "English default · bilingual sw/en" rule (added 2026-05): we no
 * longer derive Swahili from the browser's accept-language on first
 * visit — users must toggle to `sw` explicitly from the settings panel.
 */
function parseAcceptLanguage(value: string | null | undefined): Locale {
  void value; // accept-language no longer steers the default
  return DEFAULT_LOCALE;
}

export function resolveLocale(cookieValue: string | undefined, acceptLanguage: string | null | undefined): Locale {
  if (cookieValue && (SUPPORTED_LOCALES as readonly string[]).includes(cookieValue)) {
    return cookieValue as Locale;
  }
  return parseAcceptLanguage(acceptLanguage);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const acceptLanguage = headerStore.get('accept-language');
  const locale = resolveLocale(cookieLocale, acceptLanguage);

  const messages = (await import(`../messages/${locale}.json`)).default;
  return {
    locale,
    messages,
  };
});
