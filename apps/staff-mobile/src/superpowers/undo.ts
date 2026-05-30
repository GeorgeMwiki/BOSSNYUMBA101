/**
 * Superpower 6 — undo toast queue + server-side undo journal.
 */
import { undoToastBus, type UndoToastEvent } from './bus'
import { miningApi } from '../api/client'

interface UndoApiResponse {
  readonly success: boolean
}

export function enqueueUndoToast(input: Omit<UndoToastEvent, 'id'>): void {
  undoToastBus.publish({ ...input, id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
}

export async function undoJournalIds(ids: ReadonlyArray<string>): Promise<boolean> {
  if (ids.length === 0) return false
  try {
    const res = await miningApi.post<UndoApiResponse>('/superpowers/undo-journal/undo-last', {
      journalIds: ids,
      reason: 'user-tapped-undo-toast'
    })
    return Boolean(res?.success)
  } catch {
    return false
  }
}
