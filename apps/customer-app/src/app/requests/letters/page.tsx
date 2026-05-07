'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function RequestLetterPage() {
  const t = useTranslations('lettersPage');
  return (
    <LiveDataRequiredScreen
      title={t('title')}
      feature="letter requests"
      description="The previous form posted to /api/customer/requests/letters, which does not exist. Wire to the live /api/v1/letters endpoint before re-enabling."
      showBack
    />
  );
}
