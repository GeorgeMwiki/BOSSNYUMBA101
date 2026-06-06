'use client';

/**
 * Collections dashboard — live overview of what the team must chase.
 *
 * Composes two real gateway reads (no fallbacks):
 *   - GET /arrears/cases?status=open   open arrears cases + outstanding total
 *   - GET /invoices/overdue            overdue invoice count
 *
 * Surfaces the headline numbers and routes the operator into the arrears
 * grid, the overdue invoice list, or the record-payment flow.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileText, Wallet, ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { invoicesService } from '@bossnyumba/api-client';
import { Spinner, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { ROUTES } from '@/lib/routes';
import { formatMoney } from '@/lib/currency';
import { listOpenArrearsCases, type ArrearsCase } from '@/lib/collections-api';

export default function CollectionsPage() {
  const t = useTranslations('collectionsDashboard');

  const arrearsQuery = useQuery({
    queryKey: ['arrears', 'cases', 'list'],
    queryFn: () => listOpenArrearsCases(),
    retry: 1,
  });

  const overdueQuery = useQuery({
    queryKey: ['invoices-list-live', 'overdue'],
    queryFn: () => invoicesService.getOverdue({ page: 1, pageSize: 100 }),
    retry: 1,
  });

  const cases = useMemo<ReadonlyArray<ArrearsCase>>(
    () => arrearsQuery.data ?? [],
    [arrearsQuery.data],
  );
  const outstanding = useMemo(
    () => cases.reduce((sum, c) => sum + Number(c.totalArrearsAmount || 0), 0),
    [cases],
  );
  const outstandingCurrency = cases[0]?.currency;
  const overdueInvoices = overdueQuery.data?.data ?? [];

  const isLoading = arrearsQuery.isLoading || overdueQuery.isLoading;
  const error = arrearsQuery.error || overdueQuery.error;

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-6">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" className="text-signal-500" />
          </div>
        )}

        {error && (
          <Alert variant="danger">
            <AlertDescription>
              {(error as Error).message || t('failed')}
              <Button
                size="sm"
                onClick={() => {
                  void arrearsQuery.refetch();
                  void overdueQuery.refetch();
                }}
                className="ml-2"
              >
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card p-4">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs uppercase tracking-wide">
                    {t('outstanding')}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">
                  {formatMoney(outstanding, outstandingCurrency)}
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 text-neutral-500">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs uppercase tracking-wide">
                    {t('openCases')}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">
                  {cases.length}
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 text-neutral-500">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs uppercase tracking-wide">
                    {t('overdueInvoices')}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">
                  {overdueInvoices.length}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href={ROUTES.payments.arrears}
                className="card flex items-center justify-between p-4 hover:shadow-md transition-shadow"
              >
                <span className="font-medium">{t('viewArrears')}</span>
                <ArrowUpRight className="h-4 w-4 text-neutral-500" aria-hidden="true" />
              </Link>
              <Link
                href={ROUTES.payments.invoices}
                className="card flex items-center justify-between p-4 hover:shadow-md transition-shadow"
              >
                <span className="font-medium">{t('viewInvoices')}</span>
                <ArrowUpRight className="h-4 w-4 text-neutral-500" aria-hidden="true" />
              </Link>
              <Link
                href={ROUTES.payments.record}
                className="card flex items-center justify-between p-4 hover:shadow-md transition-shadow"
              >
                <span className="font-medium">{t('recordPayment')}</span>
                <ArrowUpRight className="h-4 w-4 text-neutral-500" aria-hidden="true" />
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
