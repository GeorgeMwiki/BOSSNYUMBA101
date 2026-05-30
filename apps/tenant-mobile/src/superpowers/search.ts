/**
 * Superpower 7 — search FAB (tenant persona).
 */
import { apiFetch } from '@/api/client'
import type { NavigateTarget } from './navigate'

export interface SearchResult extends NavigateTarget {
  readonly description?: string
}

interface SearchApiResponse {
  readonly success: boolean
  readonly data?: { readonly results: ReadonlyArray<SearchResult> }
}

let recents: ReadonlyArray<SearchResult> = []

export function rememberRecentSearch(result: SearchResult): void {
  recents = [result, ...recents.filter((r) => r.route !== result.route)].slice(0, 8)
}

export function getRecentSearches(): ReadonlyArray<SearchResult> {
  return recents
}

export async function runUniversalSearch(query: string): Promise<ReadonlyArray<SearchResult>> {
  const q = query.trim()
  if (q.length === 0) return []
  try {
    const res = await apiFetch<SearchApiResponse>(
      `/api/v1/tenant/superpowers/search?q=${encodeURIComponent(q)}&persona=tenant&limit=20`
    )
    if (res?.success && res.data?.results) {
      return res.data.results
    }
  } catch {
    // ignore
  }
  return []
}
