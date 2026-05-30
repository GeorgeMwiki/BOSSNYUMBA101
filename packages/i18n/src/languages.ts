/**
 * @bossnyumba/i18n — supported languages
 *
 * Ported verbatim shape from LitFin (src/core/i18n/languages.ts). BossNyumba
 * ships English + Swahili first-class, with the LitFin-style 17-language
 * registry retained for future expansion. The product domain is real-estate
 * only — no mining content reaches this package.
 */

export type Language =
  | "en"
  | "sw"
  | "fr"
  | "pt"
  | "es"
  | "de"
  | "ar";

export interface LanguageConfig {
  readonly code: Language;
  readonly name: string;
  readonly nativeName: string;
  readonly rtl: boolean;
}

export const LANGUAGE_REGISTRY: Readonly<Record<Language, LanguageConfig>> = {
  en: { code: "en", name: "English", nativeName: "English", rtl: false },
  sw: { code: "sw", name: "Swahili", nativeName: "Kiswahili", rtl: false },
  fr: { code: "fr", name: "French", nativeName: "Français", rtl: false },
  pt: { code: "pt", name: "Portuguese", nativeName: "Português", rtl: false },
  es: { code: "es", name: "Spanish", nativeName: "Español", rtl: false },
  de: { code: "de", name: "German", nativeName: "Deutsch", rtl: false },
  ar: { code: "ar", name: "Arabic", nativeName: "العربية", rtl: true },
} as const;

export const SUPPORTED_LANGUAGES: readonly Language[] = Object.keys(
  LANGUAGE_REGISTRY,
) as Language[];

export const RTL_LANGUAGES: readonly Language[] = SUPPORTED_LANGUAGES.filter(
  (l) => LANGUAGE_REGISTRY[l].rtl,
);

export function getLanguageConfig(lang: Language): LanguageConfig {
  return LANGUAGE_REGISTRY[lang] ?? LANGUAGE_REGISTRY.en;
}

export function getSupportedLanguages(): readonly LanguageConfig[] {
  return SUPPORTED_LANGUAGES.map((l) => LANGUAGE_REGISTRY[l]);
}

export function isRTL(lang: Language): boolean {
  return LANGUAGE_REGISTRY[lang]?.rtl ?? false;
}
