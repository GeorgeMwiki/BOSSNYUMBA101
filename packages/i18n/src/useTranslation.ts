"use client";

/**
 * @bossnyumba/i18n — useTranslation hook
 *
 * Ported verbatim shape from LitFin (src/core/i18n/useTranslation.ts).
 */

import { useContext } from "react";
import { LanguageContext, type LanguageContextValue } from "./LanguageContext.js";

/**
 * Hook to access the i18n system.
 *
 * @returns { t, language, setLanguage }
 *
 * @example
 * ```tsx
 * const { t, language, setLanguage } = useTranslation()
 * return <h1>{t('dashboard.welcome')}</h1>
 * ```
 */
export function useTranslation(): LanguageContextValue {
  return useContext(LanguageContext);
}
