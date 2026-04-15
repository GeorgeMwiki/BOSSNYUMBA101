'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function NewMessagePage() {
  return (
    <LiveDataRequiredPage
      title="New Message"
      feature="messaging"
      description="Mock recipient lists have been removed. Requires live customer and staff directories plus a messaging service."
      showBack
    />
  );
}
