'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Smartphone,
  Building2,
  ChevronRight,
  Shield,
  Clock,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { CURRENT_BALANCE } from '@/lib/payments-data';

type PaymentMethod = 'mpesa' | 'bank' | 'card';

interface PaymentOption {
  id: PaymentMethod;
  name: string;
  description: string;
  icon: React.ElementType;
  processingTime: string;
  fee: string;
  popular?: boolean;
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
    description: 'Visa, Mastercard accepted',
    icon: CreditCard,
    processingTime: 'Instant',
    fee: '2.5% processing fee',
  },
];

export default function PayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amountParam = searchParams.get('amount');
  const amount = amountParam ? parseInt(amountParam, 10) : CURRENT_BALANCE;
  
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [customAmount, setCustomAmount] = useState<number | null>(null);
  const [showAmountInput, setShowAmountInput] = useState(false);

  const paymentAmount = customAmount ?? amount;

  const handleContinue = () => {
    if (!selectedMethod) return;
    
    if (selectedMethod === 'mpesa') {
      router.push(`/payments/mpesa?amount=${paymentAmount}`);
    } else if (selectedMethod === 'bank') {
      router.push(`/payments/bank-transfer?amount=${paymentAmount}`);
    } else if (selectedMethod === 'card') {
      router.push(`/payments/card?amount=${paymentAmount}`);
    }
  };

  return (
    <>
      <PageHeader title="Make Payment" showBack />

      <div className="px-4 py-4 space-y-6 pb-32">
        {/* Amount Section */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-gray-500">Amount to Pay</div>
              <div className="text-3xl font-bold text-gray-900">
                KES {paymentAmount.toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => setShowAmountInput(!showAmountInput)}
              className="text-sm text-primary-600 font-medium"
            >
              {showAmountInput ? 'Cancel' : 'Change'}
            </button>
          </div>

          {showAmountInput && (
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <label className="label">Enter custom amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  KES
                </span>
                <input
                  type="number"
                  className="input pl-14"
                  placeholder={amount.toString()}
                  value={customAmount || ''}
                  onChange={(e) => setCustomAmount(e.target.value ? parseInt(e.target.value, 10) : null)}
                  min={1}
                  max={amount}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCustomAmount(Math.round(amount / 2))}
                  className="btn-secondary text-xs flex-1"
                >
                  Half (KES {Math.round(amount / 2).toLocaleString()})
                </button>
                <button
                  onClick={() => setCustomAmount(amount)}
                  className="btn-secondary text-xs flex-1"
                >
                  Full Balance
                </button>
              </div>
              {customAmount && customAmount < amount && (
                <div className="p-3 bg-warning-50 rounded-lg text-sm text-warning-700">
                  <Info className="w-4 h-4 inline mr-1" />
                  Partial payment. Remaining balance: KES {(amount - customAmount).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Payment Methods */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Select Payment Method</h2>
          <div className="space-y-3">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedMethod === option.id;

              return (
                <button
                  key={option.id}
                  onClick={() => setSelectedMethod(option.id)}
                  className={`card p-4 w-full text-left transition-all ${
                    isSelected
                      ? 'ring-2 ring-primary-500 bg-primary-50 border-primary-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-xl ${
                        isSelected ? 'bg-primary-100' : 'bg-gray-100'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          isSelected ? 'text-primary-600' : 'text-gray-600'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{option.name}</span>
                        {option.popular && (
                          <span className="badge-success text-xs">Popular</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{option.description}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {option.processingTime}
                        </span>
                        <span>{option.fee}</span>
                      </div>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Security Note */}
        <div className="flex items-start gap-3 text-sm text-gray-600">
          <Shield className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
          <p>
            All payments are secured with bank-level encryption. Your financial
            information is never stored on our servers.
          </p>
        </div>

        {/* Payment Plan Link */}
        <Link
          href={`/payments/plan?amount=${paymentAmount}`}
          className="card p-4 flex items-center gap-3 bg-primary-50 border-primary-100"
        >
          <div className="p-2 bg-primary-100 rounded-lg">
            <Clock className="w-5 h-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-primary-900">Need a payment plan?</div>
            <div className="text-sm text-primary-700">
              Split your balance into manageable installments
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-primary-600" />
        </Link>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <button
          onClick={handleContinue}
          disabled={!selectedMethod}
          className="btn-primary w-full py-4 text-base font-semibold disabled:opacity-50"
        >
          {selectedMethod ? (
            <span className="flex items-center justify-center gap-2">
              Continue to {paymentOptions.find((o) => o.id === selectedMethod)?.name}
              <ChevronRight className="w-5 h-5" />
            </span>
          ) : (
            'Select a payment method'
          )}
        </button>
      </div>
    </>
  );
}
