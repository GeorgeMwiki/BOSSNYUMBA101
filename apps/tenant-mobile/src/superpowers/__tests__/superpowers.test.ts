import { describe, expect, it, vi } from 'vitest'

/**
 * Tenant-mobile superpowers unit test — navigate + share + bus cleanup.
 */

vi.mock('expo-router', () => ({
  router: { push: vi.fn() }
}))

vi.mock('expo-linking', () => ({
  openURL: vi.fn(async () => true)
}))

vi.mock('@/api/client', () => ({
  apiFetch: vi.fn(async () => ({ success: false }))
}))

vi.mock('react-native', () => ({
  Share: {
    share: vi.fn(async () => ({ action: 'sharedAction' })),
    dismissedAction: 'dismissedAction'
  }
}))

describe('tenant-mobile superpowers/navigate', () => {
  it('allows tenant-scoped routes', async () => {
    const mod = await import('../navigate')
    expect(mod.isTenantAllowedRoute('/documents')).toBe(true)
    expect(mod.isTenantAllowedRoute('/chat')).toBe(true)
    expect(mod.isTenantAllowedRoute('/notifications')).toBe(true)
  })

  it('blocks landlord / admin routes', async () => {
    const mod = await import('../navigate')
    expect(mod.isTenantAllowedRoute('/(landlord)/estate')).toBe(false)
    expect(mod.isTenantAllowedRoute('/admin/audit')).toBe(false)
  })

  it('publishes a navigate request when fired', async () => {
    const { navigateToTarget } = await import('../navigate')
    const { navigateRequestBus } = await import('../bus')
    const handler = vi.fn()
    const unsub = navigateRequestBus.subscribe(handler)
    navigateToTarget({ route: '/documents', label: 'Lease' })
    unsub()
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('tenant-mobile superpowers/share', () => {
  // Contract per commit 61eeb98f "fix(no-fallback)": mobile share no
  // longer mints a hardcoded fallback deep-link when the share-links API
  // is unreachable. A failed API response surfaces { ok: false } with a
  // diagnostic code so the UI can show a real failure (no fake URL leaks).
  it('surfaces ok:false (no fallback url) when the share-links API is offline', async () => {
    const { shareEntity } = await import('../share')
    const res = await shareEntity({ entityType: 'lease', entityId: 'lease-7', title: 'Apartment lease' })
    expect(res.ok).toBe(false)
    expect(res.code).toBe('SHARE_LINK_EMPTY')
    expect(res.url).toBeUndefined()
  })
})
