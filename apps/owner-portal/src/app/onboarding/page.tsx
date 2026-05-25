import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Mail,
  Building2,
  Users,
  MessageSquare,
  Compass,
  Sparkles,
  Clock,
  ChevronRight,
} from 'lucide-react';

/**
 * /onboarding — Phase F.5 first-run checklist for new tenant owners.
 *
 * 8-step path from signup to first MD-driven action:
 *   1. Account created
 *   2. Verify your email
 *   3. Add your first property
 *   4. Import your tenants
 *   5. Chat with the MD for the first time
 *   6. Pick your owner intent
 *   7. Install 3 starter Skills
 *   8. Schedule your first daily briefing
 *
 * Drop-in to the existing owner-portal layout. Each step renders a
 * progress + "Continue" CTA. Completed steps are green-checked.
 * Skipped/incomplete amber-flagged.
 *
 * Endpoint: GET /api/v1/onboarding/checklist (returns the live step
 * state for the current onboarding session). The page falls back to a
 * starter checklist when the API returns 404 (no session) — useful for
 * showing the full path to new visitors who haven't signed up yet.
 */

const ENDPOINT = '/api/v1/onboarding/checklist';

type StepId =
  | 'account_created'
  | 'verify_email'
  | 'first_property'
  | 'first_tenant_import'
  | 'first_md_chat'
  | 'owner_intent'
  | 'install_starter_skills'
  | 'schedule_daily_briefing';

interface Step {
  readonly id: StepId;
  readonly label: string;
  readonly description: string;
  readonly completed: boolean;
  readonly completedAt?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

interface ChecklistResponse {
  readonly tenantId: string;
  readonly businessName: string;
  readonly progress: {
    readonly completed: number;
    readonly total: number;
    readonly percent: number;
  };
  readonly steps: ReadonlyArray<Step>;
  readonly intent: 'cashflow' | 'growth' | 'exit' | null;
  readonly suggestedSkills: ReadonlyArray<string>;
}

interface PageState {
  readonly status: 'loading' | 'ok' | 'no-session' | 'error';
  readonly data: ChecklistResponse | null;
  readonly errorMessage?: string;
}

function useFallbackChecklist(): ChecklistResponse {
  const t = useTranslations('p89.onboarding');
  return useMemo(
    () => ({
      tenantId: 'pending',
      businessName: 'Your portfolio',
      progress: { completed: 1, total: 8, percent: 13 },
      steps: [
        {
          id: 'account_created',
          label: t('accountCreated'),
          description: 'Your tenant + owner account are live.',
          completed: true,
        },
        {
          id: 'verify_email',
          label: t('verifyEmail'),
          description: 'Click the link we sent to confirm the address.',
          completed: false,
        },
        {
          id: 'first_property',
          label: t('addFirstProperty'),
          description: 'Tell us the address, unit count, and rent estimate.',
          completed: false,
        },
        {
          id: 'first_tenant_import',
          label: t('importTenants'),
          description: 'CSV upload or add one tenant manually.',
          completed: false,
        },
        {
          id: 'first_md_chat',
          label: t('chatFirstTime'),
          description: 'Meet Mr. Mwikila — your portfolio concierge.',
          completed: false,
        },
        {
          id: 'owner_intent',
          label: t('pickOwnerIntent'),
          description: 'Cashflow-first, growth, or exit-prep — pick one.',
          completed: false,
        },
        {
          id: 'install_starter_skills',
          label: t('installStarterSkills'),
          description: 'Curated by Mr. Mwikila based on your intent.',
          completed: false,
        },
        {
          id: 'schedule_daily_briefing',
          label: t('scheduleBriefing'),
          description: 'A 5-minute morning brief delivered however you like.',
          completed: false,
        },
      ],
      intent: null,
      suggestedSkills: [],
    }),
    [t],
  );
}

const STEP_ICONS: Readonly<Record<StepId, React.ComponentType<{ className?: string }>>> = {
  account_created: CheckCircle2,
  verify_email: Mail,
  first_property: Building2,
  first_tenant_import: Users,
  first_md_chat: MessageSquare,
  owner_intent: Compass,
  install_starter_skills: Sparkles,
  schedule_daily_briefing: Clock,
};

const CTA_LABEL: Readonly<Record<StepId, string>> = {
  account_created: 'Done',
  verify_email: 'Resend verification email',
  first_property: 'Add property',
  first_tenant_import: 'Import tenants',
  first_md_chat: 'Open Jarvis',
  owner_intent: 'Pick intent',
  install_starter_skills: 'Browse Skills',
  schedule_daily_briefing: 'Schedule briefing',
};

const CTA_TARGET: Readonly<Record<StepId, string>> = {
  account_created: '#',
  verify_email: '#resend',
  first_property: '/portfolio',
  first_tenant_import: '/tenants',
  first_md_chat: '/jarvis',
  owner_intent: '#intent',
  install_starter_skills: '/skills',
  schedule_daily_briefing: '#briefing',
};

function readSessionToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem('onboarding_session') ?? '';
  } catch {
    return '';
  }
}

export default function OnboardingPage(): JSX.Element {
  const tP89 = useTranslations('p89.onboarding');
  const FALLBACK_CHECKLIST = useFallbackChecklist();
  const [state, setState] = useState<PageState>({ status: 'loading', data: null });

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const token = readSessionToken();
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) headers['X-Onboarding-Session'] = token;
        const res = await fetch(ENDPOINT, { credentials: 'include', headers });
        if (cancelled) return;
        if (res.status === 404) {
          setState({ status: 'no-session', data: FALLBACK_CHECKLIST });
          return;
        }
        if (!res.ok) {
          setState({
            status: 'error',
            data: FALLBACK_CHECKLIST,
            errorMessage: `Checklist API returned ${res.status}`,
          });
          return;
        }
        const body = (await res.json()) as { data: ChecklistResponse };
        setState({ status: 'ok', data: body.data });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          data: FALLBACK_CHECKLIST,
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [FALLBACK_CHECKLIST]);

  function handleContinue(step: Step): void {
    if (step.completed) return;
    const target = CTA_TARGET[step.id];
    if (target.startsWith('#')) {
      // In-page actions handled by a future modal wired in F1 follow-up;
      // for now we dispatch a custom event the layout can listen to.
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(
            new CustomEvent('owner-portal:onboarding-action', {
              detail: { stepId: step.id, action: target.slice(1) },
            }),
          );
        } catch {
          /* ignore */
        }
      }
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = target;
    }
  }

  const data = state.data ?? FALLBACK_CHECKLIST;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tP89('welcomeAboard')}</h1>
          <p className="text-sm text-gray-500">
            Eight quick steps and Mr. Mwikila is fully onboarded for{' '}
            <span className="font-medium text-gray-900">{data.businessName}</span>.
          </p>
          {state.status === 'no-session' ? (
            <p className="mt-1 text-xs text-amber-700">
              No active onboarding session — sign up first or your session has expired.
            </p>
          ) : null}
          {state.status === 'error' && state.errorMessage ? (
            <p className="mt-1 text-xs text-red-700">
              Couldn&apos;t load live checklist ({state.errorMessage}). Showing the default path.
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-gray-500">Progress</div>
          <div className="text-2xl font-bold text-gray-900">
            {data.progress.completed}/{data.progress.total}
          </div>
          <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${data.progress.percent}%` }}
              aria-label={`${data.progress.percent}% complete`}
            />
          </div>
        </div>
      </header>

      <ol className="space-y-3" data-testid="onboarding-checklist">
        {data.steps.map((step, index) => {
          const Icon = STEP_ICONS[step.id];
          const isLast = index === data.steps.length - 1;
          const tone = step.completed
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-amber-200 bg-amber-50';
          return (
            <li
              key={step.id}
              data-testid={`onboarding-step-${step.id}`}
              data-completed={step.completed ? 'true' : 'false'}
              className={`flex items-start gap-3 rounded border p-4 ${tone}`}
            >
              <div className="flex-shrink-0 pt-0.5">
                {step.completed ? (
                  <CheckCircle2
                    className="h-5 w-5 text-emerald-600"
                    aria-label="completed"
                  />
                ) : (
                  <Circle
                    className="h-5 w-5 text-amber-600"
                    aria-label="incomplete"
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-gray-600" />
                  <h2 className="text-sm font-semibold text-gray-900">
                    {index + 1}. {step.label}
                  </h2>
                  {step.completed ? null : (
                    <AlertCircle
                      className="h-4 w-4 text-amber-500"
                      aria-label="action required"
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-600">{step.description}</p>
              </div>
              <button
                type="button"
                onClick={() => handleContinue(step)}
                disabled={step.completed}
                data-testid={`onboarding-cta-${step.id}`}
                className={`inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium transition ${
                  step.completed
                    ? 'cursor-not-allowed bg-emerald-100 text-emerald-700'
                    : 'bg-gray-900 text-white hover:bg-gray-700'
                }`}
              >
                {step.completed ? 'Done' : CTA_LABEL[step.id]}
                {step.completed ? null : <ChevronRight className="h-3 w-3" />}
              </button>
            </li>
          );
        })}
      </ol>

      {data.suggestedSkills.length > 0 ? (
        <section
          className="rounded border border-violet-200 bg-violet-50 p-4"
          data-testid="onboarding-suggested-skills"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Sparkles className="h-4 w-4 text-violet-600" />
            Mr. Mwikila&apos;s starter pack
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Based on your intent, install these three Skills to unlock the most value
            in your first 30 days.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.suggestedSkills.map((slug) => (
              <li
                key={slug}
                className="rounded-full bg-white px-2 py-0.5 text-xs text-violet-700 ring-1 ring-violet-200"
              >
                {slug}
              </li>
            ))}
          </ul>
          <a
            href="/skills"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-700"
          >
            Open Skills marketplace
            <ChevronRight className="h-3 w-3" />
          </a>
        </section>
      ) : null}
    </div>
  );
}
