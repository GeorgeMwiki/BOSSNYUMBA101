'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { CheckCircle, Loader2, Smartphone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ''))
  .refine((v) => /^(?:\+?254|0)?\d{9}$/.test(v), {
    message: 'Enter a valid Kenyan phone number',
  })
  .transform((v) => {
    const digits = v.replace(/\D/g, '');
    if (digits.startsWith('254')) return `+${digits}`;
    if (digits.startsWith('0')) return `+254${digits.slice(1)}`;
    return `+254${digits}`;
  });

const formSchema = z.object({
  phone: phoneSchema,
  amount: z.number().int().positive('Amount must be positive'),
});

type MpesaState = 'idle' | 'initiating' | 'awaiting_confirmation' | 'success' | 'failed';

export default function MpesaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const initialAmount = Number(searchParams.get('amount') ?? '0');
  const [amount, setAmount] = useState<string>(initialAmount ? String(initialAmount) : '');
  const [phone, setPhone] = useState('');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [state, setState] = useState<MpesaState>('idle');
  const [reference, setReference] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initiate = useMutation({
    mutationFn: (input: { phone: string; amount: number }) =>
      api.payments.initiateMpesa({
        phoneNumber: input.phone,
        amount: input.amount,
      }),
    onMutate: () => {
      setErrorMessage(null);
      setState('initiating');
    },
    onSuccess: (data) => {
      setPaymentId(data.paymentId);
      setReference(data.reference ?? null);
      setState('awaiting_confirmation');
      toast.info('STK push sent. Check your phone to complete the payment.');
    },
    onError: (err) => {
      setState('failed');
      const message = err instanceof Error ? err.message : 'Could not initiate payment';
      setErrorMessage(message);
      toast.error(message, 'Payment failed');
    },
  });

  const statusQuery = useQuery({
    queryKey: ['mpesa-payment-status', paymentId],
    queryFn: () => api.payments.getMpesaStatus(paymentId as string),
    enabled: !!paymentId && state === 'awaiting_confirmation',
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!statusQuery.data) return;
    const status = statusQuery.data.status?.toLowerCase();
    if (!status) return;
    if (['completed', 'succeeded', 'success', 'paid'].includes(status)) {
      setState('success');
      setReference(statusQuery.data.reference ?? reference ?? null);
      toast.success('Payment received successfully');
      setTimeout(() => {
        router.replace(
          `/payments/success?paymentId=${paymentId}&amount=${encodeURIComponent(amount)}&ref=${encodeURIComponent(
            statusQuery.data.reference ?? reference ?? ''
          )}`
        );
      }, 700);
    } else if (['failed', 'cancelled', 'canceled', 'timeout', 'expired'].includes(status)) {
      setState('failed');
      setErrorMessage('Payment was not completed. Please try again.');
    }
  }, [statusQuery.data, amount, paymentId, reference, router, toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      const parsed = formSchema.parse({ phone, amount: Number(amount) });
      initiate.mutate(parsed);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setErrorMessage(err.issues[0]?.message ?? 'Invalid input');
      } else {
        setErrorMessage('Invalid input');
      }
    }
  };

  const busy =
    state === 'initiating' || state === 'awaiting_confirmation' || initiate.isPending;

  return (
    <>
      <PageHeader title="Pay with M-Pesa" showBack />

      <div className="space-y-6 px-4 py-4 pb-24">
        <div className="card flex items-start gap-3 p-4">
          <div className="rounded-xl bg-emerald-500/10 p-3">
            <Smartphone className="h-6 w-6 text-emerald-300" />
          </div>
          <div>
            <div className="font-semibold text-white">M-Pesa STK Push</div>
            <div className="text-sm text-gray-400">
              You will receive a prompt on your phone to enter your M-Pesa PIN.
            </div>
          </div>
        </div>

        {state === 'success' ? (
          <SuccessCard amount={amount} reference={reference} />
        ) : state === 'awaiting_confirmation' ? (
          <AwaitingCard />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="phone">
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="input"
                placeholder="+254 7XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={busy}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="amount">
                Amount (KES)
              </label>
              <input
                id="amount"
                type="number"
                inputMode="numeric"
                className="input"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
                required
              />
            </div>
            {errorMessage && (
              <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}
            <button
              type="submit"
              className="btn-primary w-full py-4 text-base font-semibold"
              disabled={busy || !phone || !amount}
            >
              {initiate.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Initiating...
                </span>
              ) : (
                'Send STK push'
              )}
            </button>
            {state === 'failed' && (
              <button
                type="button"
                onClick={() => {
                  setState('idle');
                  setPaymentId(null);
                }}
                className="text-sm text-primary-400 underline"
              >
                Try again
              </button>
            )}
          </form>
        )}
      </div>
    </>
  );
}

function AwaitingCard() {
  return (
    <div className="card flex flex-col items-center gap-3 p-6 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary-400" />
      <div className="text-lg font-semibold text-white">Check your phone</div>
      <p className="text-sm text-gray-400">
        Enter your M-Pesa PIN on the prompt to complete the payment. This page will update
        automatically.
      </p>
    </div>
  );
}

function SuccessCard({ amount, reference }: { amount: string; reference: string | null }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-6 text-center">
      <CheckCircle className="h-12 w-12 text-emerald-400" />
      <div className="text-xl font-semibold text-white">Payment successful</div>
      <div className="text-sm text-gray-400">
        KES {Number(amount).toLocaleString()}
        {reference ? ` · Ref ${reference}` : ''}
      </div>
    </div>
  );
}

