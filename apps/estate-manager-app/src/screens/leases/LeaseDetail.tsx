'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { leasesService } from '@bossnyumba/api-client';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

interface LeaseDetailProps {
  leaseId: string;
}

export function LeaseDetail({ leaseId }: LeaseDetailProps) {
  const t = useTranslations('leaseDetail');
  const leaseQuery = useQuery({
    queryKey: ['lease-detail-live', leaseId],
    queryFn: () => leasesService.get(leaseId),
    enabled: !!leaseId,
    retry: false,
  });

  const lease = leaseQuery.data?.data as any;

  return (
    <>
      <PageHeader
        title={lease?.leaseNumber || t('titleFallback')}
        showBack
        action={lease ? <Link href={`/leases/${leaseId}/renew`} className="btn-primary text-sm">{t('renew')}</Link> : null}
      />
      <div className="space-y-4 px-4 py-4 max-w-3xl mx-auto">
        {leaseQuery.isLoading && <div className="card p-4 text-sm text-gray-500">{t('loading')}</div>}
        {leaseQuery.error && <div className="card p-4 text-sm text-danger-600">{(leaseQuery.error as Error).message}</div>}
        {lease && (
          <>
            <div className="card p-4">
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-sm text-gray-500">{t('customer')}</div><div className="font-medium">{lease.customer?.name || lease.customerId}</div></div>
                <div><div className="text-sm text-gray-500">{t('unit')}</div><div className="font-medium">{lease.unit?.unitNumber || lease.unitId}</div></div>
                <div><div className="text-sm text-gray-500">{t('status')}</div><div className="font-medium">{lease.status}</div></div>
                <div><div className="text-sm text-gray-500">{t('rent')}</div><div className="font-medium">KES {Number(lease.rentAmount).toLocaleString()}</div></div>
                <div><div className="text-sm text-gray-500">{t('startDate')}</div><div className="font-medium">{new Date(lease.startDate).toLocaleDateString()}</div></div>
                <div><div className="text-sm text-gray-500">{t('endDate')}</div><div className="font-medium">{new Date(lease.endDate).toLocaleDateString()}</div></div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
