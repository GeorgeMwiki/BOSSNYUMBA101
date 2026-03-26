'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText, ChevronRight, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { applicationsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-gray-100 text-gray-700',
  digitized: 'bg-blue-100 text-blue-700',
  at_station: 'bg-blue-100 text-blue-700',
  routed_to_hq: 'bg-indigo-100 text-indigo-700',
  at_emu: 'bg-purple-100 text-purple-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  pending_civil_eng: 'bg-orange-100 text-orange-700',
  pending_dg: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function ApplicationsListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['applications', { page, pageSize: 20, search: search || undefined, status: statusFilter || undefined }],
    queryFn: () => applicationsService.list({ page, pageSize: 20, search: search || undefined, status: statusFilter || undefined }),
    retry: false,
  });

  const applications = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title="Applications"
        subtitle={`${pagination?.totalItems ?? applications.length} applications`}
        action={
          <Link href="/applications/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Digitize New
          </Link>
        }
      />

      <div className="px-4 py-4 pb-24 space-y-4 max-w-4xl mx-auto">
        {/* Status Pipeline */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['all', 'received', 'at_emu', 'under_review', 'pending_dg', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                (s === 'all' && !statusFilter) || statusFilter === s
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setStatusFilter(s === 'all' ? '' : s)}
            >
              {s === 'all' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by applicant name or number..."
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Applications List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
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
            <h3 className="text-base font-semibold text-gray-900 mb-1">Failed to load applications</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">Please check your connection and try again.</p>
            <button onClick={() => refetch()} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No applications yet</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">Digitize incoming application letters to start tracking.</p>
            <Link href="/applications/new" className="btn-primary text-sm">Digitize Application</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app: {
              id: string;
              applicationNumber: string;
              applicantName: string;
              type: string;
              status: string;
              letterReceivedDate?: string;
              requestedLocation?: string;
              proposedRentAmount?: number;
            }) => (
              <Link key={app.id} href={`/applications/${app.id}`}>
                <div className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        app.status === 'approved' ? 'bg-green-50' :
                        app.status === 'rejected' ? 'bg-red-50' : 'bg-blue-50'
                      }`}>
                        {app.status === 'approved' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                         app.status === 'rejected' ? <XCircle className="w-5 h-5 text-red-600" /> :
                         <FileText className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div>
                        <div className="font-medium">{app.applicantName}</div>
                        <div className="text-sm text-gray-500">
                          {app.applicationNumber} • {app.type?.replace(/_/g, ' ')}
                        </div>
                        {app.letterReceivedDate && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <Clock className="w-3 h-3" />
                            Received {new Date(app.letterReceivedDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[app.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {app.status?.replace(/_/g, ' ')}
                      </span>
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
            <button className="btn-secondary" disabled={!pagination.hasPreviousPage} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
            <span className="py-2 text-sm text-gray-500">Page {pagination.page} of {pagination.totalPages}</span>
            <button className="btn-secondary" disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </>
  );
}
