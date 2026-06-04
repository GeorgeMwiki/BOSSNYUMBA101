import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { isAuthenticated } from '@/auth/session'
import { LitFinSplash } from '@/ui-litfin'

/**
 * Splash gate for the tenant app — branded hold while the session
 * bootstraps, then redirect to login or marketplace.
 */
export default function Index() {
  const [ready, setReady] = useState<boolean>(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 280)
    return () => clearTimeout(t)
  }, [])
  if (!ready) {
    return <LitFinSplash wordmark="BOSSNYUMBA" tagline="Soko la Nyumba. Property marketplace." showSpinner />
  }
  if (!isAuthenticated()) {
    return <Redirect href="/auth/login" />
  }
  return <Redirect href="/marketplace" />
}
