'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

interface PaymentRecord {
  id: string;
  description?: string;
  paymentNumber?: string;
  status: string;
  amount: number;
  currency: string;
  completedAt?: string;
  createdAt?: string;
}

export default function PaymentHistoryPage() {
  const historyQuery = useQuery({
    queryKey: ['customer-payments-history'],
    queryFn: () => api.payments.getHistory(1, 50) as Promise<PaymentRecord[]>,
  });

  return (
    <>
      <PageHeader title="Payment History" showBack />

      <div className="space-y-3 px-4 py-4 pb-24">
        {historyQuery.isLoading && <div className="card p-4 text-sm text-gray-400">Loading payment history...</div>}
        {historyQuery.error && (
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {(historyQuery.error as Error).message}
          </div>
        )}
        {(historyQuery.data ?? []).map((payment) => (
          <div key={payment.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-white">{payment.description || payment.paymentNumber}</div>
                <div className="text-sm text-gray-400">{payment.status}</div>
              </div>
              <div className="text-right">
                <div className="text-white">{payment.currency} {Number(payment.amount).toLocaleString()}</div>
                <div className="text-xs text-gray-500">{payment.completedAt || payment.createdAt}</div>
              </div>
            </div>
          </div>
        ))}
        {!historyQuery.isLoading && !historyQuery.error && (historyQuery.data ?? []).length === 0 && (
          <div className="card p-4 text-sm text-gray-400">No payments found.</div>
        )}
      </div>
    </>
  );
}
