import sw from '@/i18n/sw.json';
import en from '@/i18n/en.json';

/**
 * Lightweight i18n helper.
 *
 * BossNyumba marketing is bilingual sw/en. English is the default;
 * Swahili is opt-in via the `bossnyumba_locale` cookie. We avoid pulling
 * in next-intl/i18next to keep the marketing bundle slim — the strings
 * live in two JSON dictionaries and a single `getMessages()` helper
 * resolves them.
 */

export type Locale = 'sw' | 'en';

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_COOKIE = 'bossnyumba_locale';

export type Messages = typeof sw;

// sw is the structural source of truth for `Messages`. en is the same message
// bag with full key parity, but TS infers slightly different literal/array
// shapes between the two JSON imports (e.g. [] -> never[] vs string[]), so a
// direct cast is rejected as non-overlapping. Both are valid message
// dictionaries at runtime; widen through `unknown` to accept en's inferred shape.
const dictionaries: Record<Locale, Messages> = {
  sw,
  en: en as unknown as Messages,
};

/**
 * Look up the dictionary for a given locale. Falls back to the default
 * locale when an unknown value is passed so the page render never
 * crashes on a missing dictionary.
 */
export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function isLocale(value: unknown): value is Locale {
  return value === 'sw' || value === 'en';
}
