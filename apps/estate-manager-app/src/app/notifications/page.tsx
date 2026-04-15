'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function NotificationsPage() {
  return (
    <LiveDataRequiredPage
      title="Notifications"
      feature="notifications"
      description="Mock notification entries have been removed. Requires live notifications service."
      showBack
    />
  );
}
