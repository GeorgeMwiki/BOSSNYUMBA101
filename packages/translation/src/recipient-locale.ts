/**
 * Recipient locale resolution. Mirrors @borjie/translation.
 */

import type { Locale } from './types.js';

const SUPPORTED: ReadonlySet<Locale> = new Set(['sw', 'en']);

export interface RecipientLocaleInputs {
  readonly profilePreferredLanguage?: string | null | undefined;
  readonly tenantDefaultLanguage?: string | null | undefined;
  readonly fallback?: Locale;
}

export function resolveRecipientLocale(inputs: RecipientLocaleInputs): Locale {
  const fallback = inputs.fallback ?? 'en';
  const candidates = [
    inputs.profilePreferredLanguage,
    inputs.tenantDefaultLanguage,
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      const normalised = c.trim().toLowerCase() as Locale;
      if (SUPPORTED.has(normalised)) return normalised;
    }
  }
  return fallback;
}

export function sourceLangFor(targetLang: Locale): Locale {
  return targetLang === 'sw' ? 'en' : 'sw';
}
