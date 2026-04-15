'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Home, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type PaymentRecord } from '@/lib/api';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const fallbackAmount = searchParams.get('amount');
  const fallbackRef = searchParams.get('ref');
  const method = searchParams.get('method');

  const query = useQuery<PaymentRecord>({
    queryKey: ['payment', paymentId],
    queryFn: () => api.payments.getPayment(paymentId as string),
    enabled: !!paymentId,
  });

  const payment = query.data;
  const amount =
    payment?.amount !== undefined
      ? `${payment.currency ?? 'KES'} ${Number(payment.amount).toLocaleString()}`
      : fallbackAmount
      ? `KES ${Number(fallbackAmount).toLocaleString()}`
      : null;

  return (
    <>
      <PageHeader title="Payment Receipt" showBack />
      <div className="space-y-5 px-4 py-4">
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle className="h-12 w-12 text-emerald-400" />
          </div>
          <div className="text-xl font-semibold text-white">Payment recorded</div>
          <p className="text-sm text-gray-400">
            {method === 'bank'
              ? 'We received your bank transfer confirmation. We will verify with the bank shortly and update your balance.'
              : 'We have received your payment. A receipt is available in your payment history.'}
          </p>
          {amount && (
            <div className="mt-2 text-2xl font-bold text-white">{amount}</div>
          )}
          {(payment?.reference ?? fallbackRef) && (
            <div className="text-xs text-gray-400">
              Reference: <span className="font-mono">{payment?.reference ?? fallbackRef}</span>
            </div>
          )}
          {payment?.completedAt && (
            <div className="text-xs text-gray-400">
              Completed {new Date(payment.completedAt).toLocaleString()}
            </div>
          )}
        </div>

        {query.isLoading && paymentId && (
          <div className="card p-4 text-sm text-gray-400">
            Loading payment details...
          </div>
        )}

        {query.error && paymentId && (
          <div className="card border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            {(query.error as Error).message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link href="/payments/history" className="btn-secondary flex items-center justify-center gap-2 py-3">
            <Receipt className="h-4 w-4" /> Payment history
          </Link>
          <Link href="/" className="btn-primary flex items-center justify-center gap-2 py-3">
            <Home className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </div>
    </>
  );
}
