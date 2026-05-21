'use client';

import { PhoneSignupForm } from '@/components/onboarding/PhoneSignupForm';

/**
 * `/register` — phone-first signup entry. Aliases `/signup/phone` so
 * marketing CTAs and the E2E onboarding spec (CA-AC-001) both land on
 * the same affordance without an extra redirect.
 */
export default function RegisterPage(): JSX.Element {
  return <PhoneSignupForm successRedirect="/onboarding" />;
}
