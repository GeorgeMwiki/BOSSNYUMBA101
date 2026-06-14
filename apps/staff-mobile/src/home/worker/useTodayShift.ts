/**
 * R39 — `useTodayShift` reads the worker's current shift schedule and
 * task list from `/api/v1/field/shifts/today`. Backs the W-M-02 (worker
 * shift-report) screen.
 *
 * NO-FABRICATION: when the endpoint is unavailable (network 0, 404, 501)
 * the hook resolves to `null` — an HONEST "no shift / unavailable" empty
 * state — instead of inventing a working 06:00–18:00 shift. The W-M-02
 * screen null-guards the data and renders an empty surface. Real errors
 * (auth, 5xx) propagate to the caller's error state.
 *
 * NOTE: the `/api/v1/field/shifts/today` route is NOT yet mounted on the
 * api-gateway (field/staff.hono.ts exposes GET /me + GET /tasks/next but
 * no /shifts/today). Until the backend lands, this hook returns the
 * honest empty state rather than fake data.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { request } from '../../api/client'
import { API_BASE_URL, FIELD_PREFIX } from '../../api/config'
import { ApiError } from '../../api/errors'

export interface ShiftTaskLite {
  readonly id: string
  readonly titleEn: string
  readonly titleSw: string
  readonly location: string | null
}

export interface TodayShift {
  readonly shiftDate: string
  readonly shiftKind: 'day' | 'night'
  readonly siteName: string
  readonly startISO: string
  readonly endISO: string
  readonly nextBreakISO: string | null
  readonly tasks: ReadonlyArray<ShiftTaskLite>
}

const TODAY_SHIFT_URL = `${API_BASE_URL}${FIELD_PREFIX}/shifts/today`

/**
 * A missing/unreachable endpoint means "no shift available" — NOT a hard
 * error and NOT a reason to fabricate one. We treat network-0 / 404 / 501
 * as an honest empty result so the screen can show a real empty state.
 */
function isUnavailable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return error.status === 0 || error.status === 404 || error.status === 501
}

export function useTodayShift(): UseQueryResult<TodayShift | null, Error> {
  return useQuery<TodayShift | null, Error>({
    queryKey: ['field-workforce', 'shifts', 'today'],
    queryFn: async ({ signal }) => {
      try {
        return await request<TodayShift>(TODAY_SHIFT_URL, { signal })
      } catch (error) {
        if (isUnavailable(error)) {
          // Honest empty state — no shift data to show, no fabrication.
          return null
        }
        throw error
      }
    },
    staleTime: 5 * 60_000,
    retry: 1
  })
}
