/**
 * Tenant-mobile API — commercial chain L7 notifications.
 *
 * Backed by /api/v1/notifications on the api-gateway. Each row represents
 * an L7 fulfilment notification (application fulfilled, settlement paid,
 * response received) the operator-side handlers enqueued.
 *
 * NOTE (flagged): the wire field names below (buyer_tenant_id,
 * buyer_user_id, seller_tenant_id, rfb_id) mirror the server JSON and so
 * are kept as-is; renaming them to applicant_/operator_/application_id
 * requires a coordinated backend payload change.
 */

import { apiFetch } from './client'

const NOTIFICATIONS_PREFIX = '/api/v1/notifications'

export type TenantNotificationKind =
  | 'rfb_fulfilled'
  | 'rfb_response_received'
  | 'settlement_paid'

export interface TenantNotificationRow {
  readonly id: string
  readonly buyer_tenant_id: string
  readonly buyer_user_id: string
  readonly seller_tenant_id: string
  readonly rfb_id: string
  readonly response_id: string | null
  readonly task_id: string | null
  readonly kind: TenantNotificationKind
  readonly title_sw: string
  readonly title_en: string
  readonly body_sw: string
  readonly body_en: string
  readonly payload: Record<string, unknown>
  readonly read_at: string | null
  readonly created_at: string
}

export interface ListNotificationsInput {
  readonly limit?: number
  readonly cursor?: string
  readonly unreadOnly?: boolean
}

export interface ListNotificationsResult {
  readonly notifications: ReadonlyArray<TenantNotificationRow>
  readonly nextCursor: string | null
}

interface ListResponse {
  readonly success?: boolean
  readonly data?: {
    readonly notifications?: ReadonlyArray<TenantNotificationRow>
    readonly nextCursor?: string | null
  }
}

export async function listTenantNotifications(
  input: ListNotificationsInput = {},
): Promise<ListNotificationsResult> {
  const query: Record<string, string | number | boolean | undefined> = {}
  if (input.limit) query.limit = input.limit
  if (input.cursor) query.cursor = input.cursor
  if (input.unreadOnly) query.unreadOnly = 'true'
  const res = await apiFetch<ListResponse>(NOTIFICATIONS_PREFIX, { query })
  const data = res.data ?? {}
  return {
    notifications: data.notifications ?? [],
    nextCursor: data.nextCursor ?? null,
  }
}

export async function markTenantNotificationRead(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(
    `${NOTIFICATIONS_PREFIX}/${encodeURIComponent(id)}/read`,
    { method: 'POST' },
  )
}
