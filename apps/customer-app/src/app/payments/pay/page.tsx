'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  ChevronRight,
  Clock,
  CreditCard,
  Info,
  Shield,
  Smartphone,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type BalanceSummary } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

type PaymentMethod = 'mpesa' | 'bank' | 'card';

interface PaymentOption {
  id: PaymentMethod;
  name: string;
  description: string;
  icon: React.ElementType;
  processingTime: string;
  fee: string;
  popular?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

const paymentOptions: PaymentOption[] = [
  {
    id: 'mpesa',
    name: 'M-Pesa',
    description: 'Pay instantly via M-Pesa STK Push',
    icon: Smartphone,
    processingTime: 'Instant',
    fee: 'No fees',
    popular: true,
  },
  {
    id: 'bank',
    name: 'Bank Transfer',
    description: 'Transfer from your bank account',
    icon: Building2,
    processingTime: '1-2 business days',
    fee: 'Bank fees may apply',
  },
  {
    id: 'card',
    name: 'Card Payment',
    description: 'Card processing not yet enabled on your account',
    icon: CreditCard,
    processingTime: 'Instant',
    fee: '2.5% processing fee',
    disabled: true,
    disabledReason: 'Card payments are not yet available. Please use M-Pesa or Bank Transfer.',
  },
];

export default function PayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const balanceQuery = useQuery<BalanceSummary>({
    queryKey: ['customer-payments-balance'],
    queryFn: () => api.payments.getBalance(),
  });

  const amountParam = searchParams.get('amount');
  const serverAmount = balanceQuery.data?.totalDue.amount ?? 0;
  const amount = amountParam ? parseInt(amountParam, 10) : serverAmount;
  const currency = balanceQuery.data?.totalDue.currency ?? 'KES';

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [customAmount, setCustomAmount] = useState<number | null>(null);
  const [showAmountInput, setShowAmountInput] = useState(false);

  const paymentAmount = customAmount ?? amount;

  const handleContinue = () => {
    if (!selectedMethod || paymentAmount <= 0) return;

    if (selectedMethod === 'mpesa') {
      router.push(`/payments/mpesa?amount=${paymentAmount}`);
    } else if (selectedMethod === 'bank') {
      router.push(`/payments/bank-transfer?amount=${paymentAmount}`);
    } else {
      toast.warning(
        'Card processing is not yet available in this tenant. Choose M-Pesa or Bank Transfer instead.',
        'Card payment unavailable'
      );
    }
  };

  return (
    <>
      <PageHeader title="Make Payment" showBack />

      <div className="space-y-6 px-4 py-4 pb-32">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Amount to Pay</div>
              <div className="text-3xl font-bold text-white">
                {currency} {paymentAmount.toLocaleString()}
              </div>
              {balanceQuery.isLoading && (
                <div className="mt-1 text-xs text-gray-400">Loading balance...</div>
              )}
              {balanceQuery.error && (
                <div className="mt-1 text-xs text-red-300">
                  {(balanceQuery.error as Error).message}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowAmountInput(!showAmountInput)}
              className="text-sm font-medium text-primary-400"
            >
              {showAmountInput ? 'Cancel' : 'Change'}
            </button>
          </div>

          {showAmountInput && (
            <div className="space-y-3 border-t border-white/10 pt-4">
              <label className="label">Enter custom amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {currency}
                </span>
                <input
                  type="number"
                  className="input pl-14"
                  placeholder={amount.toString()}
                  value={customAmount || ''}
                  onChange={(e) =>
                    setCustomAmount(e.target.value ? parseInt(e.target.value, 10) : null)
                  }
                  min={1}
                  max={amount || undefined}
                />
              </div>
              {amount > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomAmount(Math.round(amount / 2))}
                    className="btn-secondary flex-1 text-xs"
                  >
                    Half ({currency} {Math.round(amount / 2).toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomAmount(amount)}
                    className="btn-secondary flex-1 text-xs"
                  >
                    Full Balance
                  </button>
                </div>
              )}
              {customAmount && amount > 0 && customAmount < amount && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  Partial payment. Remaining balance: {currency}{' '}
                  {(amount - customAmount).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-gray-500">Select Payment Method</h2>
          <div className="space-y-3">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedMethod === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    option.disabled ? undefined : setSelectedMethod(option.id)
                  }
                  className={`card w-full p-4 text-left transition-all ${
                    option.disabled
                      ? 'cursor-not-allowed opacity-60'
                      : isSelected
                      ? 'ring-2 ring-primary-500 bg-primary-50/10'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`rounded-xl p-3 ${
                        isSelected ? 'bg-primary-500/20' : 'bg-white/5'
                      }`}
                    >
                      <Icon
                        className={`h-6 w-6 ${
                          isSelected ? 'text-primary-300' : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{option.name}</span>
                        {option.popular && (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{option.description}</p>
                      <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {option.processingTime}
                        </span>
                        <span>{option.fee}</span>
                      </div>
                    </div>
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        isSelected
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-gray-500'
                      }`}
                    >
                      {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex items-start gap-3 text-sm text-gray-400">
          <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
          <p>
            All payments are secured with bank-level encryption. Your financial information is
            never stored on our servers.
          </p>
        </div>

        <Link
          href={`/payments/plan?amount=${paymentAmount}`}
          className="card flex items-center gap-3 border border-primary-500/30 bg-primary-500/5 p-4"
        >
          <div className="rounded-lg bg-primary-500/20 p-2">
            <Clock className="h-5 w-5 text-primary-300" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-primary-200">Need a payment plan?</div>
            <div className="text-sm text-primary-300/80">
              Split your balance into manageable installments
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-primary-300" />
        </Link>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#121212] p-4">
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedMethod || paymentAmount <= 0}
          className="btn-primary w-full py-4 text-base font-semibold disabled:opacity-50"
        >
          {selectedMethod ? (
            <span className="flex items-center justify-center gap-2">
              Continue to {paymentOptions.find((o) => o.id === selectedMethod)?.name}
              <ChevronRight className="h-5 w-5" />
            </span>
          ) : (
            'Select a payment method'
          )}
        </button>
      </div>
    </>
  );
}
