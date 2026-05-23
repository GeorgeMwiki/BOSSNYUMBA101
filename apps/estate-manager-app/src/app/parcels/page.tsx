'use client';

/**
 * Estate Manager — district parcels overview.
 *
 * Scope is the manager's assigned district; RLS server-side filters by
 * the operator's `district_id`. UI surfaces:
 *   - Parcel list with status filter
 *   - Quick stats (available / leased / pending)
 *   - Activity log entries linked to parcels (from
 *     `parcel_activity_log`)
 *
 * Until the geo-parcels API client lands, we stub with an empty list +
 * the three stat tiles wired to zero — that lets the layout settle
 * before data plugs in.
 *
 * TODO(wave3-int5):
 *   - `useDistrictParcels()` -> list filtered by RLS-bound district
 *   - `useParcelActivity({ parcelId })` -> recent events
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { isFeatureEnabled } from '@/lib/featureFlags';

type ParcelStatus = 'available' | 'leased' | 'pending';

interface ParcelRow {
  readonly id: string;
  readonly title: string;
  readonly status: ParcelStatus;
}

function useDistrictParcelsStub(): {
  data: ReadonlyArray<ParcelRow>;
  isLoading: boolean;
} {
  return useMemo(() => ({ data: [], isLoading: false }), []);
}

export default function ManagerParcelsPage() {
  const t = useTranslations('managerParcels');
  const enabled = isFeatureEnabled('parcels_overview_enabled');
  const { data } = useDistrictParcelsStub();
  const [filter, setFilter] = useState<'all' | ParcelStatus>('all');

  if (!enabled) {
    return (
      <>
        <PageHeader title={t('title')} subtitle={t('subtitle')} showBack />
        <section className="px-4 py-12 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="mt-4 text-lg font-semibold">{t('disabledTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('disabledDescription')}
          </p>
        </section>
      </>
    );
  }

  const counts = {
    available: data.filter((p) => p.status === 'available').length,
    leased: data.filter((p) => p.status === 'leased').length,
    pending: data.filter((p) => p.status === 'pending').length,
  };

  const filtered = filter === 'all' ? data : data.filter((p) => p.status === filter);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} showBack />
      <section className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(['available', 'leased', 'pending'] as const).map((key) => (
            <div
              key={key}
              data-testid={`parcels-stat-${key}`}
              className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 text-center"
            >
              <p className="text-xs text-muted-foreground">{t(`stat.${key}`)}</p>
              <p className="text-xl font-semibold">{counts[key]}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2" role="tablist">
          {(['all', 'available', 'leased', 'pending'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              role="tab"
              aria-selected={filter === opt}
              data-testid={`parcels-filter-${opt}`}
              onClick={() => setFilter(opt)}
              className={`text-xs px-3 py-1 rounded-full ${
                filter === opt
                  ? 'bg-amber-500 text-gray-900'
                  : 'bg-gray-800 text-muted-foreground hover:bg-gray-700'
              }`}
            >
              {t(`filter.${opt}`)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div
            data-testid="manager-parcels-empty"
            className="rounded-xl border border-dashed border-gray-700 bg-gray-900/20 p-8 text-center"
          >
            <MapPin className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-3 text-sm font-medium">{t('emptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('emptyDescription')}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((parcel) => (
              <li
                key={parcel.id}
                data-testid="manager-parcel-row"
                data-parcel-id={parcel.id}
                className="rounded-lg border border-gray-700 bg-gray-900/40 p-3"
              >
                <p className="text-sm font-medium">{parcel.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`stat.${parcel.status}`)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
