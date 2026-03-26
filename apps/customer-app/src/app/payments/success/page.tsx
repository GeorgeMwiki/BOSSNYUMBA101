'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Download, Home } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

function generateReceiptRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'RCP-';
  for (let i = 0; i < 10; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amountParam = searchParams.get('amount');
  const amount = amountParam ? Number(amountParam) : 0;
  const method = searchParams.get('method') ?? 'M-Pesa';
  const externalRef = searchParams.get('ref');

  const referenceNumber = externalRef || generateReceiptRef();
  const timestamp = new Date().toLocaleString('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const methodLabel =
    method === 'bank-transfer'
      ? 'Bank Transfer'
      : method === 'mpesa'
        ? 'M-Pesa'
        : method;

  return (
    <>
      <PageHeader title="Payment Receipt" showBack />

      <div className="space-y-6 px-4 py-4 pb-24">
        {/* Success icon and message */}
        <div className="flex flex-col items-center text-center pt-8 pb-4">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 animate-[scale-in_0.3s_ease-out]">
            <CheckCircle className="w-12 h-12 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Payment Successful</h2>
          <p className="text-sm text-gray-400 mt-2">
            Your payment has been processed successfully
          </p>
        </div>

        {/* Amount card */}
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-400">Amount paid</p>
          <p className="mt-2 text-3xl font-bold text-green-400">
            TZS {amount.toLocaleString()}
          </p>
        </div>

        {/* Details card */}
        <div className="card p-4 space-y-4">
          <h3 className="font-semibold text-white">Transaction Details</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-white/10 p-3">
              <span className="text-sm text-gray-400">Reference Number</span>
              <span className="text-sm font-medium text-white">{referenceNumber}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 p-3">
              <span className="text-sm text-gray-400">Payment Method</span>
              <span className="text-sm font-medium text-white">{methodLabel}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 p-3">
              <span className="text-sm text-gray-400">Date &amp; Time</span>
              <span className="text-sm font-medium text-white">{timestamp}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 p-3">
              <span className="text-sm text-gray-400">Status</span>
              <span className="text-sm font-medium text-green-400">Completed</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={() => {
              // In production, this would trigger a receipt download
              window.print();
            }}
            className="w-full card py-4 flex items-center justify-center gap-2 text-white font-semibold hover:bg-white/5 transition-colors"
          >
            <Download className="w-5 h-5" />
            View Receipt
          </button>

          <button
            onClick={() => router.push('/payments')}
            className="w-full btn-primary py-4 text-base font-semibold flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Done
          </button>
        </div>
      </div>
    </>
  );
}
