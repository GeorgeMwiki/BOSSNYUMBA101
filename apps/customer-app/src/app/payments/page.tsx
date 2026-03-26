'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, ChevronRight, CreditCard, Receipt, RefreshCw, Wallet } from 'lucide-react';
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

  const isLoading = balanceQuery.isLoading || pendingQuery.isLoading || historyQuery.isLoading;
  const error = balanceQuery.error || pendingQuery.error || historyQuery.error;
  const balance = balanceQuery.data;
  const pending = pendingQuery.data ?? [];
  const history = historyQuery.data ?? [];

  return (
    <>
      <PageHeader title="Payments" showSettings />

      <div className="space-y-4 px-4 py-4 pb-24">
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="card p-4 space-y-3">
              <div className="h-3 bg-surface-card rounded w-24" />
              <div className="h-8 bg-surface-card rounded w-40" />
              <div className="h-3 bg-surface-card rounded w-32" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="card p-4 space-y-2">
                  <div className="h-5 w-5 bg-surface-card rounded" />
                  <div className="h-4 bg-surface-card rounded w-24" />
                  <div className="h-3 bg-surface-card rounded w-28" />
                </div>
              ))}
            </div>
            <div className="card p-4 space-y-3">
              <div className="h-4 bg-surface-card rounded w-32" />
              {[1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-white/10 p-3 space-y-2">
                  <div className="h-4 bg-surface-card rounded w-28" />
                  <div className="h-3 bg-surface-card rounded w-16" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Failed to load payments</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">{(error as Error).message}</p>
            <button
              onClick={() => { balanceQuery.refetch(); pendingQuery.refetch(); historyQuery.refetch(); }}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <>
        <div className="card p-4">
          <div className="text-sm text-gray-400">Total balance due</div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {balance ? `${balance.totalDue.currency} ${Number(balance.totalDue.amount).toLocaleString()}` : 'TZS 0'}
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
              <div className="flex flex-col items-center py-6 text-center">
                <Wallet className="w-8 h-8 text-gray-500 mb-2" />
                <p className="text-sm text-gray-400">No pending payments</p>
              </div>
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
              <div className="flex flex-col items-center py-6 text-center">
                <Receipt className="w-8 h-8 text-gray-500 mb-2" />
                <p className="text-sm text-gray-400">No payment history yet</p>
              </div>
            ) : (
              history.map((payment: any) => (
                <Link
                  key={payment.id}
                  href={`/payments/${payment.id}`}
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

          </>
        )}
      </div>
    </>
  );
}
