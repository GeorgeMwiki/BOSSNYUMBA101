'use client';

import { useState } from 'react';
import {
  Send,
  Search,
  RefreshCw,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { getApiClient } from '@bossnyumba/api-client';

interface Notice {
  id: string;
  customerName: string;
  amount: number;
  status: string;
  dateSent: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function getStatusColor(status: string) {
  switch (status) {
    case 'sent': return 'bg-blue-100 text-blue-800';
    case 'acknowledged': return 'bg-green-100 text-green-800';
    case 'overdue': return 'bg-red-100 text-red-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export default function CollectionNoticesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['collection-notices', { page, pageSize: 20 }],
    queryFn: () =>
      getApiClient().get<Notice[]>('/collections/notices', {
        page: String(page),
        pageSize: '20',
      }),
    retry: false,
  });

  const notices: Notice[] = data?.data ?? [];
  const pagination = (data as { pagination?: { totalPages: number; page: number; hasPreviousPage: boolean; hasNextPage: boolean } })?.pagination;

  const filtered = notices.filter((n) => {
    if (!search) return true;
    return n.customerName?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <PageHeader
        title="Payment Notices"
        subtitle="Demand notices sent to customers"
        showBack
      />

      <div className="px-4 py-4 pb-24 space-y-4 max-w-4xl mx-auto">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer name..."
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                  <div className="h-5 w-16 bg-gray-200 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Failed to load notices</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">Please check your connection and try again.</p>
            <button onClick={() => refetch()} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No notices found</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">No payment demand notices have been sent yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-3">Customer</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-3">Amount</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-3">Date Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((notice) => (
                  <tr key={notice.id} className="hover:bg-gray-50">
                    <td className="py-3 px-3 text-sm font-medium">{notice.customerName}</td>
                    <td className="py-3 px-3 text-sm text-red-600 font-semibold">
                      {formatCurrency(notice.amount)}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(notice.status)}`}>
                        {notice.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-500">
                      {notice.dateSent ? new Date(notice.dateSent).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-4">
            <button
              className="btn-secondary"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="py-2 text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
