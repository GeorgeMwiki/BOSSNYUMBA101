import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Live detector for the tenant cold-start auth-ready signal.
 *
 * Regression guarded: the splash gate used a fixed 280ms timer, read
 * `isAuthenticated()` once, and could route to the wrong stack when the
 * persisted Supabase session had not yet hydrated. `ensureAuthReady()`
 * must resolve ONLY after the real bootstrap settles — gated on the
 * `getSession()` promise, not on wall-clock time — and must reflect the
 * hydrated session by the time it resolves.
 */

// Deferred getSession so the test controls exactly when bootstrap settles.
// A mutable holder lets each test install a fresh deferred (reset in
// beforeEach) without the hoisted mock closing over stale promise state.
const holder = vi.hoisted(() => {
  const make = (): {
    promise: Promise<unknown>
    resolve: (v: unknown) => void
  } => {
    let resolve: (v: unknown) => void = () => undefined
    const promise = new Promise<unknown>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }
  return {
    current: make(),
    make,
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  }
})

vi.mock('@/auth/supabaseClient', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: vi.fn(() => holder.current.promise),
      onAuthStateChange: holder.onAuthStateChange,
      signOut: vi.fn(async () => ({ error: null })),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async () => ({ error: null })),
    },
  }),
}))

vi.mock('@/auth/token', () => ({
  setAuthToken: vi.fn(async () => undefined),
  clearAuthToken: vi.fn(async () => undefined),
}))

vi.mock('@/lib/notifications/push-register', () => ({
  registerPushToken: vi.fn(async () => ({ registered: false })),
}))

// A real-shaped JWT so projectSession yields a non-null user.
function makeJwt(): string {
  const b64 = (o: unknown): string =>
    Buffer.from(JSON.stringify(o)).toString('base64url')
  const header = b64({ alg: 'HS256' })
  const payload = b64({
    sub: 'tenant-uuid-1',
    phone: '+255712345678',
    app_metadata: { tenant_id: 'tenant-1' },
  })
  return `${header}.${payload}.sig`
}

describe('ensureAuthReady (tenant cold start)', () => {
  beforeEach(() => {
    vi.resetModules()
    holder.current = holder.make()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does not resolve until the session bootstrap settles', async () => {
    const { ensureAuthReady, isAuthenticated } = await import('../session')

    let resolved = false
    void ensureAuthReady().then(() => {
      resolved = true
    })

    // Bootstrap is still in flight — the gate must NOT have settled yet.
    await Promise.resolve()
    expect(resolved).toBe(false)
    expect(isAuthenticated()).toBe(false)
  })

  it('reflects the hydrated session by the time the gate resolves', async () => {
    const { ensureAuthReady, isAuthenticated } = await import('../session')

    const ready = ensureAuthReady()

    // Now settle getSession with an authenticated session. The real
    // Supabase client returns `{ data: { session } }`.
    holder.current.resolve({
      data: {
        session: { access_token: makeJwt(), user: { id: 'tenant-uuid-1' } },
      },
    })

    await ready
    // The routing decision is now safe AND sees the signed-in state.
    expect(isAuthenticated()).toBe(true)
  })
})
