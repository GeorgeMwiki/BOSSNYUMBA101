'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function SubleaseRequestPage() {
  const t = useTranslations('subleasePage');
  return (
    <LiveDataRequiredScreen
      title={t('title')}
      feature="sublease request"
      description="The previous form posted to /api/customer/lease/sublease, which does not exist. Wire to the live /api/v1/subleases endpoint before re-enabling this screen."
      showBack
    />
  );
}
