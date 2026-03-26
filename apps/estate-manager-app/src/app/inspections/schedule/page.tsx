'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { inspectionsService } from '@bossnyumba/api-client';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ScheduleInspectionPage() {
  const router = useRouter();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayClick = (day: number) => {
    const month = String(currentMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    setSelectedDate(`${currentYear}-${month}-${dayStr}`);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDate) return;
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await inspectionsService.create({
        propertyId: formData.get('propertyId') as string,
        unitId: formData.get('unitId') as string || '',
        scheduledDate: selectedDate,
        type: formData.get('type') as 'routine' | 'move_in' | 'move_out' | 'complaint',
        assignedTo: formData.get('assignedTo') as string || '',
      });
      router.push('/inspections');
    } catch (err) {
      setError((err as Error).message || 'Failed to schedule inspection');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Schedule Inspection" showBack />

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Calendar */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {MONTHS[currentMonth]} {currentYear}
              </h3>
              <button type="button" onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const month = String(currentMonth + 1).padStart(2, '0');
                const dayStr = String(day).padStart(2, '0');
                const dateStr = `${currentYear}-${month}-${dayStr}`;
                const isSelected = selectedDate === dateStr;
                const isToday =
                  day === today.getDate() &&
                  currentMonth === today.getMonth() &&
                  currentYear === today.getFullYear();

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary-600 text-white'
                        : isToday
                          ? 'bg-primary-50 text-primary-700'
                          : 'hover:bg-gray-100'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {selectedDate && (
              <p className="mt-3 text-sm text-gray-600">
                Selected: <span className="font-medium">{selectedDate}</span>
              </p>
            )}
          </div>

          {/* Inspection Details */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Inspection Details</h3>

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
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={isSubmitting || !selectedDate}
            >
              {isSubmitting ? 'Scheduling...' : 'Schedule Inspection'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
