'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { MoneyDisplay } from '@/components/MoneyDisplay';

const mockUnits = [
  { id: '1', unit: 'A-204', property: 'Sunset Apartments', rent: 45000, available: true },
  { id: '2', unit: 'B-102', property: 'Sunset Apartments', rent: 52000, available: true },
  { id: '3', unit: 'C-301', property: 'Sunset Apartments', rent: 48000, available: false },
];

const mockCustomers = [
  { id: '1', name: 'John Kamau', phone: '+254 712 345 678', email: 'john@email.com' },
  { id: '2', name: 'Mary Wanjiku', phone: '+254 723 456 789', email: 'mary@email.com' },
  { id: '3', name: 'Peter Ochieng', phone: '+254 734 567 890', email: 'peter@email.com' },
];

interface FormState {
  unitId: string;
  customerId: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
  paymentDay: string;
  terms: string;
}

const initialForm: FormState = {
  unitId: '',
  customerId: '',
  startDate: '',
  endDate: '',
  monthlyRent: '',
  deposit: '',
  paymentDay: '1',
  terms: '',
};

export function LeaseForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  const selectedUnit = mockUnits.find((u) => u.id === form.unitId);

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.unitId) newErrors.unitId = 'Select a unit';
    if (!form.customerId) newErrors.customerId = 'Select a tenant';
    if (!form.startDate) newErrors.startDate = 'Start date is required';
    if (!form.endDate) newErrors.endDate = 'End date is required';
    if (!form.monthlyRent || isNaN(Number(form.monthlyRent)) || Number(form.monthlyRent) <= 0) {
      newErrors.monthlyRent = 'Enter a valid rent amount';
    }
    if (form.deposit && (isNaN(Number(form.deposit)) || Number(form.deposit) < 0)) {
      newErrors.deposit = 'Enter a valid deposit amount';
    }
    if (!form.paymentDay || parseInt(form.paymentDay, 10) < 1 || parseInt(form.paymentDay, 10) > 28) {
      newErrors.paymentDay = 'Payment day must be 1–28';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      router.push('/leases');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="New Lease"
        subtitle="Create a new lease agreement"
        showBack
      />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6">
        <div className="card p-4 space-y-4">
          <h3 className="font-medium">Unit & Tenant</h3>

          <div>
            <label htmlFor="unitId" className="block text-sm font-medium text-gray-700 mb-1.5">
              Unit <span className="text-red-500">*</span>
            </label>
            <select
              id="unitId"
              value={form.unitId}
              onChange={(e) => update('unitId', e.target.value)}
              className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.unitId ? 'border-red-500' : 'border-gray-200'
              }`}
              aria-invalid={!!errors.unitId}
              aria-describedby={errors.unitId ? 'unitId-error' : undefined}
            >
              <option value="">Select unit</option>
              {mockUnits
                .filter((u) => u.available)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit} - {u.property} • KES {u.rent.toLocaleString()}/mo
                  </option>
                ))}
            </select>
            {errors.unitId && (
              <p id="unitId-error" className="mt-1 text-sm text-red-600">
                {errors.unitId}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-1.5">
              Tenant <span className="text-red-500">*</span>
            </label>
            <select
              id="customerId"
              value={form.customerId}
              onChange={(e) => update('customerId', e.target.value)}
              className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.customerId ? 'border-red-500' : 'border-gray-200'
              }`}
              aria-invalid={!!errors.customerId}
              aria-describedby={errors.customerId ? 'customerId-error' : undefined}
            >
              <option value="">Select tenant</option>
              {mockCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} • {c.phone}
                </option>
              ))}
            </select>
            {errors.customerId && (
              <p id="customerId-error" className="mt-1 text-sm text-red-600">
                {errors.customerId}
              </p>
            )}
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <h3 className="font-medium">Lease Term</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.startDate ? 'border-red-500' : 'border-gray-200'
                }`}
                aria-invalid={!!errors.startDate}
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
              )}
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1.5">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.endDate ? 'border-red-500' : 'border-gray-200'
                }`}
                aria-invalid={!!errors.endDate}
              />
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
              )}
            </div>
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <h3 className="font-medium">Financial Terms</h3>

          <div>
            <label htmlFor="monthlyRent" className="block text-sm font-medium text-gray-700 mb-1.5">
              Monthly Rent (KES) <span className="text-red-500">*</span>
            </label>
            <input
              id="monthlyRent"
              type="number"
              min="0"
              step="1000"
              value={form.monthlyRent}
              onChange={(e) => update('monthlyRent', e.target.value)}
              placeholder={selectedUnit ? String(selectedUnit.rent) : '0'}
              className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.monthlyRent ? 'border-red-500' : 'border-gray-200'
              }`}
              aria-invalid={!!errors.monthlyRent}
            />
            {errors.monthlyRent && (
              <p className="mt-1 text-sm text-red-600">{errors.monthlyRent}</p>
            )}
          </div>

          <div>
            <label htmlFor="deposit" className="block text-sm font-medium text-gray-700 mb-1.5">
              Security Deposit (KES)
            </label>
            <input
              id="deposit"
              type="number"
              min="0"
              step="1000"
              value={form.deposit}
              onChange={(e) => update('deposit', e.target.value)}
              placeholder={form.monthlyRent ? String(Number(form.monthlyRent) * 2) : '0'}
              className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.deposit ? 'border-red-500' : 'border-gray-200'
              }`}
              aria-invalid={!!errors.deposit}
            />
            {errors.deposit && (
              <p className="mt-1 text-sm text-red-600">{errors.deposit}</p>
            )}
          </div>

          <div>
            <label htmlFor="paymentDay" className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Due Day (1–28) <span className="text-red-500">*</span>
            </label>
            <input
              id="paymentDay"
              type="number"
              min="1"
              max="28"
              value={form.paymentDay}
              onChange={(e) => update('paymentDay', e.target.value)}
              className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.paymentDay ? 'border-red-500' : 'border-gray-200'
              }`}
              aria-invalid={!!errors.paymentDay}
            />
            {errors.paymentDay && (
              <p className="mt-1 text-sm text-red-600">{errors.paymentDay}</p>
            )}
          </div>
        </div>

        <div className="card p-4">
          <label htmlFor="terms" className="block text-sm font-medium text-gray-700 mb-1.5">
            Additional Terms
          </label>
          <textarea
            id="terms"
            rows={3}
            value={form.terms}
            onChange={(e) => update('terms', e.target.value)}
            placeholder="Optional notes or special terms..."
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/leases" className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex-1 py-3 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Lease'}
          </button>
        </div>
      </form>
    </>
  );
}
