'use client';

import { CheckCircle } from 'lucide-react';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  action: string;
  status?: string;
  user?: string;
  notes?: string | null;
}

interface StatusTimelineProps {
  events: TimelineEvent[];
  currentStatus: string;
  emptyMessage?: string;
}

const statusOrder = [
  'submitted',
  'triaged',
  'assigned',
  'scheduled',
  'in_progress',
  'completed',
];

export function StatusTimeline({
  events,
  currentStatus,
  emptyMessage = 'No activity yet',
}: StatusTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">{emptyMessage}</div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => {
        const currentIndex = statusOrder.indexOf(event.status || '');
        const activeIndex = statusOrder.indexOf(currentStatus);
        const isCompleted = currentIndex >= 0 && currentIndex < activeIndex;
        const isActive = event.status === currentStatus;

        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex-shrink-0 mt-0.5 ${
                  isCompleted || isActive
                    ? 'text-primary-500'
                    : 'text-gray-300'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isActive ? 'bg-primary-500 ring-4 ring-primary-100' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
              {index < events.length - 1 && (
                <div className="w-0.5 flex-1 min-h-[24px] bg-gray-200 mt-1" />
              )}
            </div>
            <div className="flex-1 pb-6">
              <div
                className={`text-sm font-medium ${
                  isActive ? 'text-primary-700' : 'text-gray-700'
                }`}
              >
                {event.action}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {new Date(event.timestamp).toLocaleString()}
                {event.user && ` • ${event.user}`}
              </div>
              {event.notes && (
                <p className="text-xs text-gray-600 mt-1 italic">{event.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
