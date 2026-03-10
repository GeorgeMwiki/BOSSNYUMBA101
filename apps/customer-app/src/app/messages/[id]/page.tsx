'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MessageThreadPage() {
  return (
    <LiveDataRequiredScreen
      title="Conversation"
      feature="conversation detail data"
      description="Static conversation messages have been removed. This screen now requires live conversation history and delivery state."
      showBack
    />
  );
}
