// @ts-nocheck — shared Brain types / Payments response drift; tracked
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertCircle, ChevronRight, CreditCard, Receipt } from 'lucide-react';
import { Skeleton, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

export default function PaymentsPage() {
  const t = useTranslations('paymentsIndex');
  const balanceQuery = useQuery({
    queryKey: ['customer-payments-balance'],
    queryFn: () => api.payments.getBalance(),
  });

  const pendingQuery = useQuery({
    queryKey: ['customer-payments-pending'],
    queryFn: () => api.payments.getPending(),
  });

  const historyQuery = useQuery({
    queryKey: ['customer-payments-history-preview'],
    queryFn: () => api.payments.getHistory(1, 5),
  });

  const error = balanceQuery.error || pendingQuery.error || historyQuery.error;
  const balance = balanceQuery.data;
  const pending = pendingQuery.data ?? [];
  const history = historyQuery.data ?? [];

  return (
    <>
      <PageHeader title={t('title')} showSettings />

      <div className="space-y-4 px-4 py-4 pb-24">
        {error && (
          <Alert variant="danger">
            <AlertDescription>
              {(error as Error).message}
              <Button size="sm" onClick={() => { balanceQuery.refetch(); pendingQuery.refetch(); historyQuery.refetch(); }} className="ml-2">{t('retry')}</Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="card p-4">
          <div className="text-sm text-gray-400">{t('totalBalanceDue')}</div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {balance ? (
              `${balance.totalDue.currency} ${Number(balance.totalDue.amount).toLocaleString()}`
            ) : balanceQuery.isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              '--'
            )}
          </div>
          <div className="mt-3 text-sm text-gray-400">
            {balance?.breakdown?.length ? t('activeCharges', { count: balance.breakdown.length }) : t('noActiveCharges')}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/payments/history" className="card p-4">
            <Receipt className="mb-2 h-5 w-5 text-white" />
            <div className="font-medium text-white">{t('paymentHistory')}</div>
            <div className="text-sm text-gray-400">{t('reviewLedger')}</div>
          </Link>
          <Link href="/payments/mpesa" className="card p-4">
            <CreditCard className="mb-2 h-5 w-5 text-white" />
            <div className="font-medium text-white">{t('payNow')}</div>
            <div className="text-sm text-gray-400">{t('mpesaAndMore')}</div>
          </Link>
        </div>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-white">{t('pendingPayments')}</h2>
            <span className="text-sm text-gray-400">{pending.length}</span>
          </div>
          <div className="space-y-3">
            {pending.length === 0 ? (
              <div className="text-sm text-gray-400">{t('noPendingPayments')}</div>
            ) : (
              pending.map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between rounded-xl border border-white/10 p-3">
                  <div>
                    <div className="font-medium text-white">{payment.description || payment.paymentNumber}</div>
                    <div className="text-sm text-gray-400">{payment.status}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white">{payment.currency} {Number(payment.amount).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-white">{t('recentActivity')}</h2>
            <Link href="/payments/history" className="text-sm text-primary-300">
              {t('seeAll')}
            </Link>
          </div>
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-sm text-gray-400">{t('noPaymentHistory')}</div>
            ) : (
              history.map((payment: any) => (
                <Link
                  key={payment.id}
                  href="/payments/history"
                  className="flex items-center justify-between rounded-xl border border-white/10 p-3"
                >
                  <div>
                    <div className="font-medium text-white">{payment.description || payment.paymentNumber}</div>
                    <div className="text-sm text-gray-400">{payment.status}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-white">{payment.currency} {Number(payment.amount).toLocaleString()}</div>
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <div className="card border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{t('liveNotice')}</p>
          </div>
        </div>
      </div>
    </>
  );
}
