'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { schedulingApi } from '@/lib/api';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

const emptyAvailability: Record<string, string[]> = {
  Mon: [],
  Tue: [],
  Wed: [],
  Thu: [],
  Fri: [],
  Sat: [],
  Sun: [],
};

export default function SetAvailabilityPage() {
  const router = useRouter();
  const [availability, setAvailability] = useState<Record<string, string[]>>(emptyAvailability);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const availabilityQuery = useQuery({
    queryKey: ['availability'],
    queryFn: () => schedulingApi.getAvailability(),
    retry: false,
  });

  useEffect(() => {
    const data = availabilityQuery.data?.data;
    if (data) {
      setAvailability({ ...emptyAvailability, ...data });
    }
  }, [availabilityQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (value: Record<string, string[]>) => schedulingApi.saveAvailability(value),
    onSuccess: (resp) => {
      if (resp.success) {
        router.push('/calendar');
      } else {
        setFormError(resp.error?.message ?? 'Failed to save availability');
      }
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : 'Failed to save availability');
    },
  });

  const toggleSlot = (day: string, time: string) => {
    setAvailability((prev) => {
      const daySlots = prev[day] ?? [];
      const exists = daySlots.includes(time);
      return {
        ...prev,
        [day]: exists ? daySlots.filter((t) => t !== time) : [...daySlots, time].sort(),
      };
    });
  };

  const queryError =
    availabilityQuery.error instanceof Error
      ? availabilityQuery.error.message
      : availabilityQuery.data && !availabilityQuery.data.success
      ? availabilityQuery.data.error?.message
      : undefined;

  return (
    <>
      <PageHeader
        title="Set Availability"
        subtitle="When you're available for inspections"
        showBack
      />

      <div className="px-4 py-4 space-y-6">
        {queryError && (
          <div className="card p-4 flex items-start gap-2 border-warning-200 bg-warning-50 text-warning-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Loaded default schedule</div>
              <div>{queryError}. You can still update and save availability below.</div>
            </div>
          </div>
        )}

        <div className="card p-4">
          <p className="text-sm text-gray-600 mb-4">
            Select the time slots when you&apos;re available for inspections and appointments.
            Inspections will be scheduled within these windows.
          </p>

          {availabilityQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading availability...
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 font-medium">Day</th>
                  <th className="text-left py-2 font-medium">Available Slots</th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day} className="border-t border-gray-100">
                    <td className="py-3 pr-4 font-medium">{day}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {TIME_SLOTS.map((time) => {
                          const isSelected = availability[day]?.includes(time);
                          return (
                            <button
                              key={time}
                              type="button"
                              onClick={() => toggleSlot(day, time)}
                              className={`px-2 py-1 rounded text-xs ${
                                isSelected
                                  ? 'bg-primary-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {formError && (
          <div className="card p-3 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{formError}</div>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate(availability)}
            disabled={saveMutation.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Save Availability
          </button>
        </div>
      </div>
    </>
  );
}
