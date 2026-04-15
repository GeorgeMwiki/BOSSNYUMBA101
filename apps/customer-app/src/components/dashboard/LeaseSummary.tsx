'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileText, ChevronRight, Home } from 'lucide-react';
import { api } from '@/lib/api';

interface LeaseSummaryData {
  property?: { name?: string };
  unit?: { unitNumber?: string; type?: string };
  unitId?: string;
  endDate?: string;
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function LeaseSummary() {
  const leaseQuery = useQuery({
    queryKey: ['customer-dashboard-lease-summary'],
    queryFn: () => api.lease.getCurrent(),
  });

  const lease = leaseQuery.data as LeaseSummaryData | undefined;

  return (
    <section>
      <h2 className="text-sm font-medium text-gray-500 mb-3">Current Lease</h2>
      {leaseQuery.isLoading && (
        <div className="card p-4 text-sm text-gray-500">Loading lease...</div>
      )}
      {leaseQuery.error && (
        <div className="card border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
          {(leaseQuery.error as Error).message}
        </div>
      )}
      {!leaseQuery.isLoading && !leaseQuery.error && !lease && (
        <div className="card p-4 text-sm text-gray-500">No active lease found.</div>
      )}
      {lease && (
        <Link href="/lease">
          <div className="card p-4 active:scale-[0.99] transition-transform">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 bg-primary-50 rounded-lg flex-shrink-0">
                  <Home className="w-5 h-5 text-primary-600" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {lease.property?.name ?? 'Active lease'}
                    {lease.unit?.unitNumber ? ` · ${lease.unit.unitNumber}` : ''}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {lease.unit?.type ?? 'Unit'}
                    {daysUntil(lease.endDate) !== null
                      ? ` · Ends in ${daysUntil(lease.endDate)} days`
                      : ''}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-primary-600">
              <FileText className="w-4 h-4" />
              <span>View full lease details</span>
            </div>
          </div>
        </Link>
      )}
    </section>
  );
}
