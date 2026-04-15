'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2, Smartphone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

/**
 * Customer-facing "Pay Rent via M-Pesa" page.
 *
 * Flow:
 *  1. Read outstanding balance (defaults amount input)
 *  2. Collect M-Pesa phone and confirm/override amount
 *  3. POST /payments/mpesa/stk-push with `{amount, phone, invoiceId}`
 *  4. On success, route to /payments/success?paymentId=<id> which polls
 *     /payments/:id/status until the user completes the PIN prompt.
 */
export default function MpesaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qsAmount = searchParams.get('amount');
  const qsInvoiceId = searchParams.get('invoiceId') ?? undefined;

  const balanceQuery = useQuery({
    queryKey: ['customer-payments-balance'],
    queryFn: () => api.payments.getBalance(),
  });

  const defaultAmount = useMemo(() => {
    if (qsAmount) {
      const parsed = Number(qsAmount);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    const total = Number(balanceQuery.data?.totalDue?.amount ?? 0);
    return total > 0 ? total : 0;
  }, [qsAmount, balanceQuery.data]);

  const [amount, setAmount] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAmount = amount ? Number(amount) : defaultAmount;

  const canSubmit =
    !submitting &&
    Number.isFinite(effectiveAmount) &&
    effectiveAmount > 0 &&
    /^(?:\+?254|0)?[17]\d{8}$/.test(phone.replace(/\s/g, ''));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await api.payments.stkPush({
        amount: effectiveAmount,
        phone: phone.replace(/\s/g, ''),
        invoiceId: qsInvoiceId,
      });

      if (!result?.paymentId) {
        throw new Error('Payment service returned no paymentId');
      }

      router.push(`/payments/success?paymentId=${encodeURIComponent(result.paymentId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send STK push');
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="Pay with M-Pesa" showBack />

      <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4 pb-24">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <Smartphone className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="font-medium text-white">M-Pesa STK Push</div>
              <div className="text-sm text-gray-400">
                You will receive a prompt on your phone to enter your M-Pesa PIN.
              </div>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="text-sm text-gray-400">Outstanding balance</div>
          <div className="mt-1 text-xl font-semibold text-white">
            {balanceQuery.isLoading
              ? 'Loading...'
              : balanceQuery.data
              ? `${balanceQuery.data.totalDue.currency} ${Number(
                  balanceQuery.data.totalDue.amount
                ).toLocaleString()}`
              : 'Unavailable'}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-gray-300">Amount (KES)</span>
          <input
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            className="input w-full"
            placeholder={defaultAmount ? String(defaultAmount) : 'Enter amount'}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={submitting}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-gray-300">M-Pesa phone number</span>
          <input
            type="tel"
            inputMode="tel"
            className="input w-full"
            placeholder="07XX XXX XXX or 2547XX XXX XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={submitting}
            autoComplete="tel"
          />
        </label>

        {error && (
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary w-full py-4 text-base font-semibold disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Sending STK Push...
            </span>
          ) : (
            'Send STK Push'
          )}
        </button>

        <p className="text-center text-xs text-gray-500">
          By proceeding, you authorise BOSSNYUMBA to request a payment of the
          amount above from your M-Pesa account. You will confirm the payment
          on your phone with your M-Pesa PIN.
        </p>
      </form>
    </>
  );
}
