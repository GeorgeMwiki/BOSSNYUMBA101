'use client';

import { PhoneSignupForm } from '@/components/onboarding/PhoneSignupForm';

/**
 * `/signup/phone` — Phone-first signup entry point.
 *
 * Covers CA-AC-001 (signup via phone/OTP). Dedicated route, kept thin
 * because the form logic is centralised in `PhoneSignupForm` and reused
 * by `/register` (legacy path retained for back-compat with marketing
 * links + E2E specs).
 */
export default function SignupPhonePage(): JSX.Element {
  return <PhoneSignupForm successRedirect="/onboarding" />;
}
