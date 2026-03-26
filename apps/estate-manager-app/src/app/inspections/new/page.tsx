'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { ClipboardCheck } from 'lucide-react';
import { inspectionsService } from '@bossnyumba/api-client';

export default function NewInspectionPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await inspectionsService.create({
        propertyId: formData.get('propertyId') as string,
        unitId: formData.get('unitId') as string || '',
        scheduledDate: formData.get('scheduledDate') as string,
        type: formData.get('type') as 'routine' | 'move_in' | 'move_out' | 'complaint',
        assignedTo: formData.get('assignedTo') as string || '',
      });
      router.push('/inspections');
    } catch (err) {
      setError((err as Error).message || 'Failed to create inspection');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="New Inspection" showBack />

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Inspection Details
            </h3>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Property ID *</label>
              <input
                type="text"
                name="propertyId"
                className="input"
                placeholder="Enter property ID"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Unit ID</label>
              <input
                type="text"
                name="unitId"
                className="input"
                placeholder="Enter unit ID (optional)"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Scheduled Date *</label>
              <input
                type="date"
                name="scheduledDate"
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Inspection Type *</label>
              <select name="type" className="input" required>
                <option value="">Select type</option>
                <option value="routine">Routine</option>
                <option value="move_in">Move In</option>
                <option value="move_out">Move Out</option>
                <option value="complaint">Complaint</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Assigned To</label>
              <input
                type="text"
                name="assignedTo"
                className="input"
                placeholder="Staff member ID"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Notes</label>
              <textarea
                name="notes"
                className="input"
                rows={3}
                placeholder="Additional notes..."
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
              {isSubmitting ? 'Creating...' : 'Create Inspection'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
