/**
 * ParcelsMarketplacePage — owner-portal surface for Piece N
 * (`@bossnyumba/geo-parcels`).
 *
 * Geospatial parcel browser backed by PostGIS. End-state UX: owners
 * filter by district, lease status, ground-rent currency, then drill
 * into a parcel detail page that shows lineage + activity log.
 *
 * Map library decision: this repo already ships `@bossnyumba/genui`'s
 * `MapView` which is Leaflet/OSM-backed. We reuse it instead of adding
 * Mapbox/Maplibre — same UX, zero token cost, no new lib.
 *
 * Gated behind `parcels_marketplace_enabled`. While the geo-parcels
 * package is unwired, the page renders an empty marketplace + a
 * filter shell so behaviour and layout can be validated end-to-end.
 *
 * TODO(wave3-int5): swap stub for
 *   `useParcels({ districtId, status, currency })` from `@bossnyumba/api-client`.
 *   The geo-parcels package returns `{ items: ParcelSummary[], cursor? }`.
 *
 * TODO(wave3-int5): render parcels onto MapView markers + sync map
 *   bbox <-> list filter for spatial brushing.
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, ListFilter, Sparkles } from 'lucide-react';
import { Skeleton, EmptyState } from '@bossnyumba/design-system';
import { useFeatureFlag } from '../../lib/useFeatureFlag';

interface ParcelSummary {
  readonly id: string;
  readonly title: string;
  readonly district: string;
  readonly status: 'available' | 'leased' | 'pending';
  readonly groundRentCurrency: string;
}

function useParcelsStub(): { data: ReadonlyArray<ParcelSummary>; isLoading: boolean } {
  return useMemo(() => ({ data: [], isLoading: false }), []);
}

export function ParcelsMarketplacePage(): JSX.Element {
  const t = useTranslations('parcelsMarketplace');
  const enabled = useFeatureFlag('parcels_marketplace_enabled');
  const { data, isLoading } = useParcelsStub();
  const [filter, setFilter] = useState<'all' | ParcelSummary['status']>('all');

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
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const filtered = filter === 'all' ? data : data.filter((p) => p.status === filter);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <ListFilter className="h-4 w-4 text-gray-500" />
          {(['all', 'available', 'leased', 'pending'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setFilter(opt)}
              data-testid={`parcels-filter-${opt}`}
              className={`px-3 py-1 rounded-md ${
                filter === opt
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t(`filter.${opt}`)}
            </button>
          ))}
        </div>
      </header>

      {/* Map shell — wires into genui MapView once geo-parcels lands.
          We intentionally do NOT mount MapView yet because there are
          zero markers; an empty map is more confusing than helpful. */}
      <div
        data-testid="parcels-map-shell"
        className="h-64 w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm text-gray-500"
      >
        <MapPin className="mr-2 h-5 w-5" />
        {t('mapPlaceholder')}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-10 w-10" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((parcel) => (
            <li
              key={parcel.id}
              data-testid="parcel-card"
              data-parcel-id={parcel.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h3 className="font-semibold text-gray-900">{parcel.title}</h3>
              <p className="text-xs text-gray-500">{parcel.district}</p>
              <p className="mt-2 text-xs text-gray-700">
                {parcel.status} · {parcel.groundRentCurrency}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ParcelsMarketplacePage;
