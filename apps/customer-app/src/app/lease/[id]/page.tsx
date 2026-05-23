'use client';

/**
 * Tenant Lease detail — KPI panel + recent parcel activity.
 *
 * Wave-3 INT-4 surface. Shows condition-survey-derived KPIs (e.g. unit
 * cleanliness score, defect count from the last quarterly survey) and
 * the most recent entries from `parcel_activity_log` linked to the
 * lease via `parcel_id` on the unit.
 *
 * Tenant persona (T5) — server-side scoping guarantees we never leak
 * other tenants' data. The flag `lease_kpi_panel_enabled` is the
 * client-side belt to keep the surface hidden until the engines land.
 *
 * TODO(wave3-int5):
 *   - `useLeaseDetail(id)` -> base lease info
 *   - `useConditionSurveyKpis({ leaseId })` -> KPI tiles
 *   - `useParcelActivityForLease({ leaseId })` -> recent log entries
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Activity, Sparkles, Gauge } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { isFeatureEnabled } from '@/lib/featureFlags';

interface PageProps {
  readonly params: { readonly id: string };
}

interface LeaseKpiTile {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly trend?: 'up' | 'down' | 'flat';
}

interface ParcelActivity {
  readonly id: string;
  readonly summary: string;
  readonly happenedAt: string;
}

function useLeaseKpisStub(_leaseId: string): {
  data: { tiles: ReadonlyArray<LeaseKpiTile>; activity: ReadonlyArray<ParcelActivity> };
  isLoading: boolean;
} {
  return useMemo(
    () => ({
      data: { tiles: [], activity: [] },
      isLoading: false,
    }),
    [],
  );
}

export default function TenantLeaseDetailPage({ params }: PageProps) {
  const t = useTranslations('tenantLeaseDetail');
  const enabled = isFeatureEnabled('lease_kpi_panel_enabled');
  const { data } = useLeaseKpisStub(params.id);

  if (!enabled) {
    return (
      <>
        <PageHeader title={t('title')} subtitle={t('subtitle')} showBack />
        <section className="px-4 py-12 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-sky-500" />
          <h2 className="mt-4 text-lg font-semibold">{t('disabledTitle')}</h2>
          <p className="mt-2 text-sm text-gray-500">{t('disabledDescription')}</p>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} showBack />
      <section className="px-4 py-4 space-y-4" data-testid="lease-detail-root">
        <div
          data-testid="lease-kpis"
          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <header className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-sky-500" />
            <h3 className="text-sm font-semibold text-gray-900">{t('kpiTitle')}</h3>
          </header>
          {data.tiles.length === 0 ? (
            <p className="mt-3 text-xs text-gray-500">{t('kpiEmpty')}</p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-3">
              {data.tiles.map((tile) => (
                <li
                  key={tile.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                >
                  <p className="text-[11px] text-gray-500">{tile.label}</p>
                  <p className="text-lg font-semibold text-gray-900">{tile.value}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          data-testid="lease-activity"
          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <header className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-sky-500" />
            <h3 className="text-sm font-semibold text-gray-900">{t('activityTitle')}</h3>
          </header>
          {data.activity.length === 0 ? (
            <p className="mt-3 text-xs text-gray-500">{t('activityEmpty')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.activity.map((event) => (
                <li
                  key={event.id}
                  className="text-xs text-gray-700 border-l-2 border-sky-500 pl-3"
                >
                  <p>{event.summary}</p>
                  <p className="text-gray-400 mt-0.5">{event.happenedAt}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
