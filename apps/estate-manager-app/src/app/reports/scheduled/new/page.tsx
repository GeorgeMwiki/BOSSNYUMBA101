'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Calendar } from 'lucide-react';
import { getApiClient } from '@bossnyumba/api-client';

export default function NewScheduledReportPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const client = getApiClient();
      await client.post('/reports/scheduled', {
        reportType: formData.get('reportType') as string,
        schedule: formData.get('schedule') as string,
        recipients: (formData.get('recipients') as string)
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean),
        format: formData.get('format') as string,
      });
      router.push('/reports/scheduled');
    } catch (err) {
      setError((err as Error).message || 'Failed to schedule report');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Schedule Report" showBack />

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Report Schedule
            </h3>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Report Type *</label>
              <select name="reportType" className="input" required>
                <option value="">Select report type</option>
                <option value="occupancy">Occupancy Report</option>
                <option value="revenue">Revenue Report</option>
                <option value="maintenance">Maintenance Report</option>
                <option value="collections">Collections Report</option>
                <option value="lease_expiry">Lease Expiry Report</option>
                <option value="utilities">Utilities Report</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Schedule *</label>
                <select name="schedule" className="input" required>
                  <option value="">Select frequency</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Format *</label>
                <select name="format" className="input" required>
                  <option value="">Select format</option>
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Recipients *</label>
              <input
                type="text"
                name="recipients"
                className="input"
                placeholder="email1@example.com, email2@example.com"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated email addresses</p>
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
              {isSubmitting ? 'Scheduling...' : 'Schedule Report'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
