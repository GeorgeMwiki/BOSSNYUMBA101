import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

// #18 — the API bearer JWT must live in the device keychain
// (`expo-secure-store`: Keychain on iOS, EncryptedSharedPreferences on
// Android), NOT in JS-readable AsyncStorage where any module — or a
// compromised JS bundle — can read it. Mirrors the SecureStore usage in
// `apps/staff-mobile/src/auth/supabaseClient.ts`.
//
// SecureStore keys must match [A-Za-z0-9._-]; the dotted key below already
// satisfies that constraint.
const TOKEN_KEY = 'bossnyumba.auth.token.v1'

// Legacy AsyncStorage key (same value historically). On first read we
// migrate any token still sitting in plaintext AsyncStorage into SecureStore
// and then delete the plaintext copy.
const LEGACY_ASYNC_STORAGE_KEY = 'bossnyumba.auth.token.v1'

interface SessionCache {
  token: string | null
  loaded: boolean
}

const cache: SessionCache = { token: null, loaded: false }

/**
 * One-time migration: if a token still lives in plaintext AsyncStorage from a
 * previous app version, move it into SecureStore and purge the plaintext copy.
 * Returns the migrated token (or null when there was nothing to migrate).
 */
async function migrateLegacyToken(): Promise<string | null> {
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_ASYNC_STORAGE_KEY)
    if (!legacy) {
      return null
    }
    await SecureStore.setItemAsync(TOKEN_KEY, legacy)
    await AsyncStorage.removeItem(LEGACY_ASYNC_STORAGE_KEY)
    return legacy
  } catch (error) {
    console.error('Failed to migrate legacy auth token:', error)
    return null
  }
}

async function ensureLoaded(): Promise<void> {
  if (cache.loaded) {
    return
  }
  try {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY)
    cache.token = stored ?? (await migrateLegacyToken())
  } catch {
    cache.token = null
  } finally {
    cache.loaded = true
  }
}

export async function getAuthToken(): Promise<string | null> {
  await ensureLoaded()
  return cache.token
}

export async function setAuthToken(token: string | null): Promise<void> {
  cache.token = token
  cache.loaded = true
  try {
    // eslint-disable-next-line security/detect-possible-timing-attacks -- reason: comparing to literal null (not a secret); no timing oracle possible
    if (token === null) {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
      return
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token)
  } catch (error) {
    console.error('Failed to persist auth token:', error)
  }
}

export function getCachedAuthToken(): string | null {
  return cache.token
}
