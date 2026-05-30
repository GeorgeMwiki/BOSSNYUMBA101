"use client";

/**
 * @bossnyumba/i18n — LanguageContext + Provider
 *
 * Ported verbatim shape from LitFin (src/core/i18n/LanguageContext.tsx). The
 * heavy NLP cascade (dynamic translation, language-intelligence graph) lives
 * elsewhere in BN's language-intelligence package — this file ships only the
 * canonical Provider + Context that the rest of the system depends on.
 *
 * Missing-key behaviour matches LitFin: return empty string so QA can see the
 * gap. No hardcoded English fallback.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Language } from "./languages.js";

// ─── Constants ──────────────────────────────────────────────────────

const STORAGE_KEY = "bossnyumba-language";
const DEFAULT_LANGUAGE: Language = "en";

// ─── Types ──────────────────────────────────────────────────────────

export type TranslationDict = Readonly<Record<string, unknown>>;

export interface LanguageContextValue {
  /** Current language code */
  readonly language: Language;
  /** Set a new language (persists to localStorage) */
  readonly setLanguage: (lang: Language) => void;
  /** Translate a dot-notation key, e.g. t('nav.dashboard') */
  readonly t: (
    key: string,
    vars?: Readonly<Record<string, string | number>>,
  ) => string;
}

// ─── Context ────────────────────────────────────────────────────────

export const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: () => "",
});

// ─── Resolve helper (pure, no mutation) ─────────────────────────────

function resolveKey(obj: TranslationDict, key: string): string {
  const parts = key.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      reportMissingKey(key);
      return "";
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (typeof current === "string") return current;
  reportMissingKey(key);
  return "";
}

const reportedMissingKeys = new Set<string>();
function reportMissingKey(key: string): void {
  if (typeof window === "undefined") return;
  const flag = (
    window as unknown as { __BOSSNYUMBA_LOG_MISSING_I18N__?: boolean }
  ).__BOSSNYUMBA_LOG_MISSING_I18N__;
  if (!flag) return;
  if (reportedMissingKeys.has(key)) return;
  reportedMissingKeys.add(key);
  // eslint-disable-next-line no-console -- intentional boundary log; structured logger not wired here
  console.warn(`[i18n] missing translation: ${key}`);
}

function interpolate(
  template: string,
  vars?: Readonly<Record<string, string | number>>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  );
}

// ─── Read initial language from localStorage (SSR-safe) ─────────────

function readInitialLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "sw" || stored === "en") return stored;
  } catch {
    // localStorage may be unavailable (SSR / private mode)
  }
  return DEFAULT_LANGUAGE;
}

// ─── Provider ───────────────────────────────────────────────────────

export interface LanguageProviderProps {
  readonly children: ReactNode;
  /**
   * Translation dictionaries keyed by language code. The active language
   * dictionary is consulted on every `t(...)` call. Producing the dictionary
   * is the host app's responsibility — see apps/marketing/src/i18n/{en,sw}.json.
   */
  readonly translations: Readonly<Record<Language, TranslationDict>>;
  readonly initialLanguage?: Language;
}

export function LanguageProvider({
  children,
  translations,
  initialLanguage,
}: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(
    initialLanguage ?? DEFAULT_LANGUAGE,
  );

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = readInitialLanguage();
    if (stored !== language) setLanguageState(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // ignore
      }
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Readonly<Record<string, string | number>>) => {
      const dict = translations[language] ?? translations[DEFAULT_LANGUAGE];
      const raw = resolveKey(dict ?? {}, key);
      return interpolate(raw, vars);
    },
    [language, translations],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
