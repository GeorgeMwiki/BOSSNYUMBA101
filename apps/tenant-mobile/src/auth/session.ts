import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { clearAuthToken, setAuthToken } from './token'
import { getSupabaseClient } from './supabaseClient'
import { parseSupabaseTokenForTenant } from './tenantClaims'
import { loadPreferredLang, savePreferredLang } from './lang-preference'
import type { LanguageCode, TenantUser } from '@/types/auth'
import { registerPushToken } from '@/lib/notifications/push-register'

// Reactive in-memory session store, backed by Supabase phone OTP.
// The mobile UI consumes `useSession()` — when Supabase emits a session
// change (sign-in, refresh, sign-out), we project it to a TenantUser and
// notify subscribers so React components re-render.
//
// The `role` value is an app-internal sentinel (`'tenant'`) type-locked to
// `TenantRole`; it is never sent to the server (the Supabase JWT is the
// canonical auth and is parsed FROM the gateway).
//
// `GUEST_USER` is the unauthenticated sentinel: it contains no PII and is
// only used to keep screens that read `user.preferredLang` (i18n) and
// `user.id` (KYC route param) from crashing before the user signs in.
// Routing guards must use `isAuthenticated()` to redirect to /auth/login.

const GUEST_USER: TenantUser = {
  id: '',
  role: 'tenant',
  companyName: '',
  countryCode: 'TZ',
  preferredLang: 'en',
  kycStatus: 'pending',
  phone: ''
}

type Listener = (user: TenantUser | null) => void

let currentUser: TenantUser | null = null
let bootstrapped = false
const listeners = new Set<Listener>()

// Locale persistence: the JWT carries no language claim, so the user's sw/en
// choice is hydrated from AsyncStorage on cold boot and applied when we
// project the session. `null` until hydrated, which falls back to the English
// default (CLAUDE.md), never Swahili.
let persistedLang: LanguageCode | null = null

// Resolves once the Supabase session has been read from storage on cold
// boot (or the bootstrap has failed and we know there is no session).
// The splash gate awaits THIS instead of a fixed timer so it never routes
// to the wrong stack by reading `isAuthenticated()` before the persisted
// session has hydrated.
let resolveAuthReady: () => void
const authReadyPromise: Promise<void> = new Promise<void>((resolve) => {
  resolveAuthReady = resolve
})
let authReadySettled = false

function settleAuthReady(): void {
  if (authReadySettled) return
  authReadySettled = true
  resolveAuthReady()
}

function emit(): void {
  for (const listener of listeners) {
    listener(currentUser)
  }
}

function projectSession(session: Session | null): TenantUser | null {
  if (!session) return null
  const accessToken = session.access_token
  const claims = parseSupabaseTokenForTenant(accessToken)
  if (!claims) return null
  const phone = (claims.phone ?? session.user.phone ?? '').replace(/\s+/g, '')
  const phoneFormatted = phone.startsWith('+') ? phone : phone.length > 0 ? `+${phone}` : ''
  const companyName =
    (session.user.user_metadata?.company_name as string | undefined) ?? 'Tenant'
  return {
    id: claims.userId || session.user.id,
    role: 'tenant',
    companyName,
    countryCode: 'TZ',
    // Honour the persisted language toggle; fall back to the English default
    // (CLAUDE.md) only when nothing has been stored yet.
    preferredLang: persistedLang ?? 'en',
    kycStatus: 'pending',
    phone: phoneFormatted
  }
}

async function ensureBootstrapped(): Promise<void> {
  if (bootstrapped) return
  bootstrapped = true
  try {
    // Hydrate the language toggle BEFORE projecting the session so a Swahili
    // user is not transiently reset to English on cold boot.
    persistedLang = await loadPreferredLang()
    const supabase = getSupabaseClient()
    const { data } = await supabase.auth.getSession()
    const next = projectSession(data.session)
    if (next) {
      currentUser = next
      if (data.session) {
        await setAuthToken(data.session.access_token)
        // Fire-and-forget push registration on cold-boot — keeps the
        // device token fresh in `device_push_tokens`. Never blocks app boot.
        void registerPushToken()
      }
    }
    supabase.auth.onAuthStateChange((_event, session) => {
      const projected = projectSession(session)
      currentUser = projected
      if (session) {
        void setAuthToken(session.access_token)
        // Sign-in or token-refresh — push the latest device token so
        // any new user_id mapping is recorded server-side.
        void registerPushToken()
      } else {
        void clearAuthToken()
      }
      emit()
    })
    emit()
  } catch {
    // Bootstrap failed (e.g. missing env in dev) — leave currentUser null;
    // subscribers will render unauthenticated state.
  } finally {
    // Either the persisted session hydrated or we proved there is none —
    // the routing decision is now safe to make.
    settleAuthReady()
  }
}

/**
 * Resolves once the auth bootstrap has settled (session hydrated from
 * storage, or confirmed absent). Routing gates MUST await this before
 * reading `isAuthenticated()` so a cold boot never races the persisted
 * session and lands on the wrong stack.
 */
export function ensureAuthReady(): Promise<void> {
  void ensureBootstrapped()
  return authReadyPromise
}

export function getCurrentUser(): TenantUser {
  return currentUser ?? GUEST_USER
}

export function isAuthenticated(): boolean {
  return Boolean(currentUser?.id)
}

export function setCurrentUser(user: TenantUser): void {
  currentUser = user
  // Persist the language so the toggle survives a cold start.
  if (persistedLang !== user.preferredLang) {
    persistedLang = user.preferredLang
    void savePreferredLang(user.preferredLang)
  }
  emit()
}

export function setPreferredLang(lang: TenantUser['preferredLang']): void {
  if (!currentUser) {
    return
  }
  persistedLang = lang
  void savePreferredLang(lang)
  currentUser = { ...currentUser, preferredLang: lang }
  emit()
}

export async function logout(): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
  } catch {
    // ignore — local state is the source of truth for the UI
  }
  currentUser = null
  await clearAuthToken()
  emit()
}

export interface OtpResult {
  readonly error?: string
}

function normaliseE164(phone: string): string {
  return phone.replace(/\s+/g, '')
}

export async function sendTenantOtp(phoneE164: string): Promise<OtpResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signInWithOtp({
      phone: normaliseE164(phoneE164)
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'send_otp_failed' }
  }
}

export async function verifyTenantOtp(
  phoneE164: string,
  code: string
): Promise<OtpResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.verifyOtp({
      phone: normaliseE164(phoneE164),
      token: code,
      type: 'sms'
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'verify_otp_failed' }
  }
}

export function subscribe(listener: Listener): () => void {
  void ensureBootstrapped()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSession(): TenantUser {
  const [user, setUser] = useState<TenantUser>(() => getCurrentUser())
  useEffect(() => subscribe((next) => setUser(next ?? GUEST_USER)), [])
  return user
}
