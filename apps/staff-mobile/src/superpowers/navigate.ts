/**
 * Superpower 1 — navigate (staff persona).
 *
 * Staff = maintenance worker / field op. Allowed routes are the
 * worker / manager tabs and the photo-advisor surface. Owner-only
 * routes are filtered out client-side.
 */
import { router } from 'expo-router'
import { navigateRequestBus, type NavigateRequestEvent } from './bus'

const STAFF_ALLOWED_PREFIXES: ReadonlyArray<string> = [
  '/(tabs)',
  '/(worker)',
  '/(manager)',
  '/worker',
  '/manager',
  '/photo-advisor',
  '/documents',
  '/notifications',
  '/onboarding'
]

export interface NavigateTarget {
  readonly route: string
  readonly label: string
  readonly params?: Readonly<Record<string, string>>
}

export function isStaffAllowedRoute(route: string): boolean {
  return STAFF_ALLOWED_PREFIXES.some((p) => route === p || route.startsWith(`${p}/`) || route.startsWith(`${p}?`))
}

export function navigateToTarget(target: NavigateTarget): void {
  if (!isStaffAllowedRoute(target.route)) {
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
    // ignore navigation errors — bus subscribers can still react.
  }
}

export function subscribeNavigateRequest(handler: (e: NavigateRequestEvent) => void): () => void {
  return navigateRequestBus.subscribe(handler)
}

export const DEFAULT_STAFF_TARGETS: ReadonlyArray<NavigateTarget> = [
  { route: '/(tabs)', label: 'Home' },
  { route: '/(worker)/tickets', label: 'My tickets' },
  { route: '/(worker)/inspections', label: 'Inspections' },
  { route: '/photo-advisor', label: 'Photo advisor' },
  { route: '/notifications', label: 'Notifications' }
]
