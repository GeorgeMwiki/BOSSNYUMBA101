'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { AlertTriangle } from 'lucide-react';
import { subleaseAlertsService } from '@bossnyumba/api-client';

export default function ReportSubleasePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await subleaseAlertsService.create({
        propertyId: formData.get('propertyId') as string,
        unitId: formData.get('unitId') as string || undefined,
        description: formData.get('description') as string,
        source: formData.get('source') as 'inspection' | 'neighbor_report' | 'staff_observation',
        evidence: formData.get('evidence') as string || undefined,
      });
      router.push('/subleases');
    } catch (err) {
      setError((err as Error).message || 'Failed to submit sublease report');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Report Sublease Alert" showBack />

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alert Details
            </h3>

            <div className="grid grid-cols-2 gap-3">
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
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Source *</label>
              <select name="source" className="input" required>
                <option value="">Select source</option>
                <option value="inspection">Inspection</option>
                <option value="neighbor_report">Neighbor Report</option>
                <option value="staff_observation">Staff Observation</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Description *</label>
              <textarea
                name="description"
                className="input"
                rows={3}
                placeholder="Describe the suspected unauthorized sub-leasing..."
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Evidence</label>
              <textarea
                name="evidence"
                className="input"
                rows={3}
                placeholder="Any supporting evidence or observations..."
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
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
