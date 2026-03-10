'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MessagesPage() {
  return (
    <LiveDataRequiredScreen
      title="Messages"
      feature="message thread data"
      description="Static message threads have been removed. This screen now requires live messaging and notification data."
    />
  );
}
