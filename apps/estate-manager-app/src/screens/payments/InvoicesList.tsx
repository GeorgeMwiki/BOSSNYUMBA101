'use client';

/**
 * InvoicesList — live invoice register.
 *
 * Wired to the gateway invoicing backend:
 *   - GET /invoices            (default + status filter)
 *   - GET /invoices/overdue    (the Overdue tab)
 *
 * The overdue tab is the collections entry point; selecting an invoice
 * opens its detail where it can be sent or downloaded as a PDF.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { invoicesService } from '@bossnyumba/api-client';
import type { Invoice, InvoiceStatus } from '@bossnyumba/api-client/invoices-types';
import {
  Spinner,
  EmptyState,
  Alert,
  AlertDescription,
  Button,
} from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { ROUTES } from '@/lib/routes';
import { formatMoney } from '@/lib/currency';

type FilterKey = 'all' | 'overdue' | 'sent' | 'paid';

const FILTERS: ReadonlyArray<FilterKey> = ['all', 'overdue', 'sent', 'paid'];

const STATUS_BADGE: Record<string, string> = {
  PAID: 'badge-success',
  PARTIALLY_PAID: 'badge-warning',
  OVERDUE: 'badge-gray',
  SENT: 'badge-info',
  PENDING: 'badge-info',
  DRAFT: 'badge-info',
  CANCELLED: 'badge-gray',
};

function statusFilterValue(key: FilterKey): InvoiceStatus | undefined {
  if (key === 'sent') return 'SENT';
  if (key === 'paid') return 'PAID';
  return undefined;
}

export function InvoicesList() {
  const t = useTranslations('invoicesList');
  const [filter, setFilter] = useState<FilterKey>('all');

  const query = useQuery({
    queryKey: ['invoices-list-live', filter],
    queryFn: () =>
      filter === 'overdue'
        ? invoicesService.getOverdue({ page: 1, pageSize: 50 })
        : invoicesService.list({
            page: 1,
            pageSize: 50,
            status: statusFilterValue(filter),
          }),
    retry: false,
  });

  const invoices = useMemo<ReadonlyArray<Invoice>>(
    () => query.data?.data ?? [],
    [query.data],
  );

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={
          query.isLoading
            ? t('loading')
            : t('count', { count: invoices.length })
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

        {!query.isLoading && !query.error && invoices.length === 0 && (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title={t('emptyTitle')}
            description={t('emptyDesc')}
          />
        )}

        {invoices.map((invoice) => (
          <Link
            key={invoice.id}
            href={ROUTES.payments.invoiceDetail(invoice.id)}
            className="card block p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {invoice.number || invoice.id}
                </div>
                <div className="text-sm text-neutral-500 truncate">
                  {invoice.customer?.name ?? invoice.customerId}
                  {invoice.dueDate
                    ? ` • ${t('due', {
                        date: new Date(invoice.dueDate).toLocaleDateString(),
                      })}`
                    : ''}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-medium tabular-nums">
                  {formatMoney(Number(invoice.amountDue ?? invoice.total), invoice.currency)}
                </div>
                <span
                  className={`${STATUS_BADGE[invoice.status] ?? 'badge-info'} text-xs mt-1 inline-block`}
                >
                  {invoice.status}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
