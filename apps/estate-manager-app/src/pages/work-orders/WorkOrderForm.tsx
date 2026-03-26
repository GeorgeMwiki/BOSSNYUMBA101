'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { workOrdersService, propertiesService, unitsService } from '@bossnyumba/api-client';

export default function WorkOrderForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    propertyId: '',
    unitId: '',
    title: '',
    description: '',
    category: 'general',
    priority: 'medium',
  });
  const [error, setError] = useState<string | null>(null);

  const { data: properties, isLoading: loadingProperties } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertiesService.list({}),
  });

  const { data: units, isLoading: loadingUnits } = useQuery({
    queryKey: ['units', formData.propertyId],
    queryFn: () => unitsService.list({ propertyId: formData.propertyId }),
    enabled: !!formData.propertyId,
  });

  const createMutation = useMutation({
    mutationFn: (request: typeof formData) => workOrdersService.create(request),
    onSuccess: () => {
      router.push('/work-orders');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create work order');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate(formData);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create Work Order</h1>
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
          <label className="label">Property</label>
          <select
            className="input"
            value={formData.propertyId}
            onChange={(e) => setFormData({ ...formData, propertyId: e.target.value, unitId: '' })}
            required
          >
            <option value="">Select property...</option>
            {loadingProperties && <option disabled>Loading...</option>}
            {properties?.data?.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="label">Unit</label>
          <select
            className="input"
            value={formData.unitId}
            onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
            disabled={!formData.propertyId}
            required
          >
            <option value="">Select unit...</option>
            {loadingUnits && <option disabled>Loading...</option>}
            {units?.data?.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name || u.unitNumber}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="label">Title</label>
          <input
            type="text"
            className="input"
            placeholder="Brief description of the issue"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="label">Description</label>
          <textarea
            className="input min-h-[100px]"
            placeholder="Detailed description..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="label">Category</label>
          <select
            className="input"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          >
            <option value="general">General</option>
            <option value="plumbing">Plumbing</option>
            <option value="electrical">Electrical</option>
            <option value="hvac">HVAC</option>
            <option value="appliance">Appliance</option>
            <option value="structural">Structural</option>
            <option value="pest_control">Pest Control</option>
            <option value="security">Security</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="label">Priority</label>
          <select
            className="input"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
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
            {createMutation.isPending ? 'Creating...' : 'Create Work Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
