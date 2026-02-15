'use client';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  action: string;
  status?: string;
  user?: string;
  notes?: string | null;
}

interface TimelineProps {
  events: TimelineEvent[];
  /** Optional empty state message */
  emptyMessage?: string;
}

export function Timeline({ events, emptyMessage = 'No activity yet' }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">{emptyMessage}</div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0" />
            {index < events.length - 1 && (
              <div className="w-0.5 flex-1 min-h-[24px] bg-gray-200 mt-1" />
            )}
          </div>
          <div className="flex-1 pb-6">
            <div className="text-sm font-medium">{event.action}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {new Date(event.timestamp).toLocaleString()}
              {event.user && ` • ${event.user}`}
            </div>
            {event.notes && (
              <p className="text-xs text-gray-600 mt-1 italic">{event.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
