'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { MoneyDisplay } from '@/components/MoneyDisplay';

const mockLeases = [
  { id: '1', unit: 'A-204', tenant: 'John Kamau', property: 'Sunset Apartments', rent: 45000 },
  { id: '2', unit: 'B-102', tenant: 'Mary Wanjiku', property: 'Sunset Apartments', rent: 52000 },
  { id: '3', unit: 'C-301', tenant: 'Peter Ochieng', property: 'Sunset Apartments', rent: 48000 },
];

const mockInvoices = [
  { id: '1', leaseId: '1', amount: 45000, dueDate: '2024-03-01', type: 'rent' },
  { id: '2', leaseId: '1', amount: 45000, dueDate: '2024-04-01', type: 'rent' },
  { id: '3', leaseId: '2', amount: 52000, dueDate: '2024-03-15', type: 'rent' },
];

interface FormState {
  leaseId: string;
  invoiceId: string;
  amount: string;
  method: 'mpesa' | 'bank' | 'cash' | 'card';
  reference: string;
  paidDate: string;
  notes: string;
}

const initialForm: FormState = {
  leaseId: '',
  invoiceId: '',
  amount: '',
  method: 'mpesa',
  reference: '',
  paidDate: new Date().toISOString().split('T')[0],
  notes: '',
};

export function RecordPayment() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  const selectedLease = mockLeases.find((l) => l.id === form.leaseId);
  const availableInvoices = mockInvoices.filter((i) => i.leaseId === form.leaseId);
  const selectedInvoice = mockInvoices.find((i) => i.id === form.invoiceId);

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'leaseId') {
      setForm((prev) => ({ ...prev, invoiceId: '', amount: '' }));
    }
    if (field === 'invoiceId' && value) {
      const inv = mockInvoices.find((i) => i.id === value);
      if (inv) setForm((prev) => ({ ...prev, amount: String(inv.amount) }));
    }
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.leaseId) newErrors.leaseId = 'Select a lease';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      newErrors.amount = 'Enter a valid amount';
    }
    if (!form.reference.trim()) newErrors.reference = 'Reference is required';
    if (!form.paidDate) newErrors.paidDate = 'Payment date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      router.push('/payments');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Record Payment"
        subtitle="Manual payment entry"
        showBack
      />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6">
        <div className="card p-4 space-y-4">
          <h3 className="font-medium">Lease & Invoice</h3>

          <div>
            <label htmlFor="leaseId" className="block text-sm font-medium text-gray-700 mb-1.5">
              Lease <span className="text-red-500">*</span>
            </label>
            <select
              id="leaseId"
              value={form.leaseId}
              onChange={(e) => update('leaseId', e.target.value)}
              className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.leaseId ? 'border-red-500' : 'border-gray-200'
              }`}
            >
              <option value="">Select lease</option>
              {mockLeases.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.unit} - {l.tenant} • {l.property}
                </option>
              ))}
            </select>
            {errors.leaseId && (
              <p className="mt-1 text-sm text-red-600">{errors.leaseId}</p>
            )}
          </div>

          {form.leaseId && (
            <div>
              <label htmlFor="invoiceId" className="block text-sm font-medium text-gray-700 mb-1.5">
                Link to Invoice (optional)
              </label>
              <select
                id="invoiceId"
                value={form.invoiceId}
                onChange={(e) => update('invoiceId', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">None</option>
                {availableInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    Rent {new Date(inv.dueDate).toLocaleDateString('en-KE')} • KES {inv.amount.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="card p-4 space-y-4">
          <h3 className="font-medium">Payment Details</h3>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1.5">
              Amount (KES) <span className="text-red-500">*</span>
            </label>
            <input
              id="amount"
              type="number"
              min="0"
              step="100"
              value={form.amount}
              onChange={(e) => update('amount', e.target.value)}
              placeholder={selectedInvoice ? String(selectedInvoice.amount) : selectedLease ? String(selectedLease.rent) : ''}
              className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.amount ? 'border-red-500' : 'border-gray-200'
              }`}
            />
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
            )}
          </div>

          <div>
            <label htmlFor="method" className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Method
            </label>
            <select
              id="method"
              value={form.method}
              onChange={(e) => update('method', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
            </select>
          </div>

          <div>
            <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-1.5">
              Reference (e.g. M-Pesa code) <span className="text-red-500">*</span>
            </label>
            <input
              id="reference"
              type="text"
              value={form.reference}
              onChange={(e) => update('reference', e.target.value)}
              placeholder="MPESA-ABC123XYZ"
              className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.reference ? 'border-red-500' : 'border-gray-200'
              }`}
            />
            {errors.reference && (
              <p className="mt-1 text-sm text-red-600">{errors.reference}</p>
            )}
          </div>

          <div>
            <label htmlFor="paidDate" className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              id="paidDate"
              type="date"
              value={form.paidDate}
              onChange={(e) => update('paidDate', e.target.value)}
              className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.paidDate ? 'border-red-500' : 'border-gray-200'
              }`}
            />
            {errors.paidDate && (
              <p className="mt-1 text-sm text-red-600">{errors.paidDate}</p>
            )}
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes
            </label>
            <textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Optional notes..."
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/payments" className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex-1 py-3 disabled:opacity-50"
          >
            {saving ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </>
  );
}
