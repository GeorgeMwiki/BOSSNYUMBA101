'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { AlertTriangle, CalendarClock, CheckCircle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type PaymentPlanRecord } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const MONTH_OPTIONS = [2, 3, 4, 6];

const schema = z.object({
  amount: z.number().int().positive('Amount is required'),
  months: z.number().int().min(2).max(12),
  reason: z.string().min(10, 'Please provide a brief reason (min 10 chars)'),
  startDate: z.string().min(1, 'Select a start date'),
  notes: z.string().optional(),
});

export default function PaymentPlanPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialAmount = Number(searchParams.get('amount') ?? '0');

  const plansQuery = useQuery<PaymentPlanRecord[]>({
    queryKey: ['payment-plans'],
    queryFn: () => api.payments.getPaymentPlans(),
  });

  const [amount, setAmount] = useState<string>(initialAmount ? String(initialAmount) : '');
  const [months, setMonths] = useState<number>(3);
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState(() =>
    new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const installmentAmount = useMemo(() => {
    const n = Number(amount);
    if (!n || months < 1) return 0;
    return Math.round((n / months) * 100) / 100;
  }, [amount, months]);

  const request = useMutation({
    mutationFn: () => {
      const parsed = schema.parse({
        amount: Number(amount),
        months,
        reason,
        startDate,
        notes,
      });
      return api.payments.requestPaymentPlan(parsed);
    },
    onSuccess: () => {
      toast.success('Payment plan request submitted for approval');
      queryClient.invalidateQueries({ queryKey: ['payment-plans'] });
      router.push('/payments');
    },
    onError: (err) => {
      if (err instanceof z.ZodError) {
        setError(err.issues[0]?.message ?? 'Please check your input');
        return;
      }
      toast.error(
        err instanceof Error ? err.message : 'Failed to submit plan request',
        'Submission failed'
      );
    },
  });

  return (
    <>
      <PageHeader title="Payment Plan" showBack />
      <div className="space-y-5 px-4 py-4 pb-24">
        <div className="card flex items-start gap-3 p-4">
          <div className="rounded-xl bg-primary-500/10 p-3">
            <CalendarClock className="h-6 w-6 text-primary-300" />
          </div>
          <div>
            <div className="font-semibold text-white">Split your balance</div>
            <p className="text-sm text-gray-400">
              Submit a plan request and your property manager will review and approve it.
              Approved plans generate a scheduled set of payments.
            </p>
          </div>
        </div>

        {plansQuery.isLoading && (
          <div className="card flex items-center gap-2 p-4 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your plans...
          </div>
        )}

        {plansQuery.data && plansQuery.data.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-gray-400">Existing plans</h2>
            <div className="space-y-2">
              {plansQuery.data.map((plan) => (
                <div key={plan.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-white">
                        {plan.months}-month plan · KES {plan.amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        Start: {new Date(plan.startDate).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs uppercase text-gray-300">
                      {plan.status}
                    </span>
                  </div>
                  {plan.installments?.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-gray-400">
                      {plan.installments.slice(0, 4).map((inst, i) => (
                        <li key={i} className="flex items-center justify-between">
                          <span>
                            {new Date(inst.dueDate).toLocaleDateString()} · KES{' '}
                            {inst.amount.toLocaleString()}
                          </span>
                          {inst.paid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300">
                              <CheckCircle className="h-3 w-3" /> Paid
                            </span>
                          ) : (
                            <span className="text-gray-500">Due</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            request.mutate();
          }}
          className="card space-y-3 p-4"
        >
          <div className="font-semibold text-white">Request a new plan</div>
          <div>
            <label className="label" htmlFor="amount">
              Total amount (KES)
            </label>
            <input
              id="amount"
              type="number"
              min={1}
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Installments</label>
            <div className="grid grid-cols-4 gap-2">
              {MONTH_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`card py-3 text-center text-sm font-medium ${
                    months === m
                      ? 'ring-2 ring-primary-500 bg-primary-500/10 text-white'
                      : 'text-gray-300'
                  }`}
                >
                  {m} months
                </button>
              ))}
            </div>
            {installmentAmount > 0 && (
              <p className="mt-2 text-xs text-gray-400">
                Approx. KES {installmentAmount.toLocaleString()} per month
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="startDate">
              First payment date
            </label>
            <input
              id="startDate"
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="reason">
              Reason
            </label>
            <textarea
              id="reason"
              className="input min-h-[80px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="notes">
              Additional notes (optional)
            </label>
            <textarea
              id="notes"
              className="input min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            className="btn-primary w-full py-3"
            disabled={request.isPending}
          >
            {request.isPending ? 'Submitting...' : 'Submit plan request'}
          </button>
        </form>
      </div>
    </>
  );
}
