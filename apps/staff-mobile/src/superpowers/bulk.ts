/**
 * Superpower 5 — bulk close tickets (staff persona).
 *
 * Staff allowed actions: bulk_close (close N tickets), bulk_dispatch
 * (assign / acknowledge N).
 */
import { useCallback, useEffect, useState } from 'react'
import { bulkActionBus } from './bus'
import { miningApi } from '../api/client'
import { enqueueUndoToast } from './undo'

export type StaffBulkAction = 'bulk_close' | 'bulk_dispatch'

export interface BulkSelection {
  readonly entityType: string
  readonly ids: ReadonlyArray<string>
  readonly toggle: (id: string) => void
  readonly clear: () => void
  readonly isSelected: (id: string) => boolean
  readonly count: number
}

let liveSelection: { entityType: string; ids: ReadonlyArray<string> } | null = null

export function getLiveBulkSelection(): { entityType: string; ids: ReadonlyArray<string> } | null {
  return liveSelection
}

export function useBulkSelection(entityType: string): BulkSelection {
  const [ids, setIds] = useState<ReadonlyArray<string>>([])

  const toggle = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const clear = useCallback(() => setIds([]), [])
  const isSelected = useCallback((id: string) => ids.includes(id), [ids])

  useEffect(() => {
    liveSelection = ids.length > 0 ? { entityType, ids } : null
    bulkActionBus.publish({ entityType, ids, action: 'selection_changed' })
    return () => {
      if (liveSelection?.entityType === entityType) {
        liveSelection = null
      }
    }
  }, [entityType, ids])

  return { entityType, ids, toggle, clear, isSelected, count: ids.length }
}

interface BulkApiResponse {
  readonly success: boolean
  readonly data?: { readonly undoJournalIds?: ReadonlyArray<string> }
}

export async function runStaffBulkAction(
  entityType: string,
  ids: ReadonlyArray<string>,
  action: StaffBulkAction,
  label: string
): Promise<ReadonlyArray<string>> {
  if (ids.length === 0) {
    return []
  }
  let undoJournalIds: ReadonlyArray<string> = []
  try {
    const res = await miningApi.post<BulkApiResponse>('/superpowers/bulk-action', {
      entityType,
      ids,
      action,
      persona: 'staff',
      reason: `staff-bulk-${action}`
    })
    if (res?.success && res.data?.undoJournalIds) {
      undoJournalIds = res.data.undoJournalIds
    }
  } catch {
    // ignore
  }
  enqueueUndoToast({
    label,
    journalIds: undoJournalIds,
    windowSeconds: undoJournalIds.length > 0 ? 300 : 8
  })
  return undoJournalIds
}
