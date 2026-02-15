'use client';

import { usePathname } from 'next/navigation';

const ONBOARDING_STEPS = [
  { id: 'welcome', path: '/onboarding/welcome', label: 'Welcome' },
  { id: 'documents', path: '/onboarding/documents', label: 'Documents' },
  { id: 'utilities', path: '/onboarding/utilities', label: 'Utilities' },
  { id: 'orientation', path: '/onboarding/orientation', label: 'Rules' },
  { id: 'inspection', path: '/onboarding/inspection', label: 'Inspection' },
  { id: 'e-sign', path: '/onboarding/e-sign', label: 'Sign' },
];

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Don't show progress bar on the hub page or completion page
  const isHubPage = pathname === '/onboarding';
  const isCompletePage = pathname === '/onboarding/complete';
  const showProgressBar = !isHubPage && !isCompletePage;

  // Determine current step index
  const currentStepIndex = ONBOARDING_STEPS.findIndex(
    (step) => pathname === step.path || pathname.startsWith(step.path + '/')
  );
  const progress =
    currentStepIndex >= 0
      ? ((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100
      : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {showProgressBar && currentStepIndex >= 0 && (
        <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
          {/* Step indicator pills */}
          <div className="px-4 pt-2 pb-1 flex items-center gap-1.5">
            {ONBOARDING_STEPS.map((step, idx) => (
              <div key={step.id} className="flex-1 flex flex-col items-center">
                <div
                  className={`h-1 w-full rounded-full transition-all duration-300 ${
                    idx < currentStepIndex
                      ? 'bg-success-500'
                      : idx === currentStepIndex
                      ? 'bg-primary-500'
                      : 'bg-gray-200'
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="px-4 pb-2 flex justify-between text-[10px] text-gray-400">
            {ONBOARDING_STEPS.map((step, idx) => (
              <span
                key={step.id}
                className={`${
                  idx === currentStepIndex
                    ? 'text-primary-600 font-medium'
                    : idx < currentStepIndex
                    ? 'text-success-600'
                    : ''
                }`}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
