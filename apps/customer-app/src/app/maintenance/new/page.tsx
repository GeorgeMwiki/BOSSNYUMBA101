'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function NewMaintenancePage() {
  return (
    <LiveDataRequiredScreen
      title="Report Issue"
      feature="maintenance intake"
      description="Simulated issue submission, placeholder photo uploads, and offline voice-note flows have been removed. This screen now requires live maintenance intake APIs."
      showBack
    />
  );
}
