'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function MessagingPage() {
  return (
    <LiveDataRequiredPage
      title="Messages"
      feature="messaging threads"
      description="Sample conversations have been removed. Requires a live messaging service."
    />
  );
}
