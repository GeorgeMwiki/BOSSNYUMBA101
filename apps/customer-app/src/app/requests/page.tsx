'use client';

import Link from 'next/link';
import { useQuery } from '@bossnyumba/api-client';
import {
  Plus,
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600', icon: AlertTriangle },
};

export default function RequestsPage() {
  const {
    data: requests,
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>('/work-orders?pageSize=50');

  const requestList = Array.isArray(requests) ? requests : [];

  return (
    <>
      <PageHeader title="Maintenance Requests" />
      <div className="px-4 py-4 pb-24 space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-card rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-2/3 mb-3" />
                <div className="h-3 bg-gray-700 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-700 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl bg-surface-card border border-red-500/20 p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-white font-medium">Unable to load requests</p>
            <p className="text-gray-400 text-sm mt-1">Something went wrong. Please try again.</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && requestList.length === 0 && (
          <div className="text-center py-12">
            <div className="mx-auto p-3 bg-gray-800 rounded-full w-fit mb-4">
              <Wrench className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-white font-semibold text-lg">No maintenance requests</h3>
            <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">
              Need something fixed? Tap the button below to submit a request.
            </p>
          </div>
        )}

        {!isLoading &&
          !error &&
          requestList.map((req: any) => {
            const status = statusConfig[req.status] || statusConfig.OPEN;
            const StatusIcon = status.icon;
            return (
              <Link
                key={req.id}
                href={`/requests/${req.id}`}
                className="block bg-surface-card rounded-2xl p-4 hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">{req.title || req.description || 'Maintenance Request'}</h3>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                      {req.description || 'No description provided'}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                      {req.createdAt && (
                        <span className="text-gray-500 text-xs">
                          {new Date(req.createdAt).toLocaleDateString('en-TZ', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 mt-1 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
      </div>

      <Link
        href="/requests/new"
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-600 transition-colors z-30"
        aria-label="New maintenance request"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </>
  );
}
