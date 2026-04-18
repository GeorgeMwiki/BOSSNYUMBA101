'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileText } from 'lucide-react';
import { leasesService } from '@bossnyumba/api-client';
import { Skeleton, EmptyState, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';

export function LeasesList() {
  const leasesQuery = useQuery({
    queryKey: ['leases-list-live'],
    queryFn: () => leasesService.list({ page: 1, pageSize: 50 }),
    retry: false,
  });

  const leases = leasesQuery.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Leases"
        subtitle={`${leases.length} records`}
        action={
          <Link href="/leases/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Add
          </Link>
        }
      />
      <div className="space-y-3 px-4 py-4 max-w-4xl mx-auto">
        {leasesQuery.isLoading && (
          <div aria-busy="true" aria-live="polite" className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {leasesQuery.error && (
          <Alert variant="danger">
            <AlertDescription>
              {(leasesQuery.error as Error).message}
              <Button size="sm" onClick={() => leasesQuery.refetch()} className="ml-2">Retry</Button>
            </AlertDescription>
          </Alert>
        )}
        {leases.map((lease: any) => (
          <Link key={lease.id} href={`/leases/${lease.id}`} className="card block p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{lease.customer?.name || lease.leaseNumber || lease.id}</div>
                <div className="text-sm text-gray-500">
                  {lease.unit?.unitNumber || lease.unitId} • {lease.property?.name || 'Property pending'}
                </div>
              </div>
              <div className="text-right">
                <div className="badge-info text-xs">{lease.status}</div>
                <div className="mt-1 text-sm text-gray-500">KES {Number(lease.rentAmount).toLocaleString()}</div>
              </div>
            </div>
          </Link>
        ))}
        {!leasesQuery.isLoading && !leasesQuery.error && leases.length === 0 && (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No leases yet"
            description="Create your first lease to get started."
            action={
              <Link href="/leases/new" className="btn-primary inline-block">
                Add Lease
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}
