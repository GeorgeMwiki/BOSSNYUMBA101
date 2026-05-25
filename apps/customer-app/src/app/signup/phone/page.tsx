'use client';

import dynamic from 'next/dynamic';

/**
 * `/signup/phone` — Phone-first signup entry point.
 *
 * Covers CA-AC-001 (signup via phone/OTP). Dedicated route, kept thin
 * because the form logic is centralised in `PhoneSignupForm` and reused
 * by `/register` (legacy path retained for back-compat with marketing
 * links + E2E specs).
 *
 * Performance: `PhoneSignupForm` (~395 lines, region config + OTP
 * flow + country-code resolver) is dynamic-imported so the signup
 * shell paints immediately. Skeleton matches the form's intrinsic
 * size to prevent CLS.
 */
const PhoneSignupForm = dynamic(
  () =>
    import('../../../components/onboarding/PhoneSignupForm.js').then((m) => ({
      default: m.PhoneSignupForm,
    })),
  {
    ssr: false,
    loading: () => <PhoneSignupFormSkeleton />,
  },
);

function PhoneSignupFormSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading signup form"
      className="mx-auto flex w-full max-w-md flex-col gap-4 p-6"
    >
      <div className="h-7 w-2/3 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
      <div className="h-12 w-full animate-pulse rounded bg-gray-200" />
      <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
    </div>
  );
}

export default function SignupPhonePage(): JSX.Element {
  return <PhoneSignupForm successRedirect="/onboarding" />;
}
