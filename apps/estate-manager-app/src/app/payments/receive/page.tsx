'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { getApiClient } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

interface PaymentForm {
  tenantId: string;
  amount: string;
  paymentMethod: string;
  reference: string;
  notes: string;
}

export default function ReceivePaymentPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<PaymentForm>({
    tenantId: '',
    amount: '',
    paymentMethod: 'cash',
    reference: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: PaymentForm) => {
      const client = getApiClient();
      const response = await client.post('/payments/receive', {
        tenantId: data.tenantId,
        amount: parseFloat(data.amount),
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        notes: data.notes,
      });
      return response;
    },
    onSuccess: () => {
      router.push('/payments');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to record payment. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.tenantId || !formData.amount) {
      setError('Tenant and amount are required.');
      return;
    }
    if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    mutation.mutate(formData);
  };

  const handleChange = (field: keyof PaymentForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <PageHeader title="Record Payment" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Tenant ID</label>
            <input
              type="text"
              className="input"
              value={formData.tenantId}
              onChange={(e) => handleChange('tenantId', e.target.value)}
              placeholder="Enter tenant ID or search"
            />
          </div>

          <div>
            <label className="label">Amount (TZS)</label>
            <input
              type="number"
              className="input"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              placeholder="0"
              min="0"
              step="1000"
            />
          </div>

          <div>
            <label className="label">Payment Method</label>
            <select
              className="input"
              value={formData.paymentMethod}
              onChange={(e) => handleChange('paymentMethod', e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div>
            <label className="label">Reference Number</label>
            <input
              type="text"
              className="input"
              value={formData.reference}
              onChange={(e) => handleChange('reference', e.target.value)}
              placeholder="Receipt or transaction reference"
            />
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional payment notes"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            {mutation.isPending ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </>
  );
}
