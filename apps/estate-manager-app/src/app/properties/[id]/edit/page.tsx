'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { propertiesService } from '@bossnyumba/api-client';

export default function PropertyEditPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertiesService.get(id),
    retry: false,
  });

  const property = data?.data;

  const [formData, setFormData] = useState({
    name: '',
    type: 'RESIDENTIAL',
    status: 'ACTIVE',
    address: { line1: '', city: '', region: '', country: 'KE' },
    description: '',
    totalUnits: 0,
  });

  useEffect(() => {
    if (property) {
      setFormData({
        name: property.name ?? '',
        type: property.type ?? 'RESIDENTIAL',
        status: property.status ?? 'ACTIVE',
        address: {
          line1: property.address?.line1 ?? '',
          city: property.address?.city ?? '',
          region: property.address?.region ?? '',
          country: property.address?.country ?? 'KE',
        },
        description: property.description ?? '',
        totalUnits: property.totalUnits ?? 0,
      });
    }
  }, [property]);

  const mutation = useMutation({
    mutationFn: (data: typeof formData) =>
      propertiesService.update(id, {
        name: data.name,
        type: data.type,
        status: data.status,
        address: {
          line1: data.address.line1,
          city: data.address.city,
          region: data.address.region || undefined,
          country: data.address.country,
        },
        description: data.description || undefined,
        totalUnits: data.totalUnits,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      router.push(`/properties/${id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading || !property) {
    return (
      <>
        <PageHeader title="Edit Property" showBack />
        <div className="px-4 py-8 text-center text-gray-500">Loading...</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Edit Property" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Property Name *</label>
            <input
              type="text"
              className="input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="MIXED">Mixed</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="UNDER_CONSTRUCTION">Under Construction</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Address Line 1 *</label>
            <input
              type="text"
              className="input"
              value={formData.address.line1}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, line1: e.target.value },
                })
              }
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">City *</label>
              <input
                type="text"
                className="input"
                value={formData.address.city}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, city: e.target.value },
                  })
                }
                required
              />
            </div>
            <div>
              <label className="label">Region</label>
              <input
                type="text"
                className="input"
                value={formData.address.region}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, region: e.target.value },
                  })
                }
              />
            </div>
          </div>

          <div>
            <label className="label">Total Units</label>
            <input
              type="number"
              className="input"
              min={0}
              value={formData.totalUnits || ''}
              onChange={(e) =>
                setFormData({ ...formData, totalUnits: parseInt(e.target.value, 10) || 0 })
              }
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[100px]"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
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
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  );
}
