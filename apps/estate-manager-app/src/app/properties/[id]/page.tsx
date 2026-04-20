'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Home, Edit, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton, EmptyState, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { propertiesService } from '@bossnyumba/api-client';

export default function PropertyDetailPage() {
  const t = useTranslations('propertyDetail');
  const params = useParams();
  const router = useRouter();
  const id = (params?.id ?? '') as string;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertiesService.get(id),
    retry: false,
  });

  const property = data?.data;

  if (isLoading) {
    return (
      <>
        <PageHeader title={t('title')} showBack />
        <div aria-busy="true" aria-live="polite" className="px-4 py-4 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={t('title')} showBack />
        <div className="px-4 py-4">
          <Alert variant="danger">
            <AlertDescription>
              {error instanceof Error ? error.message : t('failedToLoad')}
              <Button size="sm" onClick={() => refetch()} className="ml-2">{t('retry')}</Button>
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  if (!property) {
    return (
      <>
        <PageHeader title={t('title')} showBack />
        <div className="px-4 py-4">
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title={t('notFound')}
            description={t('removedDesc')}
            action={
              <button onClick={() => router.back()} className="btn-secondary">
                {t('goBack')}
              </button>
            }
          />
        </div>
      </>
    );
  }

  const stats = property.stats ?? {
    totalUnits: property.totalUnits ?? 0,
    occupiedUnits: property.occupiedUnits ?? 0,
    availableUnits: 0,
    occupancyRate: 0,
  };
  const occupancyRate =
    stats.totalUnits > 0 ? Math.round((stats.occupiedUnits / stats.totalUnits) * 100) : 0;

  return (
    <>
      <PageHeader
        title={property.name}
        subtitle={property.address?.city}
        showBack
        action={
          <Link href={`/properties/${id}/edit`} className="btn-secondary text-sm flex items-center gap-1">
            <Edit className="w-4 h-4" />
            {t('edit')}
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto">
        <div className="card p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {t('overview')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{stats.totalUnits}</div>
              <div className="text-xs text-gray-500">{t('totalUnits')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.occupiedUnits}</div>
              <div className="text-xs text-gray-500">{t('occupied')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.availableUnits ?? 0}</div>
              <div className="text-xs text-gray-500">{t('available')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{occupancyRate}%</div>
              <div className="text-xs text-gray-500">{t('occupancy')}</div>
            </div>
          </div>
        </div>

        {property.address && (
          <div className="card p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {t('address')}
            </h2>
            <p className="text-sm text-gray-600">
              {property.address.line1}
              <br />
              {property.address.city}
              {property.address.region && `, ${property.address.region}`}
              <br />
              {property.address.country}
            </p>
          </div>
        )}

        {property.description && (
          <div className="card p-4">
            <h2 className="font-semibold mb-3">{t('description')}</h2>
            <p className="text-sm text-gray-600">{property.description}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href={`/properties/${id}/units`}
            className="card p-4 flex-1 flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <div className="p-2 bg-primary-50 rounded-lg">
              <Home className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <div className="font-medium">{t('viewUnits')}</div>
              <div className="text-sm text-gray-500">{t('unitsCount', { count: stats.totalUnits })}</div>
            </div>
            <span className="ml-auto text-primary-600">→</span>
          </Link>
        </div>
      </div>
    </>
  );
}
