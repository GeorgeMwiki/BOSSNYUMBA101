'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { MoneyDisplay } from '@/components/MoneyDisplay';
import { leasesService } from '@bossnyumba/api-client';

// Fallback data
const fallbackLease = {
  leaseNumber: 'LSE-2024-001',
  unit: 'A-204',
  property: 'Sunset Apartments',
  tenantName: 'John Kamau',
  currentRent: 45000,
  currentEndDate: '2025-12-31',
};

interface FormState {
  newStartDate: string;
  newEndDate: string;
  rentAdjustment: 'same' | 'increase' | 'decrease' | 'custom';
  newRent: string;
  adjustmentPercent: string;
}

export function LeaseRenewal({ leaseId }: { leaseId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch current lease data
  const { data: leaseData, isLoading } = useQuery({
    queryKey: ['lease', leaseId],
    queryFn: () => leasesService.get(leaseId),
    retry: false,
  });

  const lease = useMemo(() => {
    const l = leaseData?.data as Record<string, unknown> | undefined;
    if (!l) return fallbackLease;

    const unit = l.unit as Record<string, unknown> | undefined;
    const property = l.property as Record<string, unknown> | undefined;
    const customer = l.customer as Record<string, unknown> | undefined;

    return {
      leaseNumber: String(l.leaseNumber ?? l.id ?? ''),
      unit: unit ? String(unit.unitNumber ?? '') : '',
      property: property ? String(property.name ?? '') : '',
      tenantName: customer ? String(customer.name ?? '') : '',
      currentRent: Number(l.rentAmount ?? 0),
      currentEndDate: String(l.endDate ?? ''),
    };
  }, [leaseData]);

  const [form, setForm] = useState<FormState>({
    newStartDate: '',
    newEndDate: '',
    rentAdjustment: 'same',
    newRent: '',
    adjustmentPercent: '5',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Initialize newRent from lease data when available
  const effectiveNewRent = form.newRent || String(lease.currentRent);

  // Renew mutation
  const renewMutation = useMutation({
    mutationFn: async () => {
      const newRentAmount =
        form.rentAdjustment === 'custom'
          ? Number(form.newRent) || 0
          : suggestedNewRent;

      return leasesService.renew(leaseId, {
        newEndDate: form.newEndDate,
        newRentAmount: newRentAmount !== lease.currentRent ? newRentAmount : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lease', leaseId] });
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      router.push(`/leases/${leaseId}`);
    },
  });

  const suggestedNewRent =
    form.rentAdjustment === 'increase'
      ? Math.round(lease.currentRent * (1 + parseInt(form.adjustmentPercent || '0', 10) / 100))
      : form.rentAdjustment === 'decrease'
        ? Math.round(lease.currentRent * (1 - parseInt(form.adjustmentPercent || '0', 10) / 100))
        : lease.currentRent;

  const displayRent =
    form.rentAdjustment === 'custom' ? Number(effectiveNewRent) || 0 : suggestedNewRent;

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.newStartDate) newErrors.newStartDate = 'Start date is required';
    if (!form.newEndDate) newErrors.newEndDate = 'End date is required';
    if (form.rentAdjustment === 'custom') {
      const rent = Number(form.newRent);
      if (isNaN(rent) || rent <= 0) newErrors.newRent = 'Enter a valid rent amount';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    renewMutation.mutate();
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Renew Lease" showBack />
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Renew Lease"
        subtitle={lease.leaseNumber}
        showBack
      />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6">
        <div className="card p-4 bg-primary-50 border border-primary-100">
          <h3 className="font-medium text-primary-900">Current Lease</h3>
          <div className="mt-2 text-sm text-primary-800">
            <div>{lease.tenantName}{lease.unit && ` • Unit ${lease.unit}`}</div>
            <div>
              <MoneyDisplay amount={lease.currentRent} />/month
              {lease.currentEndDate && (
                <> • Ends {new Date(lease.currentEndDate).toLocaleDateString('en-KE')}</>
              )}
            </div>
          </div>
        </div>

        {renewMutation.isError && (
          <div className="card p-4 bg-red-50 border border-red-100 text-red-700 text-sm">
            Failed to renew lease. Please try again.
          </div>
        )}

        <div className="card p-4 space-y-4">
          <h3 className="font-medium">New Term</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="newStartDate" className="block text-sm font-medium text-gray-700 mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                id="newStartDate"
                type="date"
                value={form.newStartDate}
                onChange={(e) => update('newStartDate', e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.newStartDate ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {errors.newStartDate && (
                <p className="mt-1 text-sm text-red-600">{errors.newStartDate}</p>
              )}
            </div>
            <div>
              <label htmlFor="newEndDate" className="block text-sm font-medium text-gray-700 mb-1.5">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                id="newEndDate"
                type="date"
                value={form.newEndDate}
                onChange={(e) => update('newEndDate', e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.newEndDate ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {errors.newEndDate && (
                <p className="mt-1 text-sm text-red-600">{errors.newEndDate}</p>
              )}
            </div>
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <h3 className="font-medium">Rent Adjustment</h3>

          <div className="space-y-3">
            {(['same', 'increase', 'decrease', 'custom'] as const).map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50/50"
              >
                <input
                  type="radio"
                  name="rentAdjustment"
                  value={opt}
                  checked={form.rentAdjustment === opt}
                  onChange={(e) => update('rentAdjustment', e.target.value)}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="flex-1 capitalize">{opt}</span>
                {opt === 'same' && (
                  <span className="text-sm text-gray-600">
                    <MoneyDisplay amount={lease.currentRent} />
                  </span>
                )}
                {opt === 'increase' && (
                  <span className="text-sm text-gray-600">
                    +{form.adjustmentPercent}% = <MoneyDisplay amount={suggestedNewRent} />
                  </span>
                )}
                {opt === 'decrease' && (
                  <span className="text-sm text-gray-600">
                    -{form.adjustmentPercent}% = <MoneyDisplay amount={suggestedNewRent} />
                  </span>
                )}
              </label>
            ))}
          </div>

          {(form.rentAdjustment === 'increase' || form.rentAdjustment === 'decrease') && (
            <div>
              <label htmlFor="adjustmentPercent" className="block text-sm font-medium text-gray-700 mb-1.5">
                Adjustment %
              </label>
              <input
                id="adjustmentPercent"
                type="number"
                min="0"
                max="50"
                value={form.adjustmentPercent}
                onChange={(e) => update('adjustmentPercent', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}

          {form.rentAdjustment === 'custom' && (
            <div>
              <label htmlFor="newRent" className="block text-sm font-medium text-gray-700 mb-1.5">
                New Monthly Rent (KES) <span className="text-red-500">*</span>
              </label>
              <input
                id="newRent"
                type="number"
                min="0"
                step="1000"
                value={form.newRent}
                onChange={(e) => update('newRent', e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.newRent ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {errors.newRent && (
                <p className="mt-1 text-sm text-red-600">{errors.newRent}</p>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">New monthly rent</span>
              <span className="font-semibold">
                <MoneyDisplay amount={displayRent} />
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Link href={`/leases/${leaseId}`} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Cancel
          </Link>
          <button
            type="submit"
            disabled={renewMutation.isPending}
            className="btn-primary flex-1 py-3 disabled:opacity-50"
          >
            {renewMutation.isPending ? 'Renewing...' : 'Renew Lease'}
          </button>
        </div>
      </form>
    </>
  );
}
