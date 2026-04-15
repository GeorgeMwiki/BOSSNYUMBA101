'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function CalendarPage() {
  return (
    <LiveDataRequiredPage
      title="Calendar"
      feature="calendar event data"
      description="Sample calendar events and scheduled tasks have been removed. This view requires live scheduling, work-order, and inspection feeds."
    />
  );
}
