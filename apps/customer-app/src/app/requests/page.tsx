'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, Loader2, Plus, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type WorkOrderRecord } from '@/lib/api';

type TabValue = 'open' | 'closed';

const OPEN_STATUSES = new Set([
  'submitted',
  'triaged',
  'assigned',
  'scheduled',
  'in_progress',
  'in-progress',
  'on_hold',
]);

export default function RequestsPage() {
  const [tab, setTab] = useState<TabValue>('open');

  const query = useQuery<WorkOrderRecord[]>({
    queryKey: ['work-orders', 'my-requests'],
    queryFn: () => api.workOrders.list(),
    refetchInterval: 30000,
  });

  const { open, closed } = useMemo(() => {
    const all = query.data ?? [];
    return {
      open: all.filter((w) => OPEN_STATUSES.has(w.status.toLowerCase())),
      closed: all.filter((w) => !OPEN_STATUSES.has(w.status.toLowerCase())),
    };
  }, [query.data]);

  const displayed = tab === 'open' ? open : closed;

  return (
    <>
      <PageHeader title="Maintenance Requests" />
      <div className="px-4 py-4 pb-24 space-y-4">
        <div className="flex rounded-xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setTab('open')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === 'open'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-gray-400'
            }`}
          >
            Open ({open.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('closed')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === 'closed'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-gray-400'
            }`}
          >
            Closed ({closed.length})
          </button>
        </div>

        {query.isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading your requests...
          </div>
        )}

        {query.error && (
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">Could not load requests</p>
                <p>{(query.error as Error).message}</p>
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className="mt-2 text-sm underline"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {!query.isLoading && !query.error && displayed.length === 0 && (
          <div className="card flex flex-col items-center gap-2 p-10 text-center text-gray-400">
            <Wrench className="h-8 w-8 text-gray-500" />
            <p className="font-medium text-gray-200">
              No {tab === 'open' ? 'open' : 'closed'} requests
            </p>
            <p className="text-sm">
              {tab === 'open'
                ? 'Create a request to report an issue'
                : 'Closed requests will appear here'}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {displayed.map((wo) => (
            <Link
              key={wo.id}
              href={`/maintenance/${wo.id}`}
              className="card flex items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <div className="text-xs text-gray-400">
                  {wo.workOrderNumber ?? `#${wo.id.slice(0, 8)}`}
                </div>
                <div className="mt-0.5 truncate font-medium text-white">{wo.title}</div>
                <div className="mt-1 text-xs text-gray-400">
                  {wo.category} · {wo.priority} · {wo.status}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-500" />
            </Link>
          ))}
        </div>
      </div>

      <Link
        href="/requests/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-colors hover:bg-primary-600"
        aria-label="New maintenance request"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </>
  );
}
