'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import {
  paymentsService,
  type CustomerCreatePaymentInput,
} from '@bossnyumba/api-client';

type PaymentMethodChoice = 'mpesa' | 'card' | 'bank';

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  method?: string;
  reference?: string;
  status?: string;
  createdAt?: string;
}

interface FormErrors {
  amount?: string;
  method?: string;
  reference?: string;
  submit?: string;
}

const METHOD_OPTIONS: { value: PaymentMethodChoice; label: string }[] = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank Transfer' },
];

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency || 'KES',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function normalizePaymentRow(raw: unknown): PaymentRow {
  const record = (raw ?? {}) as Record<string, unknown>;
  const amountField = record.amount as
    | { amount?: number; currency?: string }
    | number
    | undefined;
  const amount =
    typeof amountField === 'number'
      ? amountField
      : typeof amountField?.amount === 'number'
        ? amountField.amount
        : 0;
  const currency =
    typeof amountField === 'object' && amountField?.currency
      ? amountField.currency
      : 'KES';
  return {
    id: String(record.id ?? record.intentId ?? ''),
    amount,
    currency,
    method: record.method as string | undefined,
    reference: record.reference as string | undefined,
    status: record.status as string | undefined,
    createdAt: record.createdAt as string | undefined,
  };
}

export default function PaymentsPage() {
  const { user, tenantId } = useAuth() as {
    user: unknown;
    token: string | null;
    tenantId?: string;
  };

  // Form state
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethodChoice>('mpesa');
  const [reference, setReference] = useState<string>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History state
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!tenantId) {
      setHistory([]);
      setLoadError(null);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await paymentsService.listPayments({
        tenantId,
        limit: 20,
      });
      const rows = Array.isArray(response?.data)
        ? response.data.map(normalizePaymentRow)
        : [];
      setHistory(rows);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load payment history';
      setLoadError(message);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const validate = useCallback((): FormErrors => {
    const next: FormErrors = {};
    const numericAmount = Number(amount);
    if (!amount.trim()) {
      next.amount = 'Amount is required';
    } else if (Number.isNaN(numericAmount)) {
      next.amount = 'Amount must be a number';
    } else if (numericAmount <= 0) {
      next.amount = 'Amount must be greater than 0';
    }
    if (!method) {
      next.method = 'Payment method is required';
    }
    return next;
  }, [amount, method]);

  const canSubmit = useMemo(() => {
    const numeric = Number(amount);
    return (
      !!tenantId &&
      !!amount.trim() &&
      !Number.isNaN(numeric) &&
      numeric > 0 &&
      !!method &&
      !isSubmitting
    );
  }, [amount, method, tenantId, isSubmitting]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validation = validate();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    if (!tenantId) {
      setErrors({ submit: 'You must be signed in to submit a payment' });
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      const payload: CustomerCreatePaymentInput = {
        tenantId,
        amount: Number(amount),
        method,
        reference: reference.trim() || undefined,
      };
      await paymentsService.createPayment(payload);
      setAmount('');
      setReference('');
      setMethod('mpesa');
      await loadHistory();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to submit payment';
      setErrors({ submit: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Payments" />
      <div className="px-4 py-4 space-y-6 pb-24">
        <form
          onSubmit={handleSubmit}
          aria-label="Submit payment"
          data-testid="payment-form"
          className="card p-4 space-y-4"
        >
          <h2 className="text-lg font-semibold">Make a payment</h2>

          <div>
            <label htmlFor="payment-amount" className="label">
              Amount (KES)
            </label>
            <input
              id="payment-amount"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="input"
              aria-invalid={errors.amount ? 'true' : 'false'}
              aria-describedby={errors.amount ? 'payment-amount-error' : undefined}
            />
            {errors.amount && (
              <p
                id="payment-amount-error"
                role="alert"
                className="text-xs text-danger-600 mt-1"
              >
                {errors.amount}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="payment-method" className="label">
              Payment method
            </label>
            <select
              id="payment-method"
              name="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethodChoice)}
              className="input"
            >
              {METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="payment-reference" className="label">
              Reference (optional)
            </label>
            <input
              id="payment-reference"
              name="reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. invoice number"
              className="input"
            />
          </div>

          {errors.submit && (
            <p role="alert" className="text-sm text-danger-600">
              {errors.submit}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary w-full py-3 text-base font-semibold"
          >
            {isSubmitting ? 'Submitting...' : 'Submit payment'}
          </button>
        </form>

        <section aria-label="Payment history" data-testid="payment-history">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Payment history</h2>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="text-sm text-primary-600"
              disabled={isLoading}
            >
              Refresh
            </button>
          </div>

          {isLoading && (
            <div role="status" className="card p-4 text-sm text-gray-500">
              Loading payments...
            </div>
          )}

          {!isLoading && loadError && (
            <div role="alert" className="card p-4 text-sm text-danger-600">
              {loadError}
            </div>
          )}

          {!isLoading && !loadError && history.length === 0 && (
            <div className="card p-4 text-sm text-gray-500">
              No payments yet.
            </div>
          )}

          {!isLoading && !loadError && history.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-50 last:border-0"
                      data-testid={`payment-row-${row.id}`}
                    >
                      <td className="px-3 py-2 text-gray-700">
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {formatAmount(row.amount, row.currency)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {row.method ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {row.reference ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {row.status ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {!tenantId && (
          <p className="text-xs text-gray-500">
            {user
              ? 'Your account is not associated with a tenancy yet.'
              : 'Sign in to submit a payment and view history.'}
          </p>
        )}
      </div>
    </>
  );
}
