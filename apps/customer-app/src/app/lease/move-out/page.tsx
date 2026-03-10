'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MoveOutNoticePage() {
  return (
    <LiveDataRequiredScreen
      title="Move Out Notice"
      feature="move-out workflow"
      description="Local-only move-out persistence and synthetic status handling have been removed. This workflow now requires the live lease move-out backend."
      showBack
    />
  );
}
