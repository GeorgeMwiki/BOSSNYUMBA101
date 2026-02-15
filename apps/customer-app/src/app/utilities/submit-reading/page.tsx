'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Droplets, Zap, Camera } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const meterTypes = [
  {
    id: 'water',
    label: 'Water',
    icon: Droplets,
    unit: 'm³',
    lastReading: 245,
    placeholder: 'Enter current reading',
  },
  {
    id: 'electricity',
    label: 'Electricity',
    icon: Zap,
    unit: 'kWh',
    lastReading: 1250,
    placeholder: 'Enter current reading',
  },
];

export default function SubmitReadingPage() {
  const router = useRouter();
  const [readings, setReadings] = useState<Record<string, string>>({
    water: '',
    electricity: '',
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasReading = Object.values(readings).some((v) => v.trim() !== '');
    if (!hasReading) return;

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    router.push('/utilities?submitted=true');
  };

  const handlePhotoUpload = () => {
    setPhoto('/meter-photo.jpg');
  };

  return (
    <>
      <PageHeader title="Submit Meter Reading" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6">
        <p className="text-sm text-gray-500 mb-4">
          Enter your current meter readings. Include a photo of the meter for
          verification if possible.
        </p>

        {meterTypes.map((meter) => {
          const Icon = meter.icon;
          return (
            <section key={meter.id}>
              <label className="label flex items-center gap-2">
                <Icon className="w-4 h-4 text-primary-600" />
                {meter.label} ({meter.unit})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  className="input"
                  placeholder={meter.placeholder}
                  value={readings[meter.id] ?? ''}
                  onChange={(e) =>
                    setReadings({ ...readings, [meter.id]: e.target.value })
                  }
                  min={meter.lastReading}
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  {meter.unit}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Last reading: {meter.lastReading} {meter.unit}
              </p>
            </section>
          );
        })}

        <section>
          <label className="label flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary-600" />
            Photo of meter (optional)
          </label>
          <div className="flex gap-2">
            {photo ? (
              <div className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0" />
            ) : (
              <button
                type="button"
                onClick={handlePhotoUpload}
                className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500 flex-shrink-0"
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
            !readings.water?.trim() &&
            !readings.electricity?.trim() &&
            isSubmitting
          }
        >
          {isSubmitting ? 'Submitting...' : 'Submit Readings'}
        </button>
      </form>
    </>
  );
}
