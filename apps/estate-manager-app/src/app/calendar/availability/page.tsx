'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
];

// Mock - default availability
const defaultAvailability: Record<string, string[]> = {
  Mon: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
  Tue: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
  Wed: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
  Thu: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
  Fri: ['09:00', '10:00', '11:00', '14:00', '15:00'],
  Sat: ['10:00', '11:00'],
  Sun: [],
};

export default function SetAvailabilityPage() {
  const t = useTranslations('availabilityPage');
  const router = useRouter();
  const [availability, setAvailability] = useState<Record<string, string[]>>(defaultAvailability);

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

  const handleSave = () => {
    // In real app: API call to save availability
    router.push('/calendar');
  };

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} showBack />

      <div className="px-4 py-4 space-y-6">
        <div className="card p-4">
          <p className="text-sm text-gray-600 mb-4">
            {t('intro')}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 font-medium">{t('colDay')}</th>
                  <th className="text-left py-2 font-medium">{t('colSlots')}</th>
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

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button onClick={handleSave} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            {t('saveAvailability')}
          </button>
        </div>
      </div>
    </>
  );
}
