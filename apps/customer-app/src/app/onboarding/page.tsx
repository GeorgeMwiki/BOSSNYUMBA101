'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle,
  Sparkles,
  FileText,
  Zap,
  BookOpen,
  Camera,
  PenLine,
  ChevronRight,
  Home,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Onboarding State Machine (A0-A6):
 * A0 = Welcome & Channel Setup
 * A1 = Document Upload
 * A2 = Utilities Setup
 * A3 = Property Orientation (House Rules)
 * A4 = Move-In Inspection
 * A5 = E-Sign Documents
 * A6 = Complete
 */

interface OnboardingStep {
  id: string;
  stateCode: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  status: 'completed' | 'current' | 'upcoming';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    stateCode: 'A0',
    title: 'Welcome & Setup',
    description: 'Language preference & notification channels',
    icon: Sparkles,
    href: '/onboarding/welcome',
    status: 'current',
  },
  {
    id: 'documents',
    stateCode: 'A1',
    title: 'Upload Documents',
    description: 'Upload your ID and required documents',
    icon: FileText,
    href: '/onboarding/documents',
    status: 'upcoming',
  },
  {
    id: 'utilities',
    stateCode: 'A2',
    title: 'Utilities Setup',
    description: 'TANESCO/LUKU, water & gas instructions',
    icon: Zap,
    href: '/onboarding/utilities',
    status: 'upcoming',
  },
  {
    id: 'orientation',
    stateCode: 'A3',
    title: 'Property Orientation',
    description: 'House rules & community guidelines',
    icon: BookOpen,
    href: '/onboarding/orientation',
    status: 'upcoming',
  },
  {
    id: 'inspection',
    stateCode: 'A4',
    title: 'Move-in Inspection',
    description: 'Room-by-room photos & meter readings',
    icon: Camera,
    href: '/onboarding/inspection',
    status: 'upcoming',
  },
  {
    id: 'e-sign',
    stateCode: 'A5',
    title: 'Sign Documents',
    description: 'E-sign your lease and condition report',
    icon: PenLine,
    href: '/onboarding/e-sign',
    status: 'upcoming',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();
  const [steps, setSteps] = useState<OnboardingStep[]>(ONBOARDING_STEPS);

  // Load progress from localStorage
  useEffect(() => {
    const savedProgress = localStorage.getItem('onboarding_progress');
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress);
        let foundCurrent = false;

        setSteps((prev) =>
          prev.map((step) => {
            if (progress[step.id] === 'completed') {
              return { ...step, status: 'completed' as const };
            }
            if (!foundCurrent) {
              foundCurrent = true;
              return { ...step, status: 'current' as const };
            }
            return { ...step, status: 'upcoming' as const };
          })
        );
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const progress = (completedCount / steps.length) * 100;
  const currentStep = steps.find((s) => s.status === 'current') || steps[0];
  const allComplete = completedCount === steps.length;

  return (
    <main>
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-600 to-primary-700 text-white px-4 pt-8 pb-12 rounded-b-3xl">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-2">Welcome to BOSSNYUMBA</h1>
          <p className="text-primary-100 text-sm">
            Let&apos;s get you set up in your new home,{' '}
            {user?.firstName || 'there'}!
          </p>

          {/* Progress Indicator */}
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-primary-100">Your Progress</span>
              <span className="font-medium">
                {completedCount} of {steps.length} steps
              </span>
            </div>
            <div className="h-2 bg-primary-800/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 -mt-6 pb-8 max-w-md mx-auto">
        {/* Continue Card */}
        {!allComplete && (
          <Link
            href={currentStep.href}
            className="card p-5 mb-6 flex items-center gap-4 shadow-lg border-l-4 border-l-primary-500 active:scale-[0.98] transition-transform"
          >
            <div className="p-3 bg-primary-50 rounded-xl">
              <currentStep.icon className="w-6 h-6 text-primary-600" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-primary-600 font-medium uppercase tracking-wide mb-1">
                Step {steps.indexOf(currentStep) + 1} &middot;{' '}
                {currentStep.stateCode}
              </div>
              <h2 className="font-semibold text-gray-900">
                {currentStep.title}
              </h2>
              <p className="text-sm text-gray-500">
                {currentStep.description}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        )}

        {/* All complete card */}
        {allComplete && (
          <Link
            href="/onboarding/complete"
            className="card p-5 mb-6 flex items-center gap-4 shadow-lg bg-success-50 border-success-200 active:scale-[0.98] transition-transform"
          >
            <div className="p-3 bg-success-100 rounded-xl">
              <CheckCircle className="w-6 h-6 text-success-600" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-success-600 font-medium uppercase tracking-wide mb-1">
                All steps complete
              </div>
              <h2 className="font-semibold text-gray-900">
                Finish Onboarding
              </h2>
              <p className="text-sm text-gray-500">
                Get your welcome badge and move-in details
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-success-600" />
          </Link>
        )}

        {/* Steps List */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500">All Steps</h3>

          <div className="card divide-y divide-gray-100">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = step.status === 'completed';
              const isCurrent = step.status === 'current';
              const isUpcoming = step.status === 'upcoming';

              return (
                <Link
                  key={step.id}
                  href={isUpcoming ? '#' : step.href}
                  className={`flex items-center gap-4 p-4 transition-colors ${
                    isUpcoming
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={(e) => {
                    if (isUpcoming) e.preventDefault();
                  }}
                >
                  {/* Step indicator */}
                  <div className="relative">
                    {isCompleted ? (
                      <div className="w-8 h-8 rounded-full bg-success-500 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {index + 1}
                        </span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">
                          {index + 1}
                        </span>
                      </div>
                    )}
                    {index < steps.length - 1 && (
                      <div
                        className={`absolute left-1/2 top-full w-0.5 h-4 -translate-x-1/2 ${
                          isCompleted ? 'bg-success-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`font-medium text-sm ${
                          isCompleted ? 'text-success-700' : ''
                        }`}
                      >
                        {step.title}
                      </h4>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {step.stateCode}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {step.description}
                    </p>
                  </div>

                  {/* Status indicator */}
                  {isCompleted && (
                    <span className="badge-success text-xs">Done</span>
                  )}
                  {isCurrent && (
                    <ChevronRight className="w-5 h-5 text-primary-500" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Skip for now option */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <p className="text-xs text-gray-400 mt-2">
            You can complete onboarding later from your profile
          </p>
        </div>
      </div>
    </main>
  );
}
