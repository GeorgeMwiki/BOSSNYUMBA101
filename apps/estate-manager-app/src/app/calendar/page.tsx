'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Plus,
  Wrench,
  ClipboardCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type ViewMode = 'month' | 'week';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: 'work_order' | 'inspection' | 'appointment';
  unit?: string;
}

// Mock data - replace with API
const events: CalendarEvent[] = [
  { id: '1', title: 'Kitchen sink repair', date: '2024-02-25', time: '09:00', type: 'work_order', unit: 'A-204' },
  { id: '2', title: 'Move-in Inspection', date: '2024-02-25', time: '10:00', type: 'inspection', unit: 'A-301' },
  { id: '3', title: 'AC repair', date: '2024-02-25', time: '11:00', type: 'work_order', unit: 'B-102' },
  { id: '4', title: 'Move-out Inspection', date: '2024-02-26', time: '14:00', type: 'inspection', unit: 'B-105' },
  { id: '5', title: 'Door lock replacement', date: '2024-02-27', time: '14:00', type: 'work_order', unit: 'C-301' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];
  const start = first.getDay();
  for (let i = 0; i < start; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function getEventsForDate(dateStr: string) {
  return events.filter((e) => e.date === dateStr);
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date('2024-02-25'));
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = getDaysInMonth(year, month);

  const navigate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setDate(newDate.getDate() + direction * 7);
    }
    setCurrentDate(newDate);
  };

  const monthTitle = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={monthTitle}
        action={
          <Link href="/inspections/schedule" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Add
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('month')}
              className={`btn text-sm ${viewMode === 'month' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`btn text-sm ${viewMode === 'week' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Week
            </button>
          </div>
          <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {WEEKDAYS.map((day) => (
              <div key={day} className="bg-gray-50 text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
            {days.map((day, idx) => {
              const dateStr = day ? day.toISOString().split('T')[0] : '';
              const dayEvents = day ? getEventsForDate(dateStr) : [];
              const isToday = day && day.toDateString() === new Date().toDateString();

              return (
                <div
                  key={idx}
                  className={`min-h-[80px] bg-white p-1 ${!day ? 'bg-gray-50' : ''}`}
                >
                  {day && (
                    <>
                      <div
                        className={`text-sm font-medium mb-1 ${
                          isToday ? 'w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center' : ''
                        }`}
                      >
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <Link
                            key={ev.id}
                            href={ev.type === 'work_order' ? `/work-orders/${ev.id}` : `/inspections/${ev.id}`}
                            className="block text-xs p-1 rounded truncate bg-primary-50 text-primary-800 hover:bg-primary-100"
                          >
                            {ev.time} {ev.title}
                          </Link>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-xs text-gray-500">+{dayEvents.length - 2} more</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex gap-3">
          <Link href="/calendar/events" className="card p-4 flex-1 flex items-center gap-3 hover:shadow-md transition-shadow">
            <CalendarIcon className="w-6 h-6 text-primary-600" />
            <span className="font-medium">View Events</span>
            <span className="ml-auto text-primary-600">→</span>
          </Link>
          <Link href="/calendar/availability" className="card p-4 flex-1 flex items-center gap-3 hover:shadow-md transition-shadow">
            <Clock className="w-6 h-6 text-primary-600" />
            <span className="font-medium">Availability</span>
            <span className="ml-auto text-primary-600">→</span>
          </Link>
        </div>
      </div>
    </>
  );
}
