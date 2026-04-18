// @ts-nocheck — shared Brain types / Payments response drift; tracked
'use client';

import { Receipt } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton, EmptyState, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

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
          <div aria-busy="true" aria-live="polite" className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {historyQuery.error && (
          <Alert variant="danger">
            <AlertDescription>
              {(historyQuery.error as Error).message}
              <Button size="sm" onClick={() => historyQuery.refetch()} className="ml-2">Retry</Button>
            </AlertDescription>
          </Alert>
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
                <div className="text-xs text-gray-500">{payment.completedAt || payment.createdAt}</div>
              </div>
            </div>
          </div>
        ))}
        {!historyQuery.isLoading && !historyQuery.error && (historyQuery.data ?? []).length === 0 && (
          <EmptyState
            icon={<Receipt className="h-8 w-8" />}
            title="No payments yet"
            description="Your payment history will appear here."
          />
        )}
      </div>
    </>
  );
}
