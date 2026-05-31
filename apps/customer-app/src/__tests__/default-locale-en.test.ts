/**
 * Default-locale guard tests for the customer-app i18n hook.
 *
 * Per CLAUDE.md hard-rule "English default · bilingual sw/en"
 * (commit d57a36df, 2026-05-31): when no cookie is set and no
 * explicit override is supplied, every visitor lands in English.
 * Accept-language sniffing was removed in 2026-05 — the parseAccept
 * helper now ignores its argument and always returns DEFAULT_LOCALE.
 *
 * These tests are the tripwire — they fail BEFORE the build ships if
 * a future edit silently re-introduces Swahili auto-detection.
 *
 * Pure-string assertions only — no DOM, no I/O.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, resolveLocale, SUPPORTED_LOCALES } from '../i18n';

describe('default-locale en — customer-app i18n', () => {
  it('DEFAULT_LOCALE is en', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('resolveLocale returns en when neither cookie nor header is set', () => {
    expect(resolveLocale(undefined, null)).toBe('en');
  });

  it('resolveLocale ignores a Swahili accept-language header (no auto-detect)', () => {
    expect(resolveLocale(undefined, 'sw,sw-TZ;q=0.9,en;q=0.5')).toBe('en');
  });

  it('resolveLocale honours an explicit cookie value', () => {
    expect(resolveLocale('sw', 'en-US,en;q=0.9')).toBe('sw');
    expect(resolveLocale('en', 'sw-TZ')).toBe('en');
  });

  it('SUPPORTED_LOCALES contains exactly en + sw', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(['en', 'sw']);
  });
});
