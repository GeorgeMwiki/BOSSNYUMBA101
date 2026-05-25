'use client';

import dynamic from 'next/dynamic';

/**
 * `/register` — phone-first signup entry. Aliases `/signup/phone` so
 * marketing CTAs and the E2E onboarding spec (CA-AC-001) both land on
 * the same affordance without an extra redirect.
 *
 * Performance: dynamic-imported `PhoneSignupForm` — see
 * /signup/phone/page.tsx for rationale.
 */
const PhoneSignupForm = dynamic(
  () =>
    import('../../components/onboarding/PhoneSignupForm.js').then((m) => ({
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
      aria-label="Loading registration form"
      className="mx-auto flex w-full max-w-md flex-col gap-4 p-6"
    >
      <div className="h-7 w-2/3 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
      <div className="h-12 w-full animate-pulse rounded bg-gray-200" />
      <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
    </div>
  );
}

export default function RegisterPage(): JSX.Element {
  return <PhoneSignupForm successRedirect="/onboarding" />;
}
