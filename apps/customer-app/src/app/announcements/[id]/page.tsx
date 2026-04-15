'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function AnnouncementDetailPage() {
  return (
    <LiveDataRequiredScreen
      title="Announcement"
      feature="announcement detail"
      description="Static announcement mocks have been removed. This screen now requires live announcement data from the property management API."
      showBack
    />
  );
}
