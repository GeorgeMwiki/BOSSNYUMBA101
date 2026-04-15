'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Calendar, FileText, Home } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

interface CustomerLease {
  property?: { name?: string };
  unit?: { unitNumber?: string };
  unitId?: string;
  startDate: string;
  endDate: string;
  rentAmount: number | string;
  status: string;
}

export default function LeasePage() {
  const leaseQuery = useQuery({
    queryKey: ['customer-current-lease'],
    queryFn: () => api.lease.getCurrent(),
  });

  const lease = leaseQuery.data as CustomerLease | undefined;

  return (
    <>
      <PageHeader title="My Lease" showSettings />

      <div className="space-y-4 px-4 py-4 pb-24">
        {leaseQuery.isLoading && <div className="card p-4 text-sm text-gray-400">Loading lease...</div>}
        {leaseQuery.error && (
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {(leaseQuery.error as Error).message}
          </div>
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
                  <div className="mt-1 text-white">KES {Number(lease.rentAmount).toLocaleString()}</div>
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
