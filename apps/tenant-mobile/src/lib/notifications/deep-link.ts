/**
 * Tenant-mobile notification → route resolver.
 *
 * Maps a notification (the persisted L7 inbox rows AND the live SSE inbox
 * events) to a REAL in-app route, or `null` when there is no screen the
 * tap can honestly open. Tapping a notification used to only handle
 * `rfb_fulfilled` and silently dead-end on every other kind; this resolver
 * gives each kind a concrete, existing destination and an explicit no-op
 * otherwise so a tap is never a black hole.
 *
 * Only routes that actually exist under `app/` are returned:
 *   - /rfb/[id]/sign-delivery  (lease activation + settlement breakdown)
 *   - /rfb                     (request list — where responses are reviewed)
 *
 * Keep this pure (no router import) so it is unit-testable.
 */

import type { TenantNotificationKind } from '@/api/notifications'

export interface NotificationLinkInput {
  readonly kind: string
  readonly rfbId?: string | null
}

/**
 * Resolve the persisted-notification kind to a route. Returns `null` for an
 * honest no-op (mark-read only, no navigation) when no screen applies.
 */
export function resolveNotificationRoute(
  input: NotificationLinkInput,
): string | null {
  const rfbId = input.rfbId?.trim()
  switch (input.kind as TenantNotificationKind) {
    case 'rfb_fulfilled':
      // Accepted application → lease-activation / sign-delivery screen.
      return rfbId ? `/rfb/${rfbId}/sign-delivery` : '/rfb'
    case 'settlement_paid':
      // Settlement breakdown lives on the same sign-delivery screen.
      return rfbId ? `/rfb/${rfbId}/sign-delivery` : '/rfb'
    case 'rfb_response_received':
      // A landlord responded — there is no per-request detail screen yet,
      // so land on the request list where the response count is shown.
      return '/rfb'
    default:
      return null
  }
}

/**
 * Map a live SSE inbox event kind (see `event-stream.ts`
 * `TENANT_EVENT_KINDS`) to a route. Same honest-no-op contract.
 */
export function resolveLiveEventRoute(
  kind: string,
  payload?: Readonly<Record<string, unknown>>,
): string | null {
  const rfbId =
    payload && typeof payload.rfbId === 'string' && payload.rfbId.length > 0
      ? payload.rfbId
      : payload && typeof payload.rfb_id === 'string' && payload.rfb_id.length > 0
        ? payload.rfb_id
        : null
  switch (kind) {
    case 'rfb.dispatched':
    case 'bid.placed':
      return '/rfb'
    case 'settlement.initiated':
      return rfbId ? `/rfb/${rfbId}/sign-delivery` : '/rfb'
    case 'chat.handoff':
      return '/chat'
    case 'reminder.fired':
    default:
      // Reminders + unknown kinds carry no actionable destination.
      return null
  }
}
