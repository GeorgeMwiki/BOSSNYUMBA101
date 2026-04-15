'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { schedulingApi, type ScheduleEvent } from '@/lib/api';

type ViewMode = 'month' | 'week';

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

function eventLink(ev: ScheduleEvent): string {
  if (ev.workOrderId) return `/work-orders/${ev.workOrderId}`;
  if (ev.inspectionId) return `/inspections/${ev.inspectionId}`;
  return `/calendar/events`;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const monthStart = new Date(year, month, 1).toISOString();
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const calendarQuery = useQuery({
    queryKey: ['calendar', monthStart, monthEnd],
    queryFn: () => schedulingApi.getCalendar(monthStart, monthEnd),
    retry: false,
  });

  const response = calendarQuery.data;
  const events: ScheduleEvent[] = response?.data ?? [];

  const errorMessage =
    calendarQuery.error instanceof Error
      ? calendarQuery.error.message
      : response && !response.success
      ? response.error?.message
      : undefined;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const ev of events) {
      const key = new Date(ev.startAt).toISOString().split('T')[0];
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

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

        {calendarQuery.isLoading && (
          <div className="card p-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading calendar...
          </div>
        )}

        {errorMessage && (
          <div className="card p-4 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Unable to load calendar</div>
              <div>{errorMessage}</div>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="bg-gray-50 text-center text-xs font-medium text-gray-500 py-2"
              >
                {day}
              </div>
            ))}
            {days.map((day, idx) => {
              const dateStr = day ? day.toISOString().split('T')[0] : '';
              const dayEvents = day ? eventsByDate.get(dateStr) ?? [] : [];
              const isToday = day && day.toDateString() === new Date().toDateString();

              return (
                <div key={idx} className={`min-h-[80px] bg-white p-1 ${!day ? 'bg-gray-50' : ''}`}>
                  {day && (
                    <>
                      <div
                        className={`text-sm font-medium mb-1 ${
                          isToday
                            ? 'w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center'
                            : ''
                        }`}
                      >
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((ev) => {
                          const time = new Date(ev.startAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          });
                          return (
                            <Link
                              key={ev.id}
                              href={eventLink(ev)}
                              className="block text-xs p-1 rounded truncate bg-primary-50 text-primary-800 hover:bg-primary-100"
                            >
                              {time} {ev.title}
                            </Link>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{dayEvents.length - 2} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/calendar/events"
            className="card p-4 flex-1 flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <CalendarIcon className="w-6 h-6 text-primary-600" />
            <span className="font-medium">View Events</span>
            <span className="ml-auto text-primary-600">→</span>
          </Link>
          <Link
            href="/calendar/availability"
            className="card p-4 flex-1 flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <Clock className="w-6 h-6 text-primary-600" />
            <span className="font-medium">Availability</span>
            <span className="ml-auto text-primary-600">→</span>
          </Link>
        </div>
      </div>
    </>
  );
}
