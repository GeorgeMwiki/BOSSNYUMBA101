'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Clock, MapPin,
  Wrench, ClipboardCheck, AlertTriangle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { schedulingService } from '@bossnyumba/api-client';
import type { ScheduleEvent } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

const priorityColors: Record<string, string> = {
  emergency: 'bg-danger-100 border-danger-300 text-danger-800',
  high: 'bg-warning-100 border-warning-300 text-warning-800',
  medium: 'bg-primary-100 border-primary-300 text-primary-800',
  low: 'bg-gray-100 border-gray-300 text-gray-800',
};

const timeSlots = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week'>('day');

  const dateKey = selectedDate.toISOString().split('T')[0];

  const { data: eventsData } = useQuery({
    queryKey: ['schedule-events', dateKey],
    queryFn: () => schedulingService.list({
      startDate: dateKey,
      endDate: dateKey,
      pageSize: 50,
    }),
    retry: false,
  });

  const dayEvents = (eventsData?.data ?? []) as ScheduleEvent[];

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const getTaskPosition = (startAt: string) => {
    const date = new Date(startAt);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const startHour = 8;
    return ((hours - startHour) * 60 + minutes) / 60 * 80;
  };

  const getTaskHeight = (startAt: string, endAt: string) => {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    return (durationMinutes / 60) * 80;
  };

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={formatDate(selectedDate)}
      />

      <div className="px-4 py-4 space-y-4">
        {/* Date Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setView('day')}
              className={`btn text-sm ${view === 'day' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Day
            </button>
            <button
              onClick={() => setView('week')}
              className={`btn text-sm ${view === 'week' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Week
            </button>
          </div>

          <button
            onClick={() => navigateDate('next')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Date Selection */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[-1, 0, 1, 2, 3, 4, 5].map((offset) => {
            const date = new Date();
            date.setDate(date.getDate() + offset);
            const isSelected = date.toDateString() === selectedDate.toDateString();

            return (
              <button
                key={offset}
                onClick={() => setSelectedDate(date)}
                className={`flex-shrink-0 w-14 py-2 rounded-lg text-center ${
                  isSelected
                    ? 'bg-primary-600 text-white'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="text-xs opacity-75">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="font-semibold">{date.getDate()}</div>
              </button>
            );
          })}
        </div>

        {/* Day Summary */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Today&apos;s Events</div>
              <div className="text-2xl font-bold">{dayEvents.length}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Types</div>
              <div className="text-lg font-semibold">
                {new Set(dayEvents.map(e => e.type)).size} types
              </div>
            </div>
          </div>
        </div>

        {/* Timeline View */}
        <div className="card overflow-hidden">
          <div className="relative" style={{ height: `${timeSlots.length * 80}px` }}>
            {/* Time slots */}
            {timeSlots.map((time, index) => (
              <div
                key={time}
                className="absolute w-full border-t border-gray-100 flex"
                style={{ top: `${index * 80}px` }}
              >
                <div className="w-16 py-2 px-3 text-xs text-gray-400 bg-gray-50">
                  {time}
                </div>
                <div className="flex-1" />
              </div>
            ))}

            {/* Events */}
            {dayEvents.map((event) => {
              const top = getTaskPosition(event.startAt);
              const height = getTaskHeight(event.startAt, event.endAt);
              const isWorkOrder = event.type === 'MAINTENANCE';
              const colorClass = isWorkOrder
                ? (priorityColors.medium)
                : 'bg-success-100 border-success-300 text-success-800';

              const href = event.workOrderId
                ? `/work-orders/${event.workOrderId}`
                : event.inspectionId
                ? `/inspections/${event.inspectionId}`
                : '#';

              return (
                <Link key={event.id} href={href}>
                  <div
                    className={`absolute left-16 right-2 rounded-lg border-l-4 p-2 ${colorClass}`}
                    style={{
                      top: `${top}px`,
                      height: `${Math.max(height - 4, 40)}px`,
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {isWorkOrder ? (
                        <Wrench className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <ClipboardCheck className="w-4 h-4 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs opacity-75">{event.type}</div>
                        <div className="font-medium text-sm truncate">{event.title}</div>
                        <div className="flex items-center gap-2 text-xs mt-1">
                          {event.location && (
                            <>
                              <MapPin className="w-3 h-3" />
                              <span>{event.location}</span>
                            </>
                          )}
                          <Clock className="w-3 h-3 ml-2" />
                          <span>{new Date(event.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* No events message */}
        {dayEvents.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No events scheduled</h3>
            <p className="text-sm text-gray-500 mt-1">
              You have no events scheduled for this day
            </p>
          </div>
        )}
      </div>
    </>
  );
}
