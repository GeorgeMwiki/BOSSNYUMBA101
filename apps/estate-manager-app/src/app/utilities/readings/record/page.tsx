'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Gauge } from 'lucide-react';
import { getApiClient } from '@bossnyumba/api-client';

export default function RecordMeterReadingPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const photoFile = formData.get('photo') as File | null;
      const payload = new FormData();
      payload.append('meterId', formData.get('meterId') as string);
      payload.append('readingValue', formData.get('readingValue') as string);
      payload.append('readingDate', formData.get('readingDate') as string);
      if (photoFile && photoFile.size > 0) {
        payload.append('photo', photoFile);
      }
      const client = getApiClient();
      await client.post('/utilities/readings', payload);
      router.push('/utilities/readings');
    } catch (err) {
      setError((err as Error).message || 'Failed to record reading');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Record Meter Reading" showBack />

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Reading Details
            </h3>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Meter ID *</label>
              <input
                type="text"
                name="meterId"
                className="input"
                placeholder="Enter meter ID"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Reading Value *</label>
                <input
                  type="number"
                  name="readingValue"
                  className="input"
                  placeholder="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Reading Date *</label>
                <input
                  type="date"
                  name="readingDate"
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Photo (optional)</label>
              <input
                type="file"
                name="photo"
                className="input"
                accept="image/*"
              />
              <p className="text-xs text-gray-400 mt-1">Upload a photo of the meter reading for verification</p>
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
              {isSubmitting ? 'Recording...' : 'Record Reading'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
