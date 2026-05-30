/**
 * @bossnyumba/i18n — static translation helper
 *
 * Ported verbatim shape from LitFin (src/core/i18n/getStaticTranslation.ts).
 *
 * For class components, error boundaries, and other non-hook contexts. Reads
 * the current language from localStorage and performs a dot-notation lookup
 * into the supplied dictionary map. Prefer `useTranslation()` everywhere a
 * hook is available.
 */

import type { Language } from "./languages.js";
import type { TranslationDict } from "./LanguageContext.js";

const STORAGE_KEY = "bossnyumba-language";

function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "sw" || stored === "en") return stored;
  } catch {
    // localStorage may be unavailable (SSR / private browsing)
  }
  return "en";
}

/**
 * Translate a dot-notation key without hooks.
 *
 * @param translations  Dictionary map keyed by language code.
 * @param key           Dot-notation key, e.g. "errorPages.unexpected".
 */
export function tStatic(
  translations: Readonly<Record<Language, TranslationDict>>,
  key: string,
): string {
  const lang = getStoredLanguage();
  const dict = translations[lang] ?? translations.en;
  if (!dict) return key;

  const parts = key.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : key;
}
