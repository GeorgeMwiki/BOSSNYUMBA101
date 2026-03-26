'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Building2 } from 'lucide-react';
import { assetsService } from '@bossnyumba/api-client';

export default function NewAssetPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await assetsService.create({
        assetCode: formData.get('assetCode') as string,
        name: formData.get('name') as string,
        type: formData.get('type') as string,
        organizationId: formData.get('organizationId') as string || undefined,
        acquisitionCost: formData.get('acquisitionCost') ? Number(formData.get('acquisitionCost')) : undefined,
        acquisitionDate: formData.get('acquisitionDate') as string || undefined,
        description: formData.get('notes') as string || undefined,
      });
      router.push('/assets');
    } catch (err) {
      setError((err as Error).message || 'Failed to create asset');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Register Asset" showBack />

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Asset Information
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Asset Code *</label>
                <input
                  type="text"
                  name="assetCode"
                  className="input"
                  placeholder="e.g., BLD-001"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Asset Type *</label>
                <select name="type" className="input" required>
                  <option value="">Select type</option>
                  <option value="building">Building</option>
                  <option value="land">Land</option>
                  <option value="infrastructure">Infrastructure</option>
                  <option value="equipment">Equipment</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Asset Name *</label>
              <input
                type="text"
                name="name"
                className="input"
                placeholder="Enter asset name"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Organization ID</label>
              <input
                type="text"
                name="organizationId"
                className="input"
                placeholder="Enter organization ID"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Acquisition Cost (TZS)</label>
                <input
                  type="number"
                  name="acquisitionCost"
                  className="input"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Acquisition Date</label>
                <input
                  type="date"
                  name="acquisitionDate"
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Notes</label>
              <textarea
                name="notes"
                className="input"
                rows={3}
                placeholder="Additional notes about the asset..."
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => router.back()}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
