'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function AnnouncementsPage() {
  return (
    <LiveDataRequiredPage
      title="Announcements"
      feature="announcements"
      description="Sample announcements have been removed. Requires a live announcements service."
    />
  );
}
