'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Home } from 'lucide-react';
import { unitsService } from '@bossnyumba/api-client';
import { Empty, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

export default function UnitsPage() {
  const t = useTranslations('unitsPage');
  const unitsQuery = useQuery({
    queryKey: ['units-list-live'],
    queryFn: () => unitsService.list({ page: 1, pageSize: 100 }),
    retry: false,
  });

  const units = Array.isArray(unitsQuery.data?.data) ? unitsQuery.data!.data! : [];

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={unitsQuery.isLoading ? t('loading') : t('unitsCount', { count: units.length })}
        action={
          <Link
            href="/units/new"
            className="btn-primary text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />{t('add')}
          </Link>
        }
      />

      <div className="space-y-3 px-4 py-4 max-w-4xl mx-auto">
        {unitsQuery.isLoading && (
          <div className="card p-4 text-sm text-gray-500">{t('loadingUnits')}</div>
        )}

        {unitsQuery.error && (
          <Alert variant="danger">
            <AlertDescription>
              {(unitsQuery.error as Error).message || t('failedToLoad')}
              <Button size="sm" onClick={() => unitsQuery.refetch()} className="ml-2">
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!unitsQuery.isLoading && !unitsQuery.error && units.length === 0 && (
          <Empty
            variant="default"
            icon={<Home className="h-8 w-8 text-gray-400" />}
            title={t('emptyTitle')}
            description={t('emptyDesc')}
            action={{
              label: t('addUnit'),
              onClick: () => {
                window.location.href = '/units/new';
              },
            }}
          />
        )}

        {units.map((unit: Record<string, unknown>) => {
          const id = unit.id as string;
          const unitNumber = (unit.unitNumber as string) ?? id;
          const status = (unit.status as string) ?? 'unknown';
          const type = (unit.type as string) ?? '';
          const bedrooms = unit.bedrooms as number | undefined;

          return (
            <Link
              key={id}
              href={`/units/${id}/edit`}
              className="card block p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{unitNumber}</div>
                  <div className="text-sm text-gray-500">
                    {type}{bedrooms != null ? ` • ${t('bedsLabel', { count: bedrooms })}` : ''}
                  </div>
                </div>
                <div className="badge-info text-xs capitalize">{status.toLowerCase()}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
