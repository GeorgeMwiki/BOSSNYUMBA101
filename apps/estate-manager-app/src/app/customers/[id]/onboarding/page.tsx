'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function CustomerOnboardingPage() {
  return (
    <LiveDataRequiredPage
      title="Customer Onboarding"
      feature="customer onboarding progress"
      description="Fallback onboarding progress state has been removed. This page now requires live onboarding workflow data."
      showBack
    />
  );
}
