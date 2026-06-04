/**
 * Tenant-mobile API — commercial chain L7 notifications.
 *
 * Backed by /api/v1/notifications on the api-gateway. Each row represents
 * an L7 fulfilment notification (application fulfilled, settlement paid,
 * response received) the operator-side handlers enqueued.
 *
 * The row shape mirrors the gateway JSON: the applicant side (the renting
 * tenant) is `applicant_tenant_id` / `applicant_user_id`, the listing side
 * (the landlord) is `landlord_tenant_id`, and `rfb_id` is the originating
 * request-for-application.
 */

import { apiFetch } from './client'

const NOTIFICATIONS_PREFIX = '/api/v1/notifications'

export type TenantNotificationKind =
  | 'rfb_fulfilled'
  | 'rfb_response_received'
  | 'settlement_paid'

export interface TenantNotificationRow {
  readonly id: string
  readonly applicant_tenant_id: string
  readonly applicant_user_id: string
  readonly landlord_tenant_id: string
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
