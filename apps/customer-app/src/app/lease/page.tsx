'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Calendar, FileText, Home, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';

export default function LeasePage() {
  const leaseQuery = useQuery({
    queryKey: ['customer-current-lease'],
    queryFn: () => api.lease.getCurrent(),
  });

  const lease = leaseQuery.data as any;

  return (
    <>
      <PageHeader title="My Lease" showSettings />

      <div className="space-y-4 px-4 py-4 pb-24">
        {leaseQuery.isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-surface-card rounded" />
                <div className="h-3 bg-surface-card rounded w-24" />
              </div>
              <div className="h-6 bg-surface-card rounded w-48" />
              <div className="h-4 bg-surface-card rounded w-32" />
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-xl border border-white/10 p-3 space-y-2">
                    <div className="h-3 bg-surface-card rounded w-12" />
                    <div className="h-4 bg-surface-card rounded w-20" />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="card p-4 space-y-2">
                  <div className="h-5 w-5 bg-surface-card rounded" />
                  <div className="h-4 bg-surface-card rounded w-16" />
                  <div className="h-3 bg-surface-card rounded w-28" />
                </div>
              ))}
            </div>
          </div>
        )}
        {leaseQuery.error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Failed to load lease</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">{(leaseQuery.error as Error).message}</p>
            <button onClick={() => leaseQuery.refetch()} className="btn-primary text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {!leaseQuery.isLoading && !leaseQuery.error && !lease && (
          <EmptyState
            icon={FileText}
            title="No Active Lease"
            description="You don't have an active lease at the moment. Contact your property manager for assistance."
          />
        )}

        {lease && (
          <>
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-2 text-gray-400">
                <Home className="h-4 w-4" />
                Current lease
              </div>
              <div className="text-xl font-semibold text-white">{lease.property?.name || 'Active Lease'}</div>
              <div className="mt-2 text-sm text-gray-400">
                Unit {lease.unit?.unitNumber || lease.unitId}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="text-gray-400">Start</div>
                  <div className="mt-1 text-white">{new Date(lease.startDate).toLocaleDateString()}</div>
                </div>
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="text-gray-400">End</div>
                  <div className="mt-1 text-white">{new Date(lease.endDate).toLocaleDateString()}</div>
                </div>
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="text-gray-400">Rent</div>
                  <div className="mt-1 text-white">TZS {Number(lease.rentAmount).toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="text-gray-400">Status</div>
                  <div className="mt-1 text-white">{lease.status}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link href="/lease/renewal" className="card p-4">
                <Calendar className="mb-2 h-5 w-5 text-white" />
                <div className="font-medium text-white">Renewal</div>
                <div className="text-sm text-gray-400">Review extension options</div>
              </Link>
              <Link href="/lease/move-out" className="card p-4">
                <FileText className="mb-2 h-5 w-5 text-white" />
                <div className="font-medium text-white">Move Out</div>
                <div className="text-sm text-gray-400">Give notice</div>
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
