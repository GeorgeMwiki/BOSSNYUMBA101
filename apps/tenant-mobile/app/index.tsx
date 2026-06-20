import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { ensureAuthReady, isAuthenticated } from '@/auth/session'
import { BnSplash } from '@/ui'

/**
 * Splash gate for the tenant app — branded hold while the session
 * bootstraps, then redirect to login or marketplace.
 *
 * Routing waits for the REAL auth-ready signal (`ensureAuthReady()`), which
 * resolves only once Supabase has hydrated the persisted session from
 * secure storage (or proven there is none). A previous fixed-timer hold
 * could fire before hydration finished and route an already-signed-in
 * tenant to /auth/login (or vice versa).
 */
export default function Index(): JSX.Element {
  const [ready, setReady] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    void ensureAuthReady().then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <BnSplash
        wordmark="BOSSNYUMBA"
        tagline="Soko la Nyumba. Property marketplace."
        showSpinner
      />
    )
  }
  if (!isAuthenticated()) {
    return <Redirect href="/auth/login" />
  }
  return <Redirect href="/marketplace" />
}
