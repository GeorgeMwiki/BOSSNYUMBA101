'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function RequestDetailPage() {
  return (
    <LiveDataRequiredScreen
      title="Request Detail"
      feature="request detail data"
      description="Mock request conversations, placeholder images, and local request state have been removed. This screen now requires live request and messaging data."
      showBack
    />
  );
}
