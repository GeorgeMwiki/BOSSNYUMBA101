'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function NotificationsPage() {
  return (
    <LiveDataRequiredScreen
      title="Notifications"
      feature="Notifications feed"
      description="The hard-coded resident notification feed has been removed. This screen now requires the live in-app notifications service and user delivery state."
      showSettings
    />
  );
}
