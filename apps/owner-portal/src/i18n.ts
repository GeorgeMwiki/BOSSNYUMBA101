import type { AbstractIntlMessages } from 'next-intl';
import enMessages from '../messages/en.json';
import swMessages from '../messages/sw.json';

export const SUPPORTED_LOCALES = ['en', 'sw'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const messagesByLocale: Record<Locale, AbstractIntlMessages> = {
  en: enMessages as AbstractIntlMessages,
  sw: swMessages as AbstractIntlMessages,
};

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function parseAcceptLanguage(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE;
  return value.toLowerCase().includes('sw') ? 'sw' : DEFAULT_LOCALE;
}

export function detectInitialLocale(): Locale {
  const cookie = readCookie(LOCALE_COOKIE);
  if (cookie && (SUPPORTED_LOCALES as readonly string[]).includes(cookie)) {
    return cookie as Locale;
  }
  if (typeof navigator !== 'undefined') {
    return parseAcceptLanguage(navigator.language);
  }
  return DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}
