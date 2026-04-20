'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function CustomerOnboardingPage() {
  const t = useTranslations('simple');
  return (
    <LiveDataRequiredPage
      title={t('customerOnboarding')}
      feature="customer onboarding progress"
      description="Fallback onboarding progress state has been removed. This page now requires live onboarding workflow data."
      showBack
    />
  );
}
