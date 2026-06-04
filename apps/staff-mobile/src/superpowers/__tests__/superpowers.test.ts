import { describe, expect, it, vi } from 'vitest'

/**
 * Staff-mobile superpowers unit test — navigate + share + bus cleanup.
 */

vi.mock('expo-router', () => ({
  router: { push: vi.fn() }
}))

vi.mock('expo-linking', () => ({
  openURL: vi.fn(async () => true)
}))

vi.mock('../../api/client', () => ({
  managerApi: {
    get: vi.fn(async () => ({ success: false })),
    post: vi.fn(async () => ({ success: false }))
  }
}))

vi.mock('react-native', () => ({
  Share: {
    share: vi.fn(async () => ({ action: 'sharedAction' })),
    dismissedAction: 'dismissedAction'
  }
}))

describe('staff-mobile superpowers/navigate', () => {
  it('allows staff-scoped routes', async () => {
    const mod = await import('../navigate')
    expect(mod.isStaffAllowedRoute('/(worker)/tickets')).toBe(true)
    expect(mod.isStaffAllowedRoute('/(manager)/dispatch')).toBe(true)
    expect(mod.isStaffAllowedRoute('/photo-advisor')).toBe(true)
  })

  it('blocks owner / landlord-only routes', async () => {
    const mod = await import('../navigate')
    expect(mod.isStaffAllowedRoute('/(owner)/strategy')).toBe(false)
    expect(mod.isStaffAllowedRoute('/(landlord)/portfolio')).toBe(false)
  })

  it('publishes a navigate request for allowed targets', async () => {
    const { navigateToTarget } = await import('../navigate')
    const { navigateRequestBus } = await import('../bus')
    const handler = vi.fn()
    const unsub = navigateRequestBus.subscribe(handler)
    navigateToTarget({ route: '/(worker)/tickets', label: 'Tickets' })
    unsub()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('drops a publish for a blocked route', async () => {
    const { navigateToTarget } = await import('../navigate')
    const { navigateRequestBus } = await import('../bus')
    const handler = vi.fn()
    const unsub = navigateRequestBus.subscribe(handler)
    navigateToTarget({ route: '/(landlord)/portfolio', label: 'Nope' })
    unsub()
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('staff-mobile superpowers/share', () => {
  it('returns ok + fallback url when the API is offline', async () => {
    const { shareEntity } = await import('../share')
    const res = await shareEntity({ entityType: 'ticket', entityId: 'tkt-7', title: 'Replace tap' })
    expect(res.ok).toBe(true)
    expect(res.url).toContain('ticket/tkt-7')
  })
})
