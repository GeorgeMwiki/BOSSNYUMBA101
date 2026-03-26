'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader2, Phone, RefreshCw, Smartphone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMutation } from '@bossnyumba/api-client';

type MpesaResponse = { checkoutRequestId?: string; message?: string };

export default function MpesaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amountParam = searchParams.get('amount');
  const amount = amountParam ? Number(amountParam) : 0;

  const [phoneNumber, setPhoneNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mpesaMutation = useMutation<MpesaResponse, { amount: number; phoneNumber: string }>(
    (client, variables) => client.post('/payments/mpesa/initiate', variables),
    {
      onSuccess: () => {
        setProcessing(true);
        // Simulate waiting for M-Pesa callback confirmation
        setTimeout(() => {
          router.push(`/payments/success?amount=${amount}&method=mpesa`);
        }, 5000);
      },
      onError: (err) => {
        setProcessing(false);
        setError(err instanceof Error ? err.message : 'Failed to initiate M-Pesa payment');
      },
    }
  );

  const formatPhoneForApi = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) return `255${digits.slice(1)}`;
    if (digits.startsWith('255')) return digits;
    return `255${digits}`;
  };

  const isValidPhone = () => {
    const digits = phoneNumber.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 12;
  };

  const handleSubmit = () => {
    if (!isValidPhone()) {
      setError('Please enter a valid phone number');
      return;
    }
    if (amount <= 0) {
      setError('Invalid payment amount');
      return;
    }
    setError(null);
    mpesaMutation.mutate({
      amount,
      phoneNumber: formatPhoneForApi(phoneNumber),
    });
  };

  return (
    <>
      <PageHeader title="Pay with M-Pesa" showBack />

      <div className="space-y-4 px-4 py-4 pb-24">
        {/* Amount display */}
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-400">Amount to pay</p>
          <p className="mt-2 text-3xl font-bold text-white">
            TZS {amount.toLocaleString()}
          </p>
        </div>

        {/* Processing state */}
        {(processing || mpesaMutation.isLoading) && (
          <div className="card p-8 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {mpesaMutation.isLoading ? 'Initiating payment...' : 'Waiting for confirmation'}
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                {mpesaMutation.isLoading
                  ? 'Sending STK push to your phone...'
                  : 'Please check your phone and enter your M-Pesa PIN to complete the payment.'}
              </p>
            </div>
            {processing && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Smartphone className="w-4 h-4" />
                <span>Check your phone for the M-Pesa prompt</span>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {error && !processing && !mpesaMutation.isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Payment failed</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">{error}</p>
            <button
              onClick={() => setError(null)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        )}

        {/* Phone input form */}
        {!processing && !mpesaMutation.isLoading && !error && (
          <>
            <div className="card p-4 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-400">M-Pesa phone number</span>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>+255</span>
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="7XX XXX XXX"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    maxLength={12}
                  />
                </div>
              </label>

              <div className="rounded-xl bg-white/5 p-3 text-xs text-gray-400 space-y-1">
                <p>An STK push will be sent to your phone.</p>
                <p>Enter your M-Pesa PIN on your phone to complete the payment.</p>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!isValidPhone() || amount <= 0}
              className="w-full btn-primary py-4 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Smartphone className="w-5 h-5" />
              Pay TZS {amount.toLocaleString()} via M-Pesa
            </button>
          </>
        )}
      </div>
    </>
  );
}
