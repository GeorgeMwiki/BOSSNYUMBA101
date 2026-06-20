/**
 * Tenant-mobile language-preference store.
 *
 * The Supabase JWT does NOT carry a language claim, so a user's sw/en toggle
 * must be persisted client-side to survive a cold start. Without this, every
 * cold boot reprojects the session with a hard-coded `'en'` and silently
 * resets a Swahili user back to English.
 *
 * English remains the default (CLAUDE.md): when nothing is persisted we
 * resolve to `'en'`, never `'sw'`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { LanguageCode } from '@/types/auth'

const LANG_KEY = 'bossnyumba.tenant.preferredLang.v1'

function isLanguageCode(value: unknown): value is LanguageCode {
  return value === 'sw' || value === 'en'
}

/**
 * Reads the persisted language, or `null` when none is stored (or the read
 * fails). Callers fall back to the English default on `null`.
 */
export async function loadPreferredLang(): Promise<LanguageCode | null> {
  try {
    const raw = await AsyncStorage.getItem(LANG_KEY)
    return isLanguageCode(raw) ? raw : null
  } catch {
    return null
  }
}

/**
 * Persists the active language. Best-effort — a write failure never blocks
 * the UI; the in-memory session remains the source of truth for this run.
 */
export async function savePreferredLang(lang: LanguageCode): Promise<void> {
  try {
    await AsyncStorage.setItem(LANG_KEY, lang)
  } catch {
    // Best-effort — the in-memory session still reflects the choice.
  }
}
