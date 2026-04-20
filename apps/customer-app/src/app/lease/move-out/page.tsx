'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MoveOutNoticePage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('moveOutNotice')}
      feature="move-out workflow"
      description="Local-only move-out persistence and synthetic status handling have been removed. This workflow now requires the live lease move-out backend."
      showBack
    />
  );
}
