'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Droplets, Zap, Camera, AlertCircle, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery, workOrdersService } from '@bossnyumba/api-client';

interface MeterInfo {
  id: string;
  type: string;
  unit: string;
  lastReading: number;
}

const METER_ICONS: Record<string, React.ElementType> = {
  water: Droplets,
  electricity: Zap,
};

export default function SubmitReadingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: meters, isLoading: metersLoading, isError: metersError, refetch } = useQuery<MeterInfo[]>('/utilities/meters');

  const meterTypes = (meters || []).map((m) => ({
    id: m.type || m.id,
    label: m.type === 'water' ? 'Water' : m.type === 'electricity' ? 'Electricity' : m.type,
    icon: METER_ICONS[m.type] || Zap,
    unit: m.unit,
    lastReading: m.lastReading,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasReading = Object.values(readings).some((v) => v.trim() !== '');
    if (!hasReading) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await workOrdersService.create({
        title: 'Meter Reading Submission',
        category: 'utilities',
        description: Object.entries(readings)
          .filter(([, v]) => v.trim() !== '')
          .map(([type, value]) => `${type}: ${value}`)
          .join(', '),
        priority: 'low',
      } as Record<string, unknown>);
      router.push('/utilities?submitted=true');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit reading. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (metersLoading) {
    return (
      <>
        <PageHeader title="Submit Meter Reading" showBack />
        <div className="px-4 py-4 space-y-6 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 bg-surface-card rounded" />
              <div className="h-10 w-full bg-surface-card rounded-lg" />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (metersError) {
    return (
      <>
        <PageHeader title="Submit Meter Reading" showBack />
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Failed to load meters</h2>
          <p className="text-gray-400 text-sm mb-6">Could not load your meter information.</p>
          <button onClick={() => refetch()} className="btn-primary px-6 py-2">Retry</button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Submit Meter Reading" showBack />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6 pb-24">
        <p className="text-sm text-gray-400 mb-4">
          Enter your current meter readings. Include a photo of the meter for
          verification if possible.
        </p>

        {submitError && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {submitError}
          </div>
        )}

        {meterTypes.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Zap className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">No meters configured for your unit.</p>
          </div>
        )}

        {meterTypes.map((meter) => {
          const Icon = meter.icon;
          return (
            <section key={meter.id}>
              <label className="label flex items-center gap-2">
                <Icon className="w-4 h-4 text-primary-400" />
                {meter.label} ({meter.unit})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  className="input"
                  placeholder="Enter current reading"
                  value={readings[meter.id] ?? ''}
                  onChange={(e) =>
                    setReadings({ ...readings, [meter.id]: e.target.value })
                  }
                  min={meter.lastReading}
                />
                <span className="text-sm text-gray-400 whitespace-nowrap">
                  {meter.unit}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Last reading: {meter.lastReading} {meter.unit}
              </p>
            </section>
          );
        })}

        <section>
          <label className="label flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary-400" />
            Photo of meter (optional)
          </label>
          <div className="flex gap-2">
            {photoPreview ? (
              <div className="w-24 h-24 bg-surface-card rounded-lg flex-shrink-0 overflow-hidden">
                <img src={photoPreview} alt="Meter photo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePhotoUpload}
                className="w-24 h-24 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-400 flex-shrink-0 transition-colors"
              >
                <Camera className="w-6 h-6" />
                <span className="text-xs mt-1">Add</span>
              </button>
            )}
          </div>
        </section>

        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={
            !Object.values(readings).some((v) => v?.trim()) ||
            isSubmitting
          }
        >
          {isSubmitting ? 'Submitting...' : 'Submit Readings'}
        </button>
      </form>
    </>
  );
}
