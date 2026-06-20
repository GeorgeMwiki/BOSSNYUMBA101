/**
 * Tenant-mobile API client — R11 applicant-initiated request for
 * applications.
 *
 * Mirrors the applicant-side RFB routes in
 * `services/api-gateway/src/routes/marketplace.hono.ts` (mounted at
 * `/api/v1/marketplace`, migration 0331 backs the `rfb_requests` table):
 *   POST  /marketplace/rfb            create
 *   GET   /marketplace/rfb/mine       list_mine
 *   PATCH /marketplace/rfb/:id        cancel ({ status: 'cancelled' })
 *   POST  /marketplace/rfb/:id/cancel cancel (alias)
 * The tenant-mobile only needs the applicant-side endpoints (create,
 * list_mine, cancel) — the landlord `nearby` + respond endpoints surface
 * in the future operator / owner cockpit.
 *
 * Tenant scoping is handled by the gateway via the JWT auth header;
 * no tenantId is sent client-side. The applicant's user id is also
 * resolved server-side from the token.
 */

import { apiFetch } from './client'

const RFB_PREFIX = '/api/v1/marketplace/rfb'

export type RfbStatus = 'open' | 'filled' | 'expired' | 'cancelled'

export interface RfbCreateInput {
  readonly unitType: string
  readonly gradeMin?: string
  readonly floorAreaMinSqm: number
  readonly floorAreaMaxSqm?: number
  readonly unitPriceTzs: number
  /** YYYY-MM-DD */
  readonly deliveryBy: string
  readonly locationLat?: number
  readonly locationLon?: number
  readonly radiusKm: number
  readonly notes?: string
}

export interface RfbSummary {
  readonly id: string
  readonly unit_type: string
  readonly grade_min: string | null
  readonly floor_area_min: string
  readonly floor_area_max: string | null
  /** Budget ceiling. Currency-agnostic value; pair with `currency`. */
  readonly unit_price_tzs: string
  /** ISO-4217 code the budget ceiling is denominated in (server-resolved). */
  readonly currency: string | null
  readonly delivery_by: string
  readonly status: RfbStatus
  readonly created_at: string
  readonly expires_at: string
  readonly pending_response_count: number
}

interface CreateResponse {
  readonly success: boolean
  readonly data: { id: string; createdAt: string; expiresAt: string }
}

interface MineResponse {
  readonly success: boolean
  readonly data: { rfbs: ReadonlyArray<RfbSummary> }
}

interface CancelResponse {
  readonly success: boolean
  readonly data: { id: string; status: RfbStatus }
}

export async function createRfb(input: RfbCreateInput): Promise<CreateResponse['data']> {
  const res = await apiFetch<CreateResponse>(RFB_PREFIX, {
    method: 'POST',
    body: input
  })
  return res.data
}

export async function fetchMyRfbs(): Promise<ReadonlyArray<RfbSummary>> {
  const res = await apiFetch<MineResponse>(`${RFB_PREFIX}/mine`)
  return res.data.rfbs
}

export async function cancelRfb(rfbId: string): Promise<CancelResponse['data']> {
  const res = await apiFetch<CancelResponse>(`${RFB_PREFIX}/${encodeURIComponent(rfbId)}`, {
    method: 'PATCH',
    body: { status: 'cancelled' }
  })
  return res.data
}

/** Unit types the gateway accepts. Matches the zod enum on the route. */
export const RFB_UNIT_TYPES = [
  'studio',
  'one_bedroom',
  'two_bedroom',
  'three_bedroom',
  'four_bedroom_plus',
  'five_bedroom_plus',
  'commercial',
  'industrial',
  'mixed_use',
  'retail',
  'office',
  'warehouse',
  'land',
  'other'
] as const

export type RfbUnitType = (typeof RFB_UNIT_TYPES)[number]
