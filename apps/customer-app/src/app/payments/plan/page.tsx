'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Calendar, Check, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMutation } from '@bossnyumba/api-client';

interface PlanOption {
  months: number;
  label: string;
  description: string;
}

const PLAN_OPTIONS: PlanOption[] = [
  { months: 2, label: '2 Months', description: 'Split into 2 equal payments' },
  { months: 3, label: '3 Months', description: 'Split into 3 equal payments' },
  { months: 6, label: '6 Months', description: 'Split into 6 equal payments' },
];

export default function PaymentPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amountParam = searchParams.get('amount');
  const amount = amountParam ? Number(amountParam) : 0;

  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestPlanMutation = useMutation<
    unknown,
    { amount: number; months: number; reason: string; startDate: string }
  >(
    (client, variables) => client.post('/payments/plans', variables),
    {
      onSuccess: () => {
        router.push('/payments');
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to request payment plan');
      },
    }
  );

  const calculateMonthly = (months: number): number => {
    return Math.ceil(amount / months);
  };

  const handleRequestPlan = () => {
    if (selectedPlan === null) return;
    if (amount <= 0) {
      setError('Invalid payment amount');
      return;
    }
    setError(null);
    const today = new Date().toISOString().split('T')[0];
    requestPlanMutation.mutate({
      amount,
      months: selectedPlan,
      reason: 'Installment payment plan request',
      startDate: today,
    });
  };

  return (
    <>
      <PageHeader title="Payment Plan" showBack />

      <div className="space-y-4 px-4 py-4 pb-24">
        {/* Amount header */}
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-400">Total amount</p>
          <p className="mt-2 text-3xl font-bold text-white">
            TZS {amount.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-gray-400">Choose an installment plan below</p>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Request failed</h3>
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

        {/* Plan options */}
        {!error && (
          <>
            <div className="space-y-3">
              {PLAN_OPTIONS.map((plan) => {
                const monthly = calculateMonthly(plan.months);
                const isSelected = selectedPlan === plan.months;

                return (
                  <button
                    key={plan.months}
                    onClick={() => setSelectedPlan(plan.months)}
                    className={`w-full card p-4 text-left transition-all ${
                      isSelected
                        ? 'ring-2 ring-primary-500 bg-primary-500/5'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <h3 className="font-semibold text-white">{plan.label}</h3>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{plan.description}</p>
                        <p className="text-lg font-bold text-white mt-2">
                          TZS {monthly.toLocaleString()}
                          <span className="text-sm font-normal text-gray-400"> /month</span>
                        </p>
                      </div>
                      <div className="ml-3 flex-shrink-0">
                        {isSelected ? (
                          <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 border-2 border-white/20 rounded-full" />
                        )}
                      </div>
                    </div>

                    {/* Payment schedule preview */}
                    {isSelected && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                        {Array.from({ length: plan.months }, (_, i) => {
                          const date = new Date();
                          date.setMonth(date.getMonth() + i);
                          return (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 text-gray-400">
                                <ChevronRight className="w-3 h-3" />
                                <span>
                                  {date.toLocaleString('en-TZ', { month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <span className="text-white">TZS {monthly.toLocaleString()}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Request button */}
            <button
              onClick={handleRequestPlan}
              disabled={selectedPlan === null || requestPlanMutation.isLoading || amount <= 0}
              className="w-full btn-primary py-4 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {requestPlanMutation.isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting request...
                </>
              ) : (
                'Request Plan'
              )}
            </button>

            <p className="text-center text-xs text-gray-400">
              Your request will be reviewed by property management. You will be notified once approved.
            </p>
          </>
        )}
      </div>
    </>
  );
}
