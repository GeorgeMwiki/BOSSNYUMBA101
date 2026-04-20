'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { leasesService } from '@bossnyumba/api-client';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

interface LeaseRenewalProps {
  leaseId: string;
}

export function LeaseRenewal({ leaseId }: LeaseRenewalProps) {
  const t = useTranslations('simple');
  const tMisc = useTranslations('misc');
  const router = useRouter();
  const leaseQuery = useQuery({
    queryKey: ['lease-renewal-live', leaseId],
    queryFn: () => leasesService.get(leaseId),
    enabled: !!leaseId,
    retry: false,
  });

  const renewal = useMutation({
    mutationFn: () => leasesService.renew(leaseId, { extendMonths: 12 }),
    onSuccess: () => router.push(`/leases/${leaseId}`),
  });

  return (
    <>
      <PageHeader title={t('renewLease')} showBack />
      <div className="space-y-4 px-4 py-4 max-w-2xl mx-auto">
        {leaseQuery.error && <div className="card p-4 text-sm text-danger-600">{(leaseQuery.error as Error).message}</div>}
        {leaseQuery.data?.data && (
          <div className="card p-4 space-y-3">
            <div className="text-sm text-gray-500">{tMisc('currentEndDate')}</div>
            <div className="text-lg font-medium">{new Date((leaseQuery.data.data as any).endDate).toLocaleDateString()}</div>
            <div className="text-sm text-gray-500">{tMisc('renewalHint')}</div>
            <button className="btn-primary" onClick={() => renewal.mutate()} disabled={renewal.isPending}>
              {renewal.isPending ? 'Renewing...' : 'Renew for 12 Months'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
