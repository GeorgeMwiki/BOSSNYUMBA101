'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { schedulingService } from '@bossnyumba/api-client';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
];

export default function SetAvailabilityPage() {
  const router = useRouter();
  const [availability, setAvailability] = useState<Record<string, string[]>>({
    Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load current availability from API
  useEffect(() => {
    const loadAvailability = async () => {
      try {
        const response = await schedulingService.list({ type: 'INSPECTION' });
        if (response.data) {
          // Parse existing schedule events into availability grid
          const parsed: Record<string, string[]> = {
            Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [],
          };
          const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          for (const event of response.data) {
            const d = new Date(event.startAt);
            const day = dayMap[d.getDay()];
            const hour = d.getHours().toString().padStart(2, '0') + ':00';
            if (day && !parsed[day]?.includes(hour)) {
              parsed[day] = [...(parsed[day] || []), hour].sort();
            }
          }
          // Only update if we got meaningful data
          const hasData = Object.values(parsed).some((slots) => slots.length > 0);
          if (hasData) {
            setAvailability(parsed);
          }
        }
      } catch {
        // Keep empty state on error
      }
      setLoading(false);
    };
    loadAvailability();
  }, []);

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

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await schedulingService.create({
        type: 'OTHER',
        title: 'Availability Preferences',
        description: JSON.stringify({ availability }),
        startAt: new Date().toISOString(),
        endAt: new Date().toISOString(),
      });
      router.push('/calendar');
    } catch {
      setSaveError('Failed to save availability. Please try again.');
    }
    setSaving(false);
  };

  return (
    <>
      <PageHeader title="Set Availability" subtitle="When you're available for inspections" showBack />

      <div className="px-4 py-4 space-y-6">
        <div className="card p-4">
          <p className="text-sm text-gray-600 mb-4">
            Select the time slots when you&apos;re available for inspections and appointments. 
            Inspections will be scheduled within these windows.
          </p>

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

        {saveError && (
          <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
            {saveError}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Availability'}
          </button>
        </div>
      </div>
    </>
  );
}
