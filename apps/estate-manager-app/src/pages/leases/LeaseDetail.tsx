'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { leasesService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

interface LeaseDetailProps {
  leaseId: string;
}

export function LeaseDetail({ leaseId }: LeaseDetailProps) {
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
        title={lease?.leaseNumber || 'Lease'}
        showBack
        action={lease ? <Link href={`/leases/${leaseId}/renew`} className="btn-primary text-sm">Renew</Link> : null}
      />
      <div className="space-y-4 px-4 py-4 max-w-3xl mx-auto">
        {leaseQuery.isLoading && <div className="card p-4 text-sm text-gray-500">Loading lease...</div>}
        {leaseQuery.error && <div className="card p-4 text-sm text-danger-600">{(leaseQuery.error as Error).message}</div>}
        {lease && (
          <>
            <div className="card p-4">
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-sm text-gray-500">Customer</div><div className="font-medium">{lease.customer?.name || lease.customerId}</div></div>
                <div><div className="text-sm text-gray-500">Unit</div><div className="font-medium">{lease.unit?.unitNumber || lease.unitId}</div></div>
                <div><div className="text-sm text-gray-500">Status</div><div className="font-medium">{lease.status}</div></div>
                <div><div className="text-sm text-gray-500">Rent</div><div className="font-medium">KES {Number(lease.rentAmount).toLocaleString()}</div></div>
                <div><div className="text-sm text-gray-500">Start Date</div><div className="font-medium">{new Date(lease.startDate).toLocaleDateString()}</div></div>
                <div><div className="text-sm text-gray-500">End Date</div><div className="font-medium">{new Date(lease.endDate).toLocaleDateString()}</div></div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
