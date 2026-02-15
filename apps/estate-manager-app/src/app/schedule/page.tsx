'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, ChevronRight, Clock, MapPin, 
  Wrench, ClipboardCheck, AlertTriangle
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface ScheduledTask {
  id: string;
  type: 'work_order' | 'inspection';
  reference: string;
  title: string;
  unit: string;
  time: string;
  duration: number; // minutes
  priority?: 'emergency' | 'high' | 'medium' | 'low';
  inspectionType?: 'move_in' | 'move_out' | 'routine';
}

const schedule: Record<string, ScheduledTask[]> = {
  '2024-02-25': [
    {
      id: '1',
      type: 'work_order',
      reference: 'WO-2024-0042',
      title: 'Kitchen sink leaking',
      unit: 'A-204',
      time: '09:00',
      duration: 90,
      priority: 'high',
    },
    {
      id: '2',
      type: 'inspection',
      reference: 'INS-2024-0028',
      title: 'Move-in Inspection',
      unit: 'A-301',
      time: '10:00',
      duration: 60,
      inspectionType: 'move_in',
    },
    {
      id: '3',
      type: 'work_order',
      reference: 'WO-2024-0045',
      title: 'AC not cooling',
      unit: 'B-102',
      time: '11:00',
      duration: 120,
      priority: 'medium',
    },
    {
      id: '4',
      type: 'work_order',
      reference: 'WO-2024-0048',
      title: 'Door lock replacement',
      unit: 'C-301',
      time: '14:00',
      duration: 45,
      priority: 'high',
    },
    {
      id: '5',
      type: 'work_order',
      reference: 'WO-2024-0052',
      title: 'Water heater not working',
      unit: 'C-405',
      time: '16:00',
      duration: 90,
      priority: 'emergency',
    },
  ],
  '2024-02-26': [
    {
      id: '6',
      type: 'inspection',
      reference: 'INS-2024-0027',
      title: 'Move-out Inspection',
      unit: 'B-105',
      time: '14:00',
      duration: 90,
      inspectionType: 'move_out',
    },
  ],
};

const priorityColors = {
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
  const [selectedDate, setSelectedDate] = useState(new Date('2024-02-25'));
  const [view, setView] = useState<'day' | 'week'>('day');

  const dateKey = selectedDate.toISOString().split('T')[0];
  const dayTasks = schedule[dateKey] || [];

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

  const getTaskPosition = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const startHour = 8;
    return ((hours - startHour) * 60 + minutes) / 60 * 80; // 80px per hour
  };

  const getTaskHeight = (duration: number) => {
    return (duration / 60) * 80; // 80px per hour
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
            const date = new Date('2024-02-25');
            date.setDate(date.getDate() + offset);
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const hasEvents = schedule[date.toISOString().split('T')[0]]?.length > 0;

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
                {hasEvents && !isSelected && (
                  <div className="w-1 h-1 bg-primary-500 rounded-full mx-auto mt-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Day Summary */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Today&apos;s Tasks</div>
              <div className="text-2xl font-bold">{dayTasks.length}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Time</div>
              <div className="text-lg font-semibold">
                {Math.round(dayTasks.reduce((acc, t) => acc + t.duration, 0) / 60)}h
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

            {/* Tasks */}
            {dayTasks.map((task) => {
              const top = getTaskPosition(task.time);
              const height = getTaskHeight(task.duration);
              const isWorkOrder = task.type === 'work_order';
              const colorClass = isWorkOrder && task.priority 
                ? priorityColors[task.priority]
                : 'bg-success-100 border-success-300 text-success-800';

              return (
                <Link
                  key={task.id}
                  href={isWorkOrder ? `/work-orders/${task.id}` : `/inspections/${task.id}`}
                >
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
                        <div className="text-xs opacity-75">{task.reference}</div>
                        <div className="font-medium text-sm truncate">{task.title}</div>
                        <div className="flex items-center gap-2 text-xs mt-1">
                          <MapPin className="w-3 h-3" />
                          <span>Unit {task.unit}</span>
                          <Clock className="w-3 h-3 ml-2" />
                          <span>{task.duration}m</span>
                        </div>
                      </div>
                      {task.priority === 'emergency' && (
                        <AlertTriangle className="w-4 h-4 text-danger-600 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* No tasks message */}
        {dayTasks.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No tasks scheduled</h3>
            <p className="text-sm text-gray-500 mt-1">
              You have no tasks scheduled for this day
            </p>
          </div>
        )}
      </div>
    </>
  );
}
