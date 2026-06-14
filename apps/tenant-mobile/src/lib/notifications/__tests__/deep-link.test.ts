import { describe, expect, it } from 'vitest'

import {
  resolveNotificationRoute,
  resolveLiveEventRoute,
} from '../deep-link'

/**
 * Live detector for the notification → route resolver.
 *
 * Guards against the regression where tapping a notification dead-ended:
 * only `rfb_fulfilled` navigated and every other kind silently no-op'd.
 * Each kind must resolve to a route that ACTUALLY exists under `app/`
 * (only /rfb and /rfb/[id]/sign-delivery and /chat are real), or to an
 * explicit `null` honest-no-op — never to a fabricated screen.
 */

const REAL_ROUTE = /^\/(rfb(\/[\w-]+\/sign-delivery)?|chat)$/

describe('resolveNotificationRoute', () => {
  it('routes rfb_fulfilled with an rfb id to the sign-delivery screen', () => {
    expect(
      resolveNotificationRoute({ kind: 'rfb_fulfilled', rfbId: 'rfb-1' }),
    ).toBe('/rfb/rfb-1/sign-delivery')
  })

  it('routes settlement_paid with an rfb id to the sign-delivery screen', () => {
    expect(
      resolveNotificationRoute({ kind: 'settlement_paid', rfbId: 'rfb-9' }),
    ).toBe('/rfb/rfb-9/sign-delivery')
  })

  it('routes rfb_response_received to the request list', () => {
    expect(
      resolveNotificationRoute({ kind: 'rfb_response_received', rfbId: 'rfb-2' }),
    ).toBe('/rfb')
  })

  it('falls back to the request list when an rfb-scoped kind has no id', () => {
    expect(
      resolveNotificationRoute({ kind: 'rfb_fulfilled', rfbId: null }),
    ).toBe('/rfb')
    expect(
      resolveNotificationRoute({ kind: 'settlement_paid', rfbId: '   ' }),
    ).toBe('/rfb')
  })

  it('returns null (honest no-op) for an unknown kind', () => {
    expect(resolveNotificationRoute({ kind: 'mystery_kind' })).toBeNull()
  })

  it('never resolves to a route that does not exist under app/', () => {
    for (const kind of [
      'rfb_fulfilled',
      'settlement_paid',
      'rfb_response_received',
    ]) {
      const route = resolveNotificationRoute({ kind, rfbId: 'x' })
      expect(route).not.toBeNull()
      expect(route as string).toMatch(REAL_ROUTE)
    }
  })
})

describe('resolveLiveEventRoute', () => {
  it('routes dispatch/bid events to the request list', () => {
    expect(resolveLiveEventRoute('rfb.dispatched')).toBe('/rfb')
    expect(resolveLiveEventRoute('bid.placed')).toBe('/rfb')
  })

  it('routes settlement.initiated to sign-delivery when an rfb id is present', () => {
    expect(
      resolveLiveEventRoute('settlement.initiated', { rfbId: 'rfb-3' }),
    ).toBe('/rfb/rfb-3/sign-delivery')
    expect(
      resolveLiveEventRoute('settlement.initiated', { rfb_id: 'rfb-4' }),
    ).toBe('/rfb/rfb-4/sign-delivery')
  })

  it('routes chat.handoff to the chat screen', () => {
    expect(resolveLiveEventRoute('chat.handoff')).toBe('/chat')
  })

  it('returns null for reminders and unknown kinds (honest no-op)', () => {
    expect(resolveLiveEventRoute('reminder.fired')).toBeNull()
    expect(resolveLiveEventRoute('something.else')).toBeNull()
  })

  it('never resolves to a route that does not exist under app/', () => {
    const cases: ReadonlyArray<[string, Record<string, unknown> | undefined]> = [
      ['rfb.dispatched', undefined],
      ['bid.placed', undefined],
      ['settlement.initiated', { rfbId: 'z' }],
      ['chat.handoff', undefined],
    ]
    for (const [kind, payload] of cases) {
      const route = resolveLiveEventRoute(kind, payload)
      expect(route).not.toBeNull()
      expect(route as string).toMatch(REAL_ROUTE)
    }
  })
})
