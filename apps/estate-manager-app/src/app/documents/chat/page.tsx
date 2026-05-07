'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function DocumentChatPage() {
  const t = useTranslations('simple');
  return (
    <LiveDataRequiredPage
      title={t('askDocuments')}
      feature="document-aware chat"
      description="The previous page called /api/documents/chat, which does not exist. Wire to /api/v1/doc-chat on the gateway before re-enabling."
      showBack
    />
  );
}
