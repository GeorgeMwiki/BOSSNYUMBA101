'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function NotificationPreferencesPage() {
  return (
    <LiveDataRequiredPage
      title="Notification Preferences"
      feature="notification preferences"
      description="Local notification toggles have been removed. Requires a live notification-preferences service to persist changes."
      showBack
    />
  );
}
