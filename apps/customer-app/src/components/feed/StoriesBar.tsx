'use client';

import { LiveDataRequiredPanel } from '@/components/LiveDataRequired';

export function StoriesBar() {
  return (
    <LiveDataRequiredPanel
      title="Stories unavailable"
      message="Static stories have been removed. This widget now requires a live resident feed."
    />
  );
}
