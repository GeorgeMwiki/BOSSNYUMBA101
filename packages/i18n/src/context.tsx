'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { Locale, TranslationDictionary } from './types';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './types';
import { en } from './translations/en';
import { sw } from './translations/sw';

const dictionaries: Record<Locale, TranslationDictionary> = { en, sw };

type I18nContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationFn;
  dict: TranslationDictionary;
  dir: 'ltr' | 'rtl';
};

type TranslationFn = (key: string, params?: Record<string, string | number>) => string;

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(obj: unknown, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return path;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : path;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
  });
}

function detectLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = localStorage.getItem('bossnyumba-locale');
  if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
    return stored as Locale;
  }
  const browserLang = navigator.language.split('-')[0];
  if (SUPPORTED_LOCALES.includes(browserLang as Locale)) {
    return browserLang as Locale;
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({
  children,
  defaultLocale,
}: {
  children: React.ReactNode;
  defaultLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale ?? DEFAULT_LOCALE);

  useEffect(() => {
    if (!defaultLocale) {
      setLocaleState(detectLocale());
    }
  }, [defaultLocale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bossnyumba-locale', newLocale);
      document.documentElement.lang = newLocale;
    }
  }, []);

  const dict = dictionaries[locale];

  const t: TranslationFn = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const value = getNestedValue(dict, key);
      return interpolate(value, params);
    },
    [dict]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      dict,
      dir: 'ltr' as const,
    }),
    [locale, setLocale, t, dict]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export function useT(): TranslationFn {
  return useI18n().t;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

export function useSetLocale(): (locale: Locale) => void {
  return useI18n().setLocale;
}

export function useDict(): TranslationDictionary {
  return useI18n().dict;
}
