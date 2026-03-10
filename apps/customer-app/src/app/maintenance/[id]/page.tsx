'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MaintenanceDetailPage() {
  return (
    <LiveDataRequiredScreen
      title="Maintenance Request"
      feature="maintenance request detail"
      description="Placeholder maintenance details, photos, and synthetic progress states have been removed. This screen now requires live maintenance request data."
      showBack
    />
  );
}
