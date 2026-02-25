'use client';

import React from 'react';
import { useI18n } from './context';
import { SUPPORTED_LOCALES, LOCALE_NAMES } from './types';
import type { Locale } from './types';

/**
 * Language switcher dropdown component.
 * Renders a select element that changes the app locale.
 */
export function LanguageSwitcher({
  className,
  showFlag = true,
}: {
  className?: string;
  showFlag?: boolean;
}) {
  const { locale, setLocale } = useI18n();

  const flags: Record<Locale, string> = {
    en: '\uD83C\uDDEC\uD83C\uDDE7',
    sw: '\uD83C\uDDF9\uD83C\uDDFF',
  };

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className={className}
      aria-label="Select language"
    >
      {SUPPORTED_LOCALES.map((loc) => (
        <option key={loc} value={loc}>
          {showFlag ? `${flags[loc]} ` : ''}
          {LOCALE_NAMES[loc]}
        </option>
      ))}
    </select>
  );
}

/**
 * Translated text component.
 * Usage: <T k="common.nav.home" />
 */
export function T({
  k,
  params,
  as: Component = 'span',
  className,
}: {
  k: string;
  params?: Record<string, string | number>;
  as?: React.ElementType;
  className?: string;
}) {
  const { t } = useI18n();
  return <Component className={className}>{t(k, params)}</Component>;
}
