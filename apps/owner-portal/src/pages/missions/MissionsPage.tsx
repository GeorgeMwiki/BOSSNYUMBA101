/**
 * MissionsPage — owner-portal surface for Piece Q
 * (`@bossnyumba/long-horizon-agent`).
 *
 * Long-horizon agency loop: missions break down to steps, steps emit
 * checkpoints, checkpoints feed drift-detection. This page lists the
 * missions and links into the detail.
 *
 * The "list + detail" pair lives in one Vite route file with a
 * `selectedId` URL param state — keeps routing minimal and avoids
 * one-off nested routes.
 *
 * BN-EXE-09: the `useMissionsStub` dead-end is replaced by a real
 * `useMissions()` React-Query hook against the `/missions` backend route
 * (services/api-gateway/src/routes/missions.hono.ts), which drives the
 * long-horizon-agent step engine.
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Target, Sparkles, ChevronRight } from 'lucide-react';
import { Skeleton, EmptyState } from '@bossnyumba/design-system';
import { useFeatureFlag } from '../../lib/useFeatureFlag';
import { api } from '../../lib/api';

interface MissionSummary {
  readonly id: string;
  readonly title: string;
  readonly status: 'active' | 'paused' | 'complete' | 'failed';
  readonly stepCount: number;
  readonly driftRisk: 'low' | 'medium' | 'high';
}

/** Wire shape returned by GET /api/v1/missions. */
interface MissionApiSummary {
  readonly id: string;
  readonly title: string;
  readonly status:
    | 'planning'
    | 'active'
    | 'paused'
    | 'completed'
    | 'abandoned'
    | 'escalated';
  readonly stepCount: number;
  readonly riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'SOVEREIGN';
}

/**
 * Map the backend mission status onto the four display states the page +
 * i18n bundle understand. `planning` reads as `active` (the mission is
 * live, just decomposing); `abandoned` / `escalated` read as `failed`.
 */
function toDisplayStatus(
  status: MissionApiSummary['status'],
): MissionSummary['status'] {
  switch (status) {
    case 'completed':
      return 'complete';
    case 'paused':
      return 'paused';
    case 'abandoned':
    case 'escalated':
      return 'failed';
    case 'planning':
    case 'active':
    default:
      return 'active';
  }
}

/** Heuristic drift risk from the mission risk tier until checkpoint
 *  drift-summaries are surfaced on the detail payload. */
function toDriftRisk(
  riskTier: MissionApiSummary['riskTier'],
): MissionSummary['driftRisk'] {
  if (riskTier === 'HIGH' || riskTier === 'SOVEREIGN') return 'high';
  if (riskTier === 'MEDIUM') return 'medium';
  return 'low';
}

function useMissions(): {
  data: ReadonlyArray<MissionSummary>;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: ['missions'],
    queryFn: async () => {
      const res = await api.get<MissionApiSummary[]>('/missions');
      if (!res.success || res.data === undefined) {
        const message =
          typeof res.error === 'string'
            ? res.error
            : res.error?.message ?? 'Missions unavailable';
        throw new Error(message);
      }
      return res.data;
    },
  });

  const data = useMemo<ReadonlyArray<MissionSummary>>(
    () =>
      (query.data ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        status: toDisplayStatus(m.status),
        stepCount: m.stepCount,
        driftRisk: toDriftRisk(m.riskTier),
      })),
    [query.data],
  );

  return { data, isLoading: query.isLoading };
}

const RISK_COLOR: Record<MissionSummary['driftRisk'], string> = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-rose-100 text-rose-700',
};

export function MissionsPage(): JSX.Element {
  const t = useTranslations('missions');
  const enabled = useFeatureFlag('missions_enabled');
  const { data, isLoading } = useMissions();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => (selectedId ? data.find((m) => m.id === selectedId) ?? null : null),
    [data, selectedId],
  );

  if (!enabled) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          icon={<Sparkles className="h-10 w-10" />}
          title={t('disabledTitle')}
          description={t('disabledDescription')}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <section>
        <header className="mb-3">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </header>
        {data.length === 0 ? (
          <EmptyState
            icon={<Target className="h-10 w-10" />}
            title={t('emptyTitle')}
            description={t('emptyDescription')}
          />
        ) : (
          <ul className="space-y-2">
            {data.map((mission) => (
              <li key={mission.id}>
                <button
                  type="button"
                  data-testid="mission-card"
                  data-mission-id={mission.id}
                  onClick={() => setSelectedId(mission.id)}
                  className={`w-full flex items-center justify-between rounded-xl border p-4 text-left shadow-sm ${
                    selected?.id === mission.id
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-gray-900">{mission.title}</p>
                    <p className="text-xs text-gray-500">
                      {t(`status.${mission.status}`)} · {mission.stepCount} {t('stepsLabel')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${RISK_COLOR[mission.driftRisk]}`}
                    >
                      {t(`drift.${mission.driftRisk}`)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside
        data-testid="mission-detail"
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        {selected ? (
          <>
            <h2 className="text-lg font-semibold text-gray-900">{selected.title}</h2>
            <p className="text-xs text-gray-500 mt-1">
              {t(`status.${selected.status}`)}
            </p>
            <p className="mt-3 text-sm text-gray-700">{t('detailPlaceholder')}</p>
          </>
        ) : (
          <p className="text-sm text-gray-500">{t('selectAMission')}</p>
        )}
      </aside>
    </div>
  );
}

export default MissionsPage;
