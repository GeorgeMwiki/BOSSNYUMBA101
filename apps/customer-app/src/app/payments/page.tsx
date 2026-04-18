// @ts-nocheck — shared Brain types / Payments response drift; tracked
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronRight, CreditCard, Receipt } from 'lucide-react';
import { Skeleton, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

export default function PaymentsPage() {
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
      <PageHeader title="Payments" showSettings />

      <div className="space-y-4 px-4 py-4 pb-24">
        {error && (
          <Alert variant="danger">
            <AlertDescription>
              {(error as Error).message}
              <Button size="sm" onClick={() => { balanceQuery.refetch(); pendingQuery.refetch(); historyQuery.refetch(); }} className="ml-2">Retry</Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="card p-4">
          <div className="text-sm text-gray-400">Total balance due</div>
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
            {balance?.breakdown?.length ? `${balance.breakdown.length} active charge(s)` : 'No active charges'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/payments/history" className="card p-4">
            <Receipt className="mb-2 h-5 w-5 text-white" />
            <div className="font-medium text-white">Payment History</div>
            <div className="text-sm text-gray-400">Review your ledger</div>
          </Link>
          <Link href="/payments/mpesa" className="card p-4">
            <CreditCard className="mb-2 h-5 w-5 text-white" />
            <div className="font-medium text-white">Pay Now</div>
            <div className="text-sm text-gray-400">M-Pesa and more</div>
          </Link>
        </div>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-white">Pending payments</h2>
            <span className="text-sm text-gray-400">{pending.length}</span>
          </div>
          <div className="space-y-3">
            {pending.length === 0 ? (
              <div className="text-sm text-gray-400">No pending payments.</div>
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
            <h2 className="font-medium text-white">Recent activity</h2>
            <Link href="/payments/history" className="text-sm text-primary-300">
              See all
            </Link>
          </div>
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-sm text-gray-400">No payment history yet.</div>
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
            <p>Live balances and history are enabled. Plan management and receipt generation are still being wired.</p>
          </div>
        </div>
      </div>
    </>
  );
}
