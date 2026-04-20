'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Building2, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton, EmptyState, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { propertiesService } from '@bossnyumba/api-client';

export default function PropertiesListPage() {
  const t = useTranslations('propertiesListPage');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['properties', { page, pageSize: 20, search: search || undefined, status: statusFilter || undefined }],
    queryFn: () =>
      propertiesService.list({
        page,
        pageSize: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
    retry: false,
  });

  const properties = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('totalCount', { count: pagination?.totalItems ?? properties.length })}
        action={
          <Link href="/properties/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            {t('add')}
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              className="input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-full sm:w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t('allStatus')}</option>
            <option value="ACTIVE">{t('statusActive')}</option>
            <option value="INACTIVE">{t('statusInactive')}</option>
            <option value="UNDER_CONSTRUCTION">{t('statusUnderConstruction')}</option>
          </select>
        </div>

        {isLoading ? (
          <div aria-busy="true" aria-live="polite" className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <Alert variant="danger">
            <AlertDescription>
              {error instanceof Error ? error.message : t('failedToLoad')}
              <Button size="sm" onClick={() => refetch()} className="ml-2">{t('retry')}</Button>
            </AlertDescription>
          </Alert>
        ) : properties.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title={t('emptyTitle')}
            description={search || statusFilter ? t('emptyFilteredDesc') : t('emptyDesc')}
            action={
              <Link href="/properties/new" className="btn-primary inline-block">
                {t('addProperty')}
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {properties.map((property: { id: string; name: string; type?: string; address?: { city?: string }; totalUnits?: number; occupiedUnits?: number; status?: string }) => (
              <Link key={property.id} href={`/properties/${property.id}`}>
                <div className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary-50 rounded-lg">
                        <Building2 className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <div className="font-medium">{property.name}</div>
                        <div className="text-sm text-gray-500">
                          {property.address?.city} • {t('unitsLabel', { count: property.totalUnits ?? 0 })} • {t('occupiedLabel', { count: property.occupiedUnits ?? 0 })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge-info text-xs">{property.status ?? 'ACTIVE'}</span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-4">
            <button
              className="btn-secondary"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('previous')}
            </button>
            <span className="py-2 text-sm text-gray-500">
              {t('pageOf', { page: pagination.page, total: pagination.totalPages })}
            </span>
            <button
              className="btn-secondary"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('next')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
