'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { unitsService, propertiesService } from '@bossnyumba/api-client';

export default function UnitFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const propertyIdParam = searchParams.get('propertyId');

  const [formData, setFormData] = useState({
    propertyId: propertyIdParam ?? '',
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
    if (propertyIdParam) setFormData((f) => ({ ...f, propertyId: propertyIdParam }));
  }, [propertyIdParam]);

  const { data: propertiesData } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertiesService.list({ pageSize: 100 }),
    retry: false,
  });

  const properties = propertiesData?.data ?? [];

  const mutation = useMutation({
    mutationFn: (data: typeof formData) =>
      unitsService.create({
        propertyId: data.propertyId,
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
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      router.push(`/units/${response.data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <>
      <PageHeader title="Add Unit" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Property *</label>
            <select
              className="input"
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              required
            >
              <option value="">Select property</option>
              {properties.map((p: { id: string; name: string }) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Unit Number *</label>
              <input
                type="text"
                className="input"
                value={formData.unitNumber}
                onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                placeholder="e.g. A101"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={mutation.isPending || !formData.propertyId || !formData.unitNumber}
          >
            {mutation.isPending ? 'Saving...' : 'Create Unit'}
          </button>
        </div>
      </form>
    </>
  );
}
