'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function ProfileSettingsPage() {
  return (
    <LiveDataRequiredPage
      title="Profile Settings"
      feature="profile editing"
      description="Hardcoded profile placeholders have been removed. Requires a live user-profile service before edits can be persisted."
      showBack
    />
  );
}
