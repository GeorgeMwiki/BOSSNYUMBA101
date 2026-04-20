'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, MapPin, Wrench, ClipboardCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

type EventType = 'work_order' | 'inspection' | 'appointment';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  type: EventType;
  unit?: string;
  property?: string;
}

// Live wiring pending — events endpoint not yet mounted. Empty array
// keeps the UI honest until the calendar service is plumbed.
const allEvents: Event[] = [];

const typeConfig: Record<EventType, { labelKey: 'typeWorkOrder' | 'typeInspection' | 'typeAppointment'; icon: React.ElementType; color: string }> = {
  work_order: { labelKey: 'typeWorkOrder', icon: Wrench, color: 'bg-warning-100 text-warning-800' },
  inspection: { labelKey: 'typeInspection', icon: ClipboardCheck, color: 'bg-success-100 text-success-800' },
  appointment: { labelKey: 'typeAppointment', icon: Calendar, color: 'bg-primary-100 text-primary-800' },
};

export default function EventsListPage() {
  const t = useTranslations('eventsList');
  const [filter, setFilter] = useState<EventType | 'all'>('all');

  const filteredEvents = allEvents
    .filter((e) => filter === 'all' || e.type === filter)
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      return dateCompare !== 0 ? dateCompare : a.time.localeCompare(b.time);
    });

  // Group by date
  const byDate = filteredEvents.reduce<Record<string, Event[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {});

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} showBack />

      <div className="px-4 py-4 space-y-4">
        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { value: 'all' as const, label: t('filterAll') },
            ...(Object.entries(typeConfig) as [EventType, typeof typeConfig[EventType]][]).map(([value, cfg]) => ({
              value,
              label: t(cfg.labelKey),
            })),
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as EventType | 'all')}
              className={`btn text-sm whitespace-nowrap ${filter === tab.value ? 'btn-primary' : 'btn-secondary'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Events by Date */}
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
                  const config = typeConfig[event.type];
                  const Icon = config.icon;
                  return (
                    <Link
                      key={event.id}
                      href={event.type === 'work_order' ? `/work-orders/${event.id}` : `/inspections/${event.id}`}
                    >
                      <div className="card p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${config.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{event.title}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                              <Clock className="w-4 h-4" />
                              {event.time}
                              {event.unit && (
                                <>
                                  <MapPin className="w-4 h-4" />
                                  {t('unitPrefix', { unit: event.unit })}
                                </>
                              )}
                            </div>
                            {event.property && (
                              <div className="text-xs text-gray-400 mt-1">{event.property}</div>
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

        {filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">{t('noEvents')}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filter === 'all' ? t('noScheduled') : t('noTypeEvents', { type: filter.replace('_', ' ') })}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
