'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { unitsService } from '@bossnyumba/api-client';

export default function UnitEditPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ['unit', id],
    queryFn: () => unitsService.get(id),
    retry: false,
  });

  const unit = data?.data;

  const [formData, setFormData] = useState({
    unitNumber: '',
    floor: 0,
    type: 'one_bedroom',
    status: 'AVAILABLE',
    bedrooms: 1,
    bathrooms: 1,
    squareMeters: '',
    rentAmount: '',
    depositAmount: '',
  });

  useEffect(() => {
    if (unit) {
      setFormData({
        unitNumber: unit.unitNumber ?? '',
        floor: unit.floor ?? 0,
        type: unit.type ?? 'one_bedroom',
        status: unit.status ?? 'AVAILABLE',
        bedrooms: unit.bedrooms ?? 1,
        bathrooms: unit.bathrooms ?? 1,
        squareMeters: unit.squareMeters ? String(unit.squareMeters) : '',
        rentAmount: unit.rentAmount != null ? String(unit.rentAmount) : '',
        depositAmount: unit.depositAmount != null ? String(unit.depositAmount) : '',
      });
    }
  }, [unit]);

  const mutation = useMutation({
    mutationFn: (data: typeof formData) =>
      unitsService.update(id, {
        unitNumber: data.unitNumber,
        floor: data.floor,
        type: data.type,
        status: data.status,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        squareMeters: data.squareMeters ? parseFloat(data.squareMeters) : undefined,
        rentAmount: parseFloat(data.rentAmount) || 0,
        depositAmount: parseFloat(data.depositAmount) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit', id] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      router.push(`/units/${id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading || !unit) {
    return (
      <>
        <PageHeader title="Edit Unit" showBack />
        <div className="px-4 py-8 text-center text-gray-500">Loading...</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Edit Unit" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Unit Number *</label>
            <input
              type="text"
              className="input"
              value={formData.unitNumber}
              onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Floor</label>
            <input
              type="number"
              className="input"
              min={0}
              value={formData.floor || ''}
              onChange={(e) =>
                setFormData({ ...formData, floor: parseInt(e.target.value, 10) || 0 })
              }
            />
          </div>

          <div>
            <label className="label">Unit Type</label>
            <select
              className="input"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="studio">Studio</option>
              <option value="one_bedroom">1 Bedroom</option>
              <option value="two_bedroom">2 Bedroom</option>
              <option value="three_bedroom">3 Bedroom</option>
              <option value="four_bedroom_plus">4+ Bedroom</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Bedrooms *</label>
              <input
                type="number"
                className="input"
                min={0}
                value={formData.bedrooms}
                onChange={(e) =>
                  setFormData({ ...formData, bedrooms: parseInt(e.target.value, 10) || 0 })
                }
                required
              />
            </div>
            <div>
              <label className="label">Bathrooms *</label>
              <input
                type="number"
                className="input"
                min={0}
                value={formData.bathrooms}
                onChange={(e) =>
                  setFormData({ ...formData, bathrooms: parseInt(e.target.value, 10) || 0 })
                }
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Square Meters</label>
            <input
              type="number"
              className="input"
              min={0}
              step={0.01}
              value={formData.squareMeters}
              onChange={(e) => setFormData({ ...formData, squareMeters: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Monthly Rent (KES) *</label>
              <input
                type="number"
                className="input"
                min={0}
                value={formData.rentAmount}
                onChange={(e) => setFormData({ ...formData, rentAmount: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Deposit (KES)</label>
              <input
                type="number"
                className="input"
                min={0}
                value={formData.depositAmount}
                onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="RESERVED">Reserved</option>
            </select>
          </div>
        </div>

        {mutation.isError && (
          <div className="p-3 bg-danger-50 text-danger-600 rounded-lg text-sm">
            {(mutation.error as Error).message}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  );
}
