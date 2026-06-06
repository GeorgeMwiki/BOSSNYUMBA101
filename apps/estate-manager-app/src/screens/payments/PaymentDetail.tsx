'use client';

/**
 * PaymentDetail — live payment-intent view.
 *
 * Fetches `GET /payments/:id` (tenant-scoped) and renders the canonical
 * amount / status / channel so an operator can confirm a payment they
 * just recorded. The status is the gateway's source of truth (pending →
 * processing → completed); a manual refresh lets the operator re-check
 * after an out-of-band settlement or M-Pesa STK confirmation.
 */

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Spinner } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatMoney } from '@/lib/currency';
import { getPayment } from '@/lib/collections-api';

interface PaymentDetailProps {
  readonly paymentId: string;
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'succeeded') return 'badge-success';
  if (s === 'failed' || s === 'cancelled') return 'badge-gray';
  return 'badge-info';
}

export function PaymentDetail({ paymentId }: PaymentDetailProps) {
  const t = useTranslations('paymentDetail');
  const query = useQuery({
    queryKey: ['payment-detail-live', paymentId],
    queryFn: () => getPayment(paymentId),
    enabled: paymentId.length > 0,
    retry: false,
  });

  const payment = query.data;

  return (
    <>
      <PageHeader
        title={payment?.paymentNumber || t('titleFallback')}
        showBack
        action={
          <button
            type="button"
            onClick={() => query.refetch()}
            className="btn-secondary text-sm flex items-center gap-1"
            disabled={query.isFetching}
            aria-busy={query.isFetching}
          >
            <RefreshCw
              className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {t('refresh')}
          </button>
        }
      />

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {query.isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" className="text-signal-500" />
          </div>
        )}

        {query.error && (
          <div className="card p-4 text-sm text-danger-600" role="alert">
            {(query.error as Error).message || t('loadFailed')}
          </div>
        )}

        {payment && (
          <div className="card p-4 grid grid-cols-2 gap-4">
            <div className="col-span-2 flex items-center justify-between">
              <div className="text-2xl font-semibold tabular-nums">
                {formatMoney(payment.amount, payment.currency)}
              </div>
              <span className={`${statusBadgeClass(payment.status)} capitalize`}>
                {payment.status}
              </span>
            </div>
            <div>
              <div className="text-sm text-neutral-500">{t('method')}</div>
              <div className="font-medium capitalize">
                {(payment.paymentMethod || t('methodUnknown')).toLowerCase()}
              </div>
            </div>
            <div>
              <div className="text-sm text-neutral-500">{t('net')}</div>
              <div className="font-medium tabular-nums">
                {formatMoney(payment.netAmount ?? payment.amount, payment.currency)}
              </div>
            </div>
            {payment.description && (
              <div className="col-span-2">
                <div className="text-sm text-neutral-500">{t('description')}</div>
                <div className="font-medium">{payment.description}</div>
              </div>
            )}
            {payment.createdAt && (
              <div>
                <div className="text-sm text-neutral-500">{t('createdAt')}</div>
                <div className="font-medium">
                  {new Date(payment.createdAt).toLocaleString()}
                </div>
              </div>
            )}
            {payment.completedAt && (
              <div>
                <div className="text-sm text-neutral-500">{t('completedAt')}</div>
                <div className="font-medium">
                  {new Date(payment.completedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
