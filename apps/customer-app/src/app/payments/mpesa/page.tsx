'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Smartphone, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { CURRENT_BALANCE } from '@/lib/payments-data';

export default function MpesaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const amountParam = searchParams.get('amount');
  const amount = amountParam ? parseInt(amountParam, 10) : CURRENT_BALANCE;

  const [phone, setPhone] = useState('+254712345678');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user?.phone) {
      const normalized = user.phone.replace(/\s/g, '');
      setPhone(normalized.startsWith('+') ? normalized : `+${normalized}`);
    }
  }, [user?.phone]);
  const [result, setResult] = useState<'success' | 'failed' | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const formatPhone = (val: string) => {
    const nums = val.replace(/\D/g, '');
    if (nums.startsWith('254')) return `+${nums}`;
    if (nums.startsWith('0')) return `+254${nums.slice(1)}`;
    if (nums.length <= 9) return `+254${nums}`;
    return `+${nums}`;
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setResult(null);

    // Simulate M-Pesa STK push - in production would call API
    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Simulate success (90% success rate for demo)
    const success = Math.random() > 0.1;
    setResult(success ? 'success' : 'failed');
    setReference(success ? `MPESA${Date.now().toString(36).toUpperCase()}` : null);
    setIsLoading(false);
  };

  const handleSuccessContinue = () => {
    router.push(`/payments/success?ref=${reference}&amount=${amount}`);
  };

  const handleRetry = () => {
    setResult(null);
    setIsLoading(false);
  };

  if (result === 'success') {
    return (
      <>
        <PageHeader title="M-Pesa" showBack />
        <div className="px-4 py-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-success-50 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-success-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-1">KES {amount.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mb-8">Ref: {reference}</p>
          <button onClick={handleSuccessContinue} className="btn-primary w-full py-4 text-lg">
            View Receipt
          </button>
        </div>
      </>
    );
  }

  if (result === 'failed') {
    return (
      <>
        <PageHeader title="M-Pesa" showBack />
        <div className="px-4 py-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-danger-50 rounded-full flex items-center justify-center mb-6">
            <XCircle className="w-12 h-12 text-danger-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Payment Failed</h2>
          <p className="text-gray-600 mb-8">
            The payment was cancelled or timed out. Please try again.
          </p>
          <div className="flex gap-3 w-full">
            <button onClick={() => router.back()} className="btn-secondary flex-1 py-4">
              Go Back
            </button>
            <button onClick={handleRetry} className="btn-primary flex-1 py-4">
              Try Again
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Pay with M-Pesa" showBack />

      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Amount Confirmation */}
        <div className="card p-5 text-center">
          <div className="text-sm text-gray-500 mb-1">Amount to pay</div>
          <div className="text-2xl font-bold text-primary-600">
            KES {amount.toLocaleString()}
          </div>
        </div>

        {/* Phone Number */}
        <section className="card p-5">
          <label className="label">M-Pesa Phone Number</label>
          <div className="relative">
            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              className="input pl-11 py-3"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="+254 7XX XXX XXX"
              disabled={isLoading}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            You will receive an M-Pesa prompt on this number to enter your PIN
          </p>
        </section>

        {/* Info Message */}
        <div className="card p-4 bg-primary-50 border-primary-100">
          <p className="text-sm text-primary-800">
            <strong>You will receive an M-Pesa prompt</strong> on your phone. Enter your
            M-Pesa PIN to complete the payment.
          </p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || phone.replace(/\D/g, '').length < 10}
          className="btn-primary w-full py-4 text-lg font-semibold"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Awaiting confirmation...
            </span>
          ) : (
            `Pay KES ${amount.toLocaleString()}`
          )}
        </button>
      </div>
    </>
  );
}
