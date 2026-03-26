'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { paymentsService, invoicesService } from '@bossnyumba/api-client';

export function RecordPayment() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    invoiceId: '',
    amount: '',
    paymentMethod: 'mpesa',
    reference: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  const { data: invoicesData, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', 'unpaid'],
    queryFn: () => invoicesService.list({ status: 'unpaid' }),
  });

  const invoices = invoicesData?.data ?? [];

  const recordMutation = useMutation({
    mutationFn: (request: any) => paymentsService.recordPayment(request),
    onSuccess: () => {
      router.push('/payments');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to record payment');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    recordMutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount),
    });
  };

  const selectedInvoice = invoices.find((inv: any) => inv.id === formData.invoiceId);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Record Payment</h1>
        <button onClick={() => router.back()} className="btn-secondary text-sm">
          Back
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="label">Invoice</label>
          <select
            className="input"
            value={formData.invoiceId}
            onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
            required
          >
            <option value="">Select invoice...</option>
            {loadingInvoices && <option disabled>Loading invoices...</option>}
            {invoices.map((inv: any) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNumber || inv.id} - {inv.tenantName || inv.customer?.name || 'Tenant'} - KES {inv.amount?.toLocaleString() || inv.totalAmount?.toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        {selectedInvoice && (
          <div className="card p-3 bg-blue-50 border-blue-200 text-sm">
            <p><span className="font-medium">Amount Due:</span> KES {(selectedInvoice.amount || selectedInvoice.totalAmount || selectedInvoice.balanceDue)?.toLocaleString()}</p>
            <p><span className="font-medium">Tenant:</span> {selectedInvoice.tenantName || selectedInvoice.customer?.name}</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="label">Amount (KES)</label>
          <input
            type="number"
            className="input"
            placeholder="Enter payment amount"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
            min="0"
            step="0.01"
          />
        </div>

        <div className="space-y-2">
          <label className="label">Payment Method</label>
          <select
            className="input"
            value={formData.paymentMethod}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
          >
            <option value="mpesa">M-Pesa</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="label">Reference / Transaction ID</label>
          <input
            type="text"
            className="input"
            placeholder="e.g. MPESA transaction code"
            value={formData.reference}
            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Optional notes..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            disabled={recordMutation.isPending}
            className="btn-primary flex-1"
          >
            {recordMutation.isPending ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
