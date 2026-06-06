'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type CaseRecord } from '@/lib/api';

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-blue-500/15 text-blue-300',
  INVESTIGATING: 'bg-amber-500/15 text-amber-300',
  PENDING_RESPONSE: 'bg-amber-500/15 text-amber-300',
  PENDING_EVIDENCE: 'bg-amber-500/15 text-amber-300',
  MEDIATION: 'bg-amber-500/15 text-amber-300',
  ESCALATED: 'bg-red-500/15 text-red-300',
  RESOLVED: 'bg-green-500/15 text-green-300',
  CLOSED: 'bg-gray-500/15 text-gray-300',
  WITHDRAWN: 'bg-gray-500/15 text-gray-300',
};

function statusBadgeClass(status: string): string {
  return STATUS_BADGE[status.toUpperCase()] ?? 'bg-gray-500/15 text-gray-300';
}

export default function RequestsPage() {
  const t = useTranslations('requestsPage');

  const casesQuery = useQuery({
    queryKey: ['customer-cases'],
    queryFn: () => api.cases.list({ pageSize: 50 }),
  });

  const cases = casesQuery.data ?? [];

  return (
    <>
      <PageHeader title={t('title')} />
      <div className="space-y-4 px-4 py-4 pb-24">
        {casesQuery.isError && (
          <Alert variant="danger">
            <AlertDescription>
              {(casesQuery.error as Error).message}
              <Button size="sm" className="ml-2" onClick={() => casesQuery.refetch()}>
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {casesQuery.isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {!casesQuery.isLoading && !casesQuery.isError && cases.length === 0 && (
          <div className="rounded-2xl border border-white/10 p-8 text-center">
            <Wrench className="mx-auto mb-3 h-10 w-10 text-gray-500" />
            <p className="font-medium text-white">{t('emptyTitle')}</p>
            <p className="mt-1 text-sm text-gray-400">{t('emptyBody')}</p>
          </div>
        )}

        {cases.length > 0 && (
          <div className="space-y-3">
            {cases.map((c: CaseRecord) => (
              <Link
                key={c.id}
                href={`/requests/${c.id}`}
                className="card flex items-center justify-between gap-3 p-4 transition-colors hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">{c.caseNumber}</div>
                  <div className="truncate font-medium text-white">{c.title}</div>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(c.status)}`}>
                    {c.status.replace(/_/g, ' ')}
                  </span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/requests/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-colors hover:bg-primary-600"
        aria-label={t('newAria')}
      >
        <Plus className="h-6 w-6" />
      </Link>
    </>
  );
}
