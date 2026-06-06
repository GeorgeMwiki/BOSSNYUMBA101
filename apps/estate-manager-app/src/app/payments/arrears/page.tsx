'use client';

/**
 * Arrears grid — live tenant-scoped arrears cases.
 *
 * Reads `GET /arrears/cases` on the gateway (the previous build called
 * non-existent /api/payments/arrears endpoints). Each row is an open
 * arrears case the collections team works; the operator can filter
 * client-side and jump to record a payment that clears the balance.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { listOpenArrearsCases, type ArrearsCase } from '@/lib/collections-api';

function riskBand(daysOverdue: number): 'low' | 'medium' | 'high' {
  if (daysOverdue >= 60) return 'high';
  if (daysOverdue >= 30) return 'medium';
  return 'low';
}

const RISK_BADGE: Record<'low' | 'medium' | 'high', string> = {
  low: 'badge-info',
  medium: 'badge-warning',
  high: 'badge-gray',
};

export default function ArrearsPage() {
  const t = useTranslations('arrearsGrid');
  const [filter, setFilter] = useState('');

  const query = useQuery({
    queryKey: ['arrears', 'cases', 'list'],
    queryFn: () => listOpenArrearsCases(),
    retry: 1,
  });

  const cases = useMemo<ReadonlyArray<ArrearsCase>>(() => query.data ?? [], [
    query.data,
  ]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return cases;
    return cases.filter((c) => c.customerId.toLowerCase().includes(needle));
  }, [cases, filter]);

  const total = useMemo(
    () => filtered.reduce((sum, c) => sum + Number(c.totalArrearsAmount || 0), 0),
    [filtered],
  );
  const totalCurrency = filtered[0]?.currency;

  return (
    <>
      <PageHeader title={t('title')} />

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="text"
            className="input flex-1"
            placeholder={t('filterPlaceholder')}
            aria-label={t('filterAria')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filtered.length > 0 && (
            <div className="text-sm text-neutral-500">
              {t('totalLabel', { total: formatMoney(total, totalCurrency) })}
            </div>
          )}
        </div>

        {query.isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" className="text-signal-500" />
          </div>
        )}

        {query.error && (
          <Alert variant="danger">
            <AlertDescription>
              {(query.error as Error).message || t('failedLoad')}
              <Button size="sm" onClick={() => query.refetch()} className="ml-2">
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!query.isLoading && !query.error && filtered.length === 0 && (
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8" />}
            title={
              filter ? t('emptyTitleNoMatch') : t('emptyTitleNoArrears')
            }
            description={
              filter ? t('emptyDescNoMatch') : t('emptyDescNoArrears')
            }
            action={
              filter ? (
                <Button size="sm" onClick={() => setFilter('')}>
                  {t('clearFilter')}
                </Button>
              ) : undefined
            }
          />
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-border">
                  <th className="py-2 pr-3 font-medium">{t('colTenant')}</th>
                  <th className="py-2 pr-3 font-medium">{t('colDaysOverdue')}</th>
                  <th className="py-2 pr-3 font-medium">{t('colInvoices')}</th>
                  <th className="py-2 pr-3 font-medium text-right">
                    {t('colOwed')}
                  </th>
                  <th className="py-2 pr-3 font-medium">{t('colRisk')}</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const risk = riskBand(c.daysOverdue);
                  return (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{c.customerId}</td>
                      <td className="py-2 pr-3 tabular-nums">{c.daysOverdue}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {c.overdueInvoiceCount}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums font-medium">
                        {formatMoney(Number(c.totalArrearsAmount), c.currency)}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`${RISK_BADGE[risk]} capitalize`}>
                          {t(`risk_${risk}` as 'risk_low' | 'risk_medium' | 'risk_high')}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          href={ROUTES.payments.record}
                          className="text-signal-500 hover:underline"
                        >
                          {t('recordPayment')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
