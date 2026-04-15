'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Droplets, Loader2, Zap } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type MeterReading } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const METER_META: Record<
  string,
  { label: string; icon: React.ElementType; defaultUnit: string }
> = {
  water: { label: 'Water', icon: Droplets, defaultUnit: 'm³' },
  electricity: { label: 'Electricity', icon: Zap, defaultUnit: 'kWh' },
  gas: { label: 'Gas', icon: Zap, defaultUnit: 'm³' },
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function SubmitReadingPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const metersQuery = useQuery<MeterReading[]>({
    queryKey: ['utility-meters'],
    queryFn: () => api.utilities.getMeters(),
  });

  const meters = useMemo<MeterReading[]>(
    () => metersQuery.data ?? [],
    [metersQuery.data]
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const submissions = meters
        .filter((m) => values[m.type]?.trim())
        .map((m) => ({
          type: m.type,
          value: Number(values[m.type]),
          unit: m.unit,
        }))
        .filter((r) => Number.isFinite(r.value));
      if (submissions.length === 0) {
        throw new Error('Please enter at least one reading');
      }
      const photoDataUrl = photo ? await fileToDataUrl(photo) : undefined;
      return api.utilities.submitReading({
        readings: submissions,
        photoDataUrl,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Meter readings submitted');
      queryClient.invalidateQueries({ queryKey: ['utility-meters'] });
      queryClient.invalidateQueries({ queryKey: ['utility-bills'] });
      router.push('/utilities?submitted=true');
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to submit readings',
        'Submission failed'
      ),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const noMeters = metersQuery.isSuccess && meters.length === 0;

  return (
    <>
      <PageHeader title="Submit Meter Reading" showBack />
      <form onSubmit={handleSubmit} className="space-y-6 px-4 py-4">
        <p className="text-sm text-gray-500">
          Enter your current meter readings. Include a photo of the meter for
          verification if possible.
        </p>

        {metersQuery.isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading meters...
          </div>
        )}

        {metersQuery.error && (
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {(metersQuery.error as Error).message}
          </div>
        )}

        {noMeters && (
          <div className="card p-4 text-sm text-gray-400">
            No meters configured for your unit yet. Please ask your property
            manager to set them up.
          </div>
        )}

        {meters.map((meter) => {
          const meta = METER_META[meter.type] ?? {
            label: meter.type,
            icon: Zap,
            defaultUnit: meter.unit,
          };
          const Icon = meta.icon;
          return (
            <section key={meter.type}>
              <label className="label flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary-400" />
                {meta.label} ({meter.unit})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className="input"
                  placeholder="Enter current reading"
                  value={values[meter.type] ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [meter.type]: e.target.value }))
                  }
                  min={meter.previousValue ?? 0}
                />
                <span className="whitespace-nowrap text-sm text-gray-500">
                  {meter.unit}
                </span>
              </div>
              {meter.previousValue !== undefined && (
                <p className="mt-1 text-xs text-gray-400">
                  Last reading: {meter.previousValue} {meter.unit}
                </p>
              )}
            </section>
          );
        })}

        <section>
          <label className="label flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary-400" />
            Photo of meter (optional)
          </label>
          <div className="flex gap-2">
            {photo ? (
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(photo)}
                  alt="Meter"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <label className="flex h-24 w-24 flex-shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-500 text-gray-400 hover:border-primary-500 hover:text-primary-400">
                <Camera className="h-6 w-6" />
                <span className="mt-1 text-xs">Add</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {photo && (
              <button
                type="button"
                className="btn-secondary self-start text-xs"
                onClick={() => setPhoto(null)}
              >
                Remove
              </button>
            )}
          </div>
        </section>

        <section>
          <label className="label" htmlFor="notes">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            className="input min-h-[80px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else we should know?"
          />
        </section>

        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={mutation.isPending || noMeters}
        >
          {mutation.isPending ? 'Submitting...' : 'Submit readings'}
        </button>
      </form>
    </>
  );
}
