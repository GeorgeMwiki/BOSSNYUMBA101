'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MessageThreadPage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('conversation')}
      feature="conversation detail data"
      description="Static conversation messages have been removed. This screen now requires live conversation history and delivery state."
      showBack
    />
  );
}
