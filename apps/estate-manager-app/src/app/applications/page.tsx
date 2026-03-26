'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText, ChevronRight, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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

  const { data, isLoading } = useQuery({
    queryKey: ['applications', { page, pageSize: 20, search: search || undefined, status: statusFilter || undefined }],
    queryFn: async () => ({ data: [], pagination: { totalItems: 0, page: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false } }),
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

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
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
          <div className="card p-8 text-center text-gray-500">Loading...</div>
        ) : applications.length === 0 ? (
          <div className="card p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No applications found</p>
            <p className="text-sm text-gray-400 mt-1">Digitize incoming application letters to start tracking</p>
            <Link href="/applications/new" className="btn-primary mt-4 inline-block">Digitize Application</Link>
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
