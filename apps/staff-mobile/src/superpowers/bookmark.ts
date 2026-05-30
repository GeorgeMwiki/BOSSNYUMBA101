/**
 * Superpower 8 — bookmark / pin a ticket / unit for the day's run.
 */
import { useCallback } from 'react'
import { miningApi } from '../api/client'
import { enqueueUndoToast } from './undo'
import { rememberRecentSearch } from './search'
import type { NavigateTarget } from './navigate'

interface PinApiResponse {
  readonly success: boolean
  readonly data?: { readonly pinnedItemId: string }
}

export interface BookmarkInput {
  readonly entityType: 'ticket' | 'inspection' | 'unit' | 'document'
  readonly entityId: string
  readonly label: string
  readonly route: string
}

export function useBookmarkGesture(): (b: BookmarkInput) => Promise<void> {
  return useCallback(async (b) => {
    let pinnedId = ''
    try {
      const res = await miningApi.post<PinApiResponse>('/superpowers/pinned-items', {
        entityType: b.entityType,
        entityId: b.entityId,
        label: b.label,
        persona: 'staff'
      })
      if (res?.success && res.data?.pinnedItemId) {
        pinnedId = res.data.pinnedItemId
      }
    } catch {
      // optimistic
    }
    const target: NavigateTarget = { route: b.route, label: b.label }
    rememberRecentSearch(target)
    enqueueUndoToast({
      label: `Pinned ${b.label}`,
      journalIds: pinnedId ? [pinnedId] : [],
      windowSeconds: pinnedId ? 300 : 8
    })
  }, [])
}
