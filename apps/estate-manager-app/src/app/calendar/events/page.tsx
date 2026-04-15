'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function CalendarEventsPage() {
  return (
    <LiveDataRequiredPage
      title="Calendar Events"
      feature="calendar events"
      description="Sample scheduled events have been removed. Requires live scheduling data."
      showBack
    />
  );
}
