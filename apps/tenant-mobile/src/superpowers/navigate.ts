/**
 * Superpower 1 — navigate (tenant persona).
 *
 * Tenants can jump to lease / maintenance / billing / chat. Admin or
 * landlord-only routes are filtered out client-side.
 */
import { router } from 'expo-router'
import { navigateRequestBus, type NavigateRequestEvent } from './bus'

const TENANT_ALLOWED_PREFIXES: ReadonlyArray<string> = [
  '/(tabs)',
  '/marketplace',
  '/bids',
  '/rfb',
  '/documents',
  '/documents-intel',
  '/chat',
  '/kyc',
  '/profile',
  '/notifications'
]

export interface NavigateTarget {
  readonly route: string
  readonly label: string
  readonly params?: Readonly<Record<string, string>>
}

export function isTenantAllowedRoute(route: string): boolean {
  return TENANT_ALLOWED_PREFIXES.some((p) => route === p || route.startsWith(`${p}/`) || route.startsWith(`${p}?`))
}

export function navigateToTarget(target: NavigateTarget): void {
  if (!isTenantAllowedRoute(target.route)) {
    return
  }
  navigateRequestBus.publish({
    route: target.route,
    ...(target.params ? { params: target.params } : {})
  })
  try {
    if (target.params) {
      router.push({ pathname: target.route, params: target.params })
    } else {
      router.push(target.route)
    }
  } catch {
    // ignore — subscribers can still react
  }
}

export function subscribeNavigateRequest(handler: (e: NavigateRequestEvent) => void): () => void {
  return navigateRequestBus.subscribe(handler)
}

export const DEFAULT_TENANT_TARGETS: ReadonlyArray<NavigateTarget> = [
  { route: '/(tabs)', label: 'Home' },
  { route: '/documents', label: 'My lease & documents' },
  { route: '/chat', label: 'Chat with manager' },
  { route: '/notifications', label: 'Notifications' },
  { route: '/profile', label: 'Profile' }
]
