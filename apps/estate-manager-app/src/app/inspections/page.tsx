'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, ClipboardCheck, Plus, Calendar, AlertTriangle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { inspectionsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

export default function InspectionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inspections', { page, pageSize: 20, search: search || undefined, status: statusFilter || undefined }],
    queryFn: () => inspectionsService.list({ page, pageSize: 20, search: search || undefined, status: statusFilter || undefined }),
    retry: false,
  });

  const inspections = (data?.data ?? []) as Array<{
    id: string;
    type?: string;
    status?: string;
    scheduledDate?: string;
    propertyId?: string;
    unitId?: string;
    inspectorId?: string;
    notes?: string;
    createdAt?: string;
  }>;
  const pagination = (data as Record<string, unknown>)?.pagination as { totalItems?: number; page?: number; totalPages?: number; hasPreviousPage?: boolean; hasNextPage?: boolean } | undefined;

  return (
    <>
      <PageHeader
        title="Inspections"
        subtitle={`${pagination?.totalItems ?? inspections.length} inspections`}
        action={
          <Link href="/inspections/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Schedule
          </Link>
        }
      />

      <div className="px-4 py-4 pb-24 space-y-4 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search inspections..." className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-full sm:w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                  <div className="h-5 w-20 bg-gray-200 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Failed to load inspections</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">Please check your connection and try again.</p>
            <button onClick={() => refetch()} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : inspections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <ClipboardCheck className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No inspections yet</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">Schedule an inspection to get started.</p>
            <Link href="/inspections/new" className="btn-primary text-sm">Schedule Inspection</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {inspections.map((inspection) => (
              <Link key={inspection.id} href={`/inspections/${inspection.id}`}>
                <div className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-teal-50 rounded-lg">
                        <ClipboardCheck className="w-5 h-5 text-teal-600" />
                      </div>
                      <div>
                        <div className="font-medium capitalize">{(inspection.type ?? 'inspection').replace(/_/g, ' ')}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {inspection.scheduledDate ? new Date(inspection.scheduledDate).toLocaleDateString() : 'Not scheduled'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        inspection.status === 'completed' ? 'bg-green-100 text-green-700' :
                        inspection.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                        inspection.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {(inspection.status ?? 'unknown').replace(/_/g, ' ')}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {pagination && (pagination.totalPages ?? 0) > 1 && (
          <div className="flex justify-center gap-2 pt-4">
            <button className="btn-secondary" disabled={!pagination.hasPreviousPage} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
            <span className="py-2 text-sm text-gray-500">Page {pagination.page} of {pagination.totalPages}</span>
            <button className="btn-secondary" disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </>
  );
}
