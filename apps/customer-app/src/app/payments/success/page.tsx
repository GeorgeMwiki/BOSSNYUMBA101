'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

/**
 * Payment confirmation page. Expects `?paymentId=<id>` in the URL.
 *
 * Polls `GET /payments/:id/status` every 3s until the payment reaches a
 * terminal state (`COMPLETED`, `FAILED`, `CANCELLED`). Once completed we
 * surface the receipt details; callers may tap through to the full
 * history entry.
 */
export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId');

  const statusQuery = useQuery({
    queryKey: ['payment-status', paymentId],
    queryFn: () => api.payments.getStatus(paymentId!),
    enabled: Boolean(paymentId),
    refetchInterval: (query) => {
      const status = String(query.state.data?.status || '').toUpperCase();
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) return false;
      return 3000;
    },
  });

  const receiptQuery = useQuery({
    queryKey: ['payment-receipt', paymentId],
    queryFn: () => api.payments.getReceipt(paymentId!),
    enabled:
      Boolean(paymentId) &&
      String(statusQuery.data?.status || '').toUpperCase() === 'COMPLETED',
  });

  const status = useMemo(
    () => String(statusQuery.data?.status || '').toUpperCase(),
    [statusQuery.data]
  );

  if (!paymentId) {
    return (
      <>
        <PageHeader title="Payment Receipt" showBack />
        <div className="px-4 py-4">
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            Missing payment reference. Please return to the payments page and
            retry.
          </div>
        </div>
      </>
    );
  }

  const terminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);

  return (
    <>
      <PageHeader title="Payment Receipt" showBack />

      <div className="space-y-4 px-4 py-4 pb-24">
        {!terminal && (
          <div className="card p-6 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-400" />
            <h2 className="mt-3 text-lg font-semibold text-white">
              Waiting for M-Pesa confirmation...
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Enter your M-Pesa PIN on the prompt that appeared on your phone.
              This page will update automatically.
            </p>
          </div>
        )}

        {status === 'COMPLETED' && (
          <div className="card border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h2 className="mt-3 text-lg font-semibold text-white">
              Payment confirmed
            </h2>
            <p className="mt-1 text-sm text-emerald-100">
              We&apos;ve received your M-Pesa payment and emailed you a receipt.
            </p>
            <div className="mt-4 space-y-1 text-left text-sm text-emerald-100">
              <div>
                <span className="text-gray-400">Amount: </span>
                {statusQuery.data?.currency} {Number(statusQuery.data?.amount ?? 0).toLocaleString()}
              </div>
              {statusQuery.data?.receiptNumber && (
                <div>
                  <span className="text-gray-400">M-Pesa receipt: </span>
                  {statusQuery.data.receiptNumber}
                </div>
              )}
              {receiptQuery.data?.invoiceNumber && (
                <div>
                  <span className="text-gray-400">Invoice: </span>
                  {receiptQuery.data.invoiceNumber}
                </div>
              )}
              {statusQuery.data?.completedAt && (
                <div>
                  <span className="text-gray-400">Paid at: </span>
                  {new Date(statusQuery.data.completedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {status === 'FAILED' && (
          <div className="card border-red-500/30 bg-red-500/10 p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h2 className="mt-3 text-lg font-semibold text-white">
              Payment failed
            </h2>
            <p className="mt-1 text-sm text-red-100">
              {statusQuery.data?.failureReason ||
                'The payment did not complete. Please try again.'}
            </p>
          </div>
        )}

        {status === 'CANCELLED' && (
          <div className="card border-amber-500/30 bg-amber-500/10 p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-amber-400" />
            <h2 className="mt-3 text-lg font-semibold text-white">
              Payment cancelled
            </h2>
            <p className="mt-1 text-sm text-amber-100">
              You cancelled the M-Pesa prompt. You can try again at any time.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link href="/payments" className="btn-secondary py-3 text-center">
            Back to Payments
          </Link>
          <Link href="/payments/history" className="btn-secondary py-3 text-center">
            View History
          </Link>
        </div>
      </div>
    </>
  );
}
