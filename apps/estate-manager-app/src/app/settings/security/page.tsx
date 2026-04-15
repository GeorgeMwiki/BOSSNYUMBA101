'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function SecuritySettingsPage() {
  return (
    <LiveDataRequiredPage
      title="Security"
      feature="password change"
      description="Password updates require a live auth/identity service. The local form has been removed."
      showBack
    />
  );
}
