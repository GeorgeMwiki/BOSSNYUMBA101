'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function HomePage() {
  return (
    <LiveDataRequiredScreen
      title="Home"
      feature="resident feed and marketplace data"
      description="Synthetic feed posts and vendor cards have been removed. The home screen now requires live resident feed, announcement, and marketplace data."
    />
  );
}
