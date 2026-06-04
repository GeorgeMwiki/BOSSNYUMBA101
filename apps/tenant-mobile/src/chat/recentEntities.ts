/**
 * recentEntities — fetcher for the tenant composer @-menu. Resolves a
 * tenant-scoped list of recent scope nodes (units / leases /
 * counterparties / scope_nodes) the renter can @-mention. Returns an
 * empty list on any error so the composer stays operational offline.
 *
 * NOTE (flagged): the `RecentEntityKind` members and the `KIND_MAP` /
 * EntityItem.kind literals ('parcel', 'licence', 'site') are sent to /
 * received from `/api/v1/scope/recent-entities` and are also consumed by
 * the non-owned ToolCallRenderer, so the rename to unit/lease/property is
 * a coordinated follow-up.
 */
import { apiFetch } from '@/api/client'
import type { EntityItem } from './composer-triggers'

const RECENT_PATH = '/api/v1/scope/recent-entities'

export type RecentEntityKind = 'parcel' | 'licence' | 'employee' | 'scope_node'

interface RecentEntitiesResponse {
  readonly success?: boolean
  readonly data?: {
    readonly entities?: ReadonlyArray<{
      readonly id?: string
      readonly label?: { readonly en?: string; readonly sw?: string }
      readonly kind?: string
    }>
  }
}

const KIND_MAP: Readonly<Record<string, EntityItem['kind']>> = {
  parcel: 'parcel',
  licence: 'licence',
  employee: 'employee',
  site: 'site',
  scope_node: 'scope',
  counterparty: 'counterparty',
  document: 'document',
  subsidiary: 'subsidiary'
}

export async function fetchRecentEntities(
  kind: RecentEntityKind = 'parcel',
  limit = 20
): Promise<ReadonlyArray<EntityItem>> {
  try {
    const resp = await apiFetch<RecentEntitiesResponse>(RECENT_PATH, {
      query: { kind, limit }
    })
    const rows = resp?.data?.entities ?? []
    return rows
      .map((row): EntityItem | null => {
        if (!row || typeof row.id !== 'string' || row.id.length === 0) {
          return null
        }
        const labelEn = row.label?.en ?? row.id
        const labelSw = row.label?.sw ?? labelEn
        const k = typeof row.kind === 'string' ? KIND_MAP[row.kind] : undefined
        return {
          id: row.id,
          label: { en: labelEn, sw: labelSw },
          kind: k ?? 'custom'
        }
      })
      .filter((row): row is EntityItem => row !== null)
  } catch {
    return []
  }
}
