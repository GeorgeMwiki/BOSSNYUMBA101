/**
 * @bossnyumba/i18n — Public API
 *
 * BossNyumba i18n primitives, ported from LitFin canonical shape
 * (iter-51-finlit-phase-1). English + Swahili first-class; LitFin-style
 * 7-language registry retained so the surface stays expansion-ready.
 *
 * Verbatim port discipline:
 *  - LitFin `@litfin/i18n` -> `@bossnyumba/i18n`
 *  - Storage key `litfin-language` -> `bossnyumba-language`
 *  - Diagnostic flag `__LITFIN_LOG_MISSING_I18N__` -> `__BOSSNYUMBA_LOG_MISSING_I18N__`
 */

export { LanguageProvider, LanguageContext } from "./LanguageContext.js";
export type {
  LanguageContextValue,
  LanguageProviderProps,
  TranslationDict,
} from "./LanguageContext.js";

export { useTranslation } from "./useTranslation.js";
export { tStatic } from "./getStaticTranslation.js";

export {
  getLanguageConfig,
  getSupportedLanguages,
  isRTL,
  LANGUAGE_REGISTRY,
  SUPPORTED_LANGUAGES,
  RTL_LANGUAGES,
} from "./languages.js";
export type { Language, LanguageConfig } from "./languages.js";
