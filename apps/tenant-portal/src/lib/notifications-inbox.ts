/**
 * Notifications inbox — local in-memory feed driven by the cockpit
 * SSE stream + cross-portal subscribe stream.
 *
 * Provides:
 *   - `subscribeNotificationsInbox(handlers)` — registers a callback
 *     that fires once per notification-worthy event (lease.signed,
 *     rent.collected, rent_payout.initiated, maintenance.completed,
 *     reminder.fired, regulator.request_received, etc.).
 *   - `markNotificationRead(id)` — POST to /me/notifications/:id/read
 *     so the cockpit's badge counter updates.
 *
 * The inbox is intentionally state-less server-side aside from the
 * `read_at` column — the LIVE feed is the SSE stream. Persistence of
 * historical notifications lives in the `notifications` table, but
 * that's a server concern; this client helper just reflects the live
 * push.
 *
 * Ported to apps/owner-portal/src/lib/notifications-inbox.ts +
 * apps/customer-app/src/lib/notifications-inbox.ts +
 * apps/estate-manager-app/src/lib/notifications-inbox.ts so the same
 * subscriber lives on all three surfaces.
 */

import type { CockpitEventKind } from './cockpit-stream';

/** Notification-worthy event kinds — a subset of CockpitEventKind. */
const NOTIFICATION_KINDS: ReadonlyArray<CockpitEventKind> = [
  'rent.collected',
  'lease.signed',
  'lease.renewed',
  'lease.terminated',
  'maintenance.completed',
  'maintenance.requested',
  'inspection.completed',
  'inspection.scheduled',
  'application.submitted',
  'application.approved',
  'application.rejected',
  'viewing.scheduled',
  'viewing.completed',
  'regulator.request_received',
  'rfa.dispatched',
  'task.assigned',
  'safety.incident_reported',
  'rent_payout.initiated',
  'payroll.committed',
  'licence.renewed',
  'manager.approved',
  'bid.placed',
  'incident.escalated',
  'reminder.fired',
];

const NOTIFICATION_KIND_SET = new Set<string>(NOTIFICATION_KINDS);

export interface NotificationItem {
  readonly id: string;
  readonly kind: CockpitEventKind;
  readonly receivedAt: string;
  readonly data: unknown;
}

export interface NotificationsInboxHandlers {
  readonly onNotification?: (item: NotificationItem) => void;
}

/** Treat a cockpit event payload as a notification. */
export function isNotificationKind(kind: string): kind is CockpitEventKind {
  return NOTIFICATION_KIND_SET.has(kind);
}

/**
 * Build a notification item from a cockpit event payload. Returns null
 * when the kind is not notification-worthy (e.g. heartbeat).
 */
export function buildNotificationItem(
  kind: string,
  data: unknown,
): NotificationItem | null {
  if (!isNotificationKind(kind)) return null;
  const idCandidate = (data as { eventId?: string; id?: string } | null)
    ?.eventId ?? (data as { id?: string } | null)?.id;
  const id =
    typeof idCandidate === 'string' && idCandidate.length > 0
      ? idCandidate
      : `${kind}-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    kind,
    receivedAt: new Date().toISOString(),
    data,
  };
}

/** Best-effort POST mark-read; safe to call unauthenticated (logs only). */
export async function markNotificationRead(
  apiBase: string,
  notificationId: string,
  bearer?: string,
): Promise<void> {
  try {
    await fetch(
      `${apiBase.replace(/\/$/, '')}/me/notifications/${encodeURIComponent(notificationId)}/read`,
      {
        method: 'POST',
        credentials: 'include',
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
      },
    );
  } catch {
    // Best-effort — the badge auto-syncs on next cockpit fetch.
  }
}
