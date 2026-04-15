'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function CreateAnnouncementPage() {
  return (
    <LiveDataRequiredPage
      title="Create Announcement"
      feature="announcement publishing"
      description="Announcement creation requires live property and announcement services. The local form has been removed."
      showBack
    />
  );
}
