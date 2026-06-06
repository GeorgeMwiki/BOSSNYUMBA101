'use client';

/**
 * MaintenanceDashboard — live maintenance request queue.
 *
 * Reads `GET /maintenance/requests` (the real lifecycle store) and groups
 * by status so an operator can triage, dispatch, and close. Each row
 * opens the work-order detail where the dispatch/complete actions live.
 * No mock SLA/category telemetry — counts are derived from live rows.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Spinner,
  EmptyState,
  Alert,
  AlertDescription,
  Button,
} from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { PriorityBadge } from '@/components/maintenance';
import type { WorkOrderPriority } from '@/components/maintenance/PriorityBadge';
import { ROUTES } from '@/lib/routes';
import {
  listMaintenanceRequests,
  type MaintenanceRequest,
  type MaintenanceStatus,
} from '@/lib/maintenance-api';

type FilterKey = 'open' | 'dispatched' | 'completed' | 'all';

const FILTERS: ReadonlyArray<FilterKey> = [
  'open',
  'dispatched',
  'completed',
  'all',
];

/** A request is "open" until it has been dispatched/closed. */
const OPEN_STATUSES: ReadonlyArray<MaintenanceStatus> = [
  'submitted',
  'triaged',
  'classified',
  'awaiting_parts',
];

function statusFilterValue(key: FilterKey): MaintenanceStatus | undefined {
  if (key === 'dispatched') return 'dispatched';
  if (key === 'completed') return 'completed';
  return undefined;
}

function normalizePriority(p: string | null): WorkOrderPriority {
  const lower = (p ?? 'medium').toLowerCase();
  if (lower === 'urgent' || lower === 'emergency') return 'emergency';
  if (lower === 'high') return 'high';
  if (lower === 'low') return 'low';
  return 'medium';
}

const STATUS_BADGE: Record<string, string> = {
  submitted: 'badge-info',
  triaged: 'badge-info',
  classified: 'badge-info',
  dispatched: 'badge-warning',
  in_progress: 'badge-warning',
  awaiting_parts: 'badge-warning',
  completed: 'badge-success',
  verified: 'badge-success',
  rejected: 'badge-gray',
  cancelled: 'badge-gray',
};

export default function MaintenanceDashboard() {
  const t = useTranslations('maintenanceDashboard');
  const [filter, setFilter] = useState<FilterKey>('open');

  // The list endpoint takes a single status; the "open" tab spans several
  // pre-dispatch statuses, so for it (and "all") we fetch unfiltered and
  // narrow client-side.
  const serverStatus = statusFilterValue(filter);
  const query = useQuery({
    queryKey: ['maintenance-requests', serverStatus ?? 'all'],
    queryFn: () => listMaintenanceRequests(serverStatus),
    retry: 1,
  });

  const requests = useMemo<ReadonlyArray<MaintenanceRequest>>(() => {
    const rows = query.data ?? [];
    if (filter === 'open') {
      return rows.filter((r) => OPEN_STATUSES.includes(r.status));
    }
    return rows;
  }, [query.data, filter]);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={
          query.isLoading ? t('loading') : t('count', { count: requests.length })
        }
        action={
          <Link
            href={ROUTES.workOrders.new}
            className="btn-primary text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            {t('newRequest')}
          </Link>
        }
      />

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('title')}>
          {FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={
                filter === key
                  ? 'rounded-full bg-signal-500 px-3 py-1 text-xs font-medium text-primary-foreground'
                  : 'rounded-full border border-border px-3 py-1 text-xs text-neutral-500 hover:border-border-strong'
              }
            >
              {t(`filter_${key}` as `filter_${FilterKey}`)}
            </button>
          ))}
        </div>

        {query.isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" className="text-signal-500" />
          </div>
        )}

        {query.error && (
          <Alert variant="danger">
            <AlertDescription>
              {(query.error as Error).message || t('failed')}
              <Button size="sm" onClick={() => query.refetch()} className="ml-2">
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!query.isLoading && !query.error && requests.length === 0 && (
          <EmptyState
            icon={<Wrench className="h-8 w-8" />}
            title={t('emptyTitle')}
            description={t('emptyDesc')}
            action={
              <Link href={ROUTES.workOrders.new} className="btn-primary inline-block">
                {t('newRequest')}
              </Link>
            }
          />
        )}

        {requests.map((req) => (
          <Link
            key={req.id}
            href={ROUTES.workOrders.detail(req.id)}
            className="card block p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{req.title}</div>
                <div className="text-sm text-neutral-500 truncate">
                  {req.requestNumber}
                  {req.location ? ` • ${req.location}` : ''}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span
                  className={`${STATUS_BADGE[req.status] ?? 'badge-info'} text-xs capitalize`}
                >
                  {req.status.replace(/_/g, ' ')}
                </span>
                <PriorityBadge priority={normalizePriority(req.priority)} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
