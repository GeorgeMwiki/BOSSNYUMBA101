'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  MapPin,
  Wrench,
  ClipboardCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { schedulingApi, type ScheduleEvent } from '@/lib/api';

type FilterType = 'all' | 'WORK_ORDER' | 'INSPECTION' | 'APPOINTMENT';

const typeConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  WORK_ORDER: { label: 'Work Order', icon: Wrench, color: 'bg-warning-100 text-warning-800' },
  MAINTENANCE: { label: 'Maintenance', icon: Wrench, color: 'bg-warning-100 text-warning-800' },
  INSPECTION: { label: 'Inspection', icon: ClipboardCheck, color: 'bg-success-100 text-success-800' },
  VIEWING: { label: 'Viewing', icon: Calendar, color: 'bg-primary-100 text-primary-800' },
  LEASE_SIGNING: { label: 'Lease Signing', icon: Calendar, color: 'bg-primary-100 text-primary-800' },
  MEETING: { label: 'Meeting', icon: Calendar, color: 'bg-primary-100 text-primary-800' },
  OTHER: { label: 'Event', icon: Calendar, color: 'bg-gray-100 text-gray-800' },
};

function eventLink(ev: ScheduleEvent): string {
  if (ev.workOrderId) return `/work-orders/${ev.workOrderId}`;
  if (ev.inspectionId) return `/inspections/${ev.inspectionId}`;
  return '#';
}

export default function EventsListPage() {
  const [filter, setFilter] = useState<FilterType>('all');

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59).toISOString();

  const eventsQuery = useQuery({
    queryKey: ['events-list', startDate, endDate],
    queryFn: () => schedulingApi.listEvents({ startDate, endDate }),
    retry: false,
  });

  const response = eventsQuery.data;
  const allEvents: ScheduleEvent[] = response?.data ?? [];
  const errorMessage =
    eventsQuery.error instanceof Error
      ? eventsQuery.error.message
      : response && !response.success
      ? response.error?.message
      : undefined;

  const byDate = useMemo(() => {
    const filtered = allEvents.filter((e) => {
      if (filter === 'all') return true;
      if (filter === 'WORK_ORDER') return e.type === 'MAINTENANCE' || e.workOrderId;
      return e.type === filter;
    });
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    return sorted.reduce<Record<string, ScheduleEvent[]>>((acc, ev) => {
      const key = new Date(ev.startAt).toISOString().split('T')[0];
      if (!acc[key]) acc[key] = [];
      acc[key].push(ev);
      return acc;
    }, {});
  }, [allEvents, filter]);

  return (
    <>
      <PageHeader title="Events" subtitle="All scheduled events" showBack />

      <div className="px-4 py-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(
            [
              { value: 'all', label: 'All' },
              { value: 'WORK_ORDER', label: 'Work Orders' },
              { value: 'INSPECTION', label: 'Inspections' },
              { value: 'APPOINTMENT', label: 'Appointments' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as FilterType)}
              className={`btn text-sm whitespace-nowrap ${
                filter === tab.value ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {eventsQuery.isLoading && (
          <div className="card p-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading events...
          </div>
        )}

        {errorMessage && (
          <div className="card p-4 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Unable to load events</div>
              <div>{errorMessage}</div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {Object.entries(byDate).map(([date, evs]) => (
            <section key={date}>
              <h2 className="text-sm font-medium text-gray-500 mb-3">
                {new Date(date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h2>
              <div className="space-y-3">
                {evs.map((event) => {
                  const config = typeConfig[event.type] ?? typeConfig.OTHER;
                  const Icon = config.icon;
                  const time = new Date(event.startAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  });
                  return (
                    <Link key={event.id} href={eventLink(event)}>
                      <div className="card p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${config.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{event.title}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                              <Clock className="w-4 h-4" />
                              {time}
                              {event.location && (
                                <>
                                  <MapPin className="w-4 h-4" />
                                  {event.location}
                                </>
                              )}
                            </div>
                            {event.description && (
                              <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                                {event.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {!eventsQuery.isLoading && !errorMessage && Object.keys(byDate).length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No events</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filter === 'all' ? 'No scheduled events' : 'No events match this filter'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
