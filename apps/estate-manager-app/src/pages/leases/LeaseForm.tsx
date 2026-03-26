'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { leasesService, unitsService, customersService } from '@bossnyumba/api-client';

export function LeaseForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    unitId: '',
    customerId: '',
    startDate: '',
    endDate: '',
    monthlyRent: '',
    securityDeposit: '',
    paymentDay: '1',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  const { data: unitsData, isLoading: loadingUnits } = useQuery({
    queryKey: ['units'],
    queryFn: () => unitsService.list({}),
  });

  const { data: customersData, isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersService.list({}),
  });

  const units = unitsData?.data ?? [];
  const customers = customersData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (request: any) => leasesService.create(request),
    onSuccess: () => {
      router.push('/leases');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create lease');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate({
      ...formData,
      monthlyRent: parseFloat(formData.monthlyRent),
      securityDeposit: parseFloat(formData.securityDeposit),
      paymentDay: parseInt(formData.paymentDay, 10),
    });
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create Lease</h1>
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
          <label className="label">Unit</label>
          <select
            className="input"
            value={formData.unitId}
            onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
            required
          >
            <option value="">Select unit...</option>
            {loadingUnits && <option disabled>Loading...</option>}
            {units.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.name || u.unitNumber} - {u.propertyName || u.property?.name || 'Property'}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="label">Tenant</label>
          <select
            className="input"
            value={formData.customerId}
            onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
            required
          >
            <option value="">Select tenant...</option>
            {loadingCustomers && <option disabled>Loading...</option>}
            {customers.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name || `${c.firstName} ${c.lastName}`}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="label">Start Date</label>
            <input
              type="date"
              className="input"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="label">End Date</label>
            <input
              type="date"
              className="input"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="label">Monthly Rent (KES)</label>
          <input
            type="number"
            className="input"
            placeholder="Enter monthly rent"
            value={formData.monthlyRent}
            onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
            required
            min="0"
            step="0.01"
          />
        </div>

        <div className="space-y-2">
          <label className="label">Security Deposit (KES)</label>
          <input
            type="number"
            className="input"
            placeholder="Enter security deposit"
            value={formData.securityDeposit}
            onChange={(e) => setFormData({ ...formData, securityDeposit: e.target.value })}
            min="0"
            step="0.01"
          />
        </div>

        <div className="space-y-2">
          <label className="label">Payment Day of Month</label>
          <select
            className="input"
            value={formData.paymentDay}
            onChange={(e) => setFormData({ ...formData, paymentDay: e.target.value })}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Optional lease notes..."
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
            disabled={createMutation.isPending}
            className="btn-primary flex-1"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Lease'}
          </button>
        </div>
      </form>
    </div>
  );
}
