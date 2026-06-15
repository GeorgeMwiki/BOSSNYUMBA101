/**
 * WorkerHomeHero — data-loading wrapper around WorkerHeroCard.
 *
 * Roadmap R5. Reads `/api/v1/field/staff/me` (worker identity + shift)
 * and `/api/v1/field/staff/tasks/next` (next assigned task) and feeds the
 * presentational `WorkerHeroCard`. The router is mounted at
 * `/api/v1/field/staff` (createFieldStaffRouter) — NOT `/workforce` — so
 * all paths go through `fieldApi`, which prepends `API_BASE_URL` +
 * `FIELD_PREFIX` and reaches the real `/staff` segment. The wrapper is
 * intentionally tiny:
 *   • Holds no derived state beyond the API payload.
 *   • Tolerates a missing endpoint gracefully — when fetch returns null,
 *     the card renders the "no shift" + "no next task" state from the
 *     locally cached user.
 *   • Surfaces mark-complete + need-help intents to the brain via the
 *     same micro-action contract the chat uses.
 */
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useI18n } from '../i18n/useI18n'
import { fieldApi } from '../api/client'
import { WorkerHeroCard } from './WorkerHeroCard'
import {
  buildHeroData,
  type MeResponseShape,
  type NextTaskResponseShape,
} from './worker-hero-card.helpers'

export { buildHeroData } from './worker-hero-card.helpers'

export function WorkerHomeHero(): JSX.Element | null {
  const { user } = useAuth()
  const { lang } = useI18n()
  const [me, setMe] = useState<MeResponseShape | null>(null)
  const [task, setTask] = useState<NextTaskResponseShape | null>(null)
  const [completeError, setCompleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const next = await fieldApi.get<MeResponseShape>('/staff/me')
        if (!cancelled) setMe(next)
      } catch {
        // Endpoint may be optional in dev — leave `me` as null so the
        // card falls back to the cached user identity.
      }
      try {
        const t = await fieldApi.get<NextTaskResponseShape>(
          '/staff/tasks/next',
        )
        if (!cancelled) setTask(t)
      } catch {
        if (!cancelled) setTask(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const fallbackName =
    user?.fullName ?? (lang === 'sw' ? 'Mfanyakazi' : 'Worker')

  const onMarkComplete = useCallback(
    async (taskId: string): Promise<void> => {
      // CRITICAL: only clear the task on a confirmed 2xx. `fieldApi.post`
      // resolves ONLY on a 2xx and throws `ApiError` otherwise, so reaching
      // the line after the await IS the server confirmation. Previously the
      // failure was swallowed and the task cleared regardless (fake success),
      // hiding an unsynced completion. Now a failure surfaces and the task
      // stays visible so the worker can retry.
      setCompleteError(null)
      try {
        await fieldApi.post<{ readonly ok: true }>(
          `/staff/tasks/${encodeURIComponent(taskId)}/complete`,
          undefined,
        )
        setTask(null)
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : lang === 'sw'
              ? 'Imeshindwa kukamilisha kazi'
              : 'Could not mark the task complete'
        setCompleteError(message)
      }
    },
    [lang],
  )

  const onNeedHelp = useCallback(
    async (taskId: string | null): Promise<void> => {
      try {
        await fieldApi.post<{ readonly ok: true }>('/staff/help-requests', {
          taskId,
          locale: lang,
        })
      } catch {
        // best-effort
      }
    },
    [lang],
  )

  const data = buildHeroData(me, task, fallbackName, lang)
  return (
    <WorkerHeroCard
      data={data}
      locale={lang}
      onMarkComplete={onMarkComplete}
      onNeedHelp={onNeedHelp}
      completeError={completeError}
    />
  )
}
