'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { CreditCard, AlertCircle, RefreshCw } from 'lucide-react';

function SkeletonPayment() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-surface-card rounded" />
          <div className="h-3 w-20 bg-surface-card rounded" />
        </div>
        <div className="space-y-2 text-right">
          <div className="h-4 w-24 bg-surface-card rounded ml-auto" />
          <div className="h-3 w-16 bg-surface-card rounded ml-auto" />
        </div>
      </div>
    </div>
  );
}

export default function PaymentHistoryPage() {
  const historyQuery = useQuery({
    queryKey: ['customer-payments-history'],
    queryFn: () => api.payments.getHistory(1, 50),
  });

  return (
    <>
      <PageHeader title="Payment History" showBack />

      <div className="space-y-3 px-4 py-4 pb-24">
        {historyQuery.isLoading && (
          <>
            <SkeletonPayment />
            <SkeletonPayment />
            <SkeletonPayment />
            <SkeletonPayment />
            <SkeletonPayment />
          </>
        )}

        {historyQuery.error && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-surface-card rounded-2xl flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Failed to load payments</h3>
            <p className="text-sm text-gray-400 max-w-xs mb-6">
              {(historyQuery.error as Error).message}
            </p>
            <button
              onClick={() => historyQuery.refetch()}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {(historyQuery.data ?? []).map((payment: any) => (
          <div key={payment.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-white">{payment.description || payment.paymentNumber}</div>
                <div className="text-sm text-gray-400">{payment.status}</div>
              </div>
              <div className="text-right">
                <div className="text-white">{payment.currency} {Number(payment.amount).toLocaleString()}</div>
                <div className="text-xs text-gray-500">{(payment.completedAt || payment.createdAt) ? new Date(payment.completedAt || payment.createdAt).toLocaleDateString('en-TZ', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</div>
              </div>
            </div>
          </div>
        ))}

        {!historyQuery.isLoading && !historyQuery.error && (historyQuery.data ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-surface-card rounded-2xl flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No payments yet</h3>
            <p className="text-sm text-gray-400 max-w-xs">
              Your payment history will appear here once you make your first payment.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
