'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function MessageThreadPage() {
  return (
    <LiveDataRequiredPage
      title="Conversation"
      feature="messaging thread"
      description="Mock conversation threads have been removed. Requires a live messaging service."
      showBack
    />
  );
}
