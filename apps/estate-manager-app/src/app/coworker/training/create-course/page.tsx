'use client';

/**
 * /coworker/training/create-course — coworker AI course-generation flow.
 *
 * Orchestrates the four-step creation flow (ported from LitFin's borrower
 * /learn/create, retargeted to estate management):
 *   1. DomainPicker     pick an estate-management topic
 *   2. ScenarioForm     describe the situation + difficulty
 *   3. DocumentAttach   optional grounding documents
 *   4. POST /api/v1/courses/generate -> redirect to the generated course
 *
 * Generation is async on the server (202 + placeholder id); the course page is
 * the redirect target and polls until lessons appear. Single-language per
 * render. The GenerationModal covers the kickoff call.
 */

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { ROUTES } from '@/lib/routes';
import { coursesService } from '@bossnyumba/api-client';
import type { GenerateCourseRequest } from '@bossnyumba/api-client/courses-types';
import { DomainPicker, type DomainSelection } from './_components/DomainPicker';
import { ScenarioForm, type ScenarioResult } from './_components/ScenarioForm';
import { DocumentAttach, type AttachedDocument } from './_components/DocumentAttach';
import { GenerationModal } from './_components/GenerationModal';

type FlowStep = 'domain' | 'scenario' | 'documents';
type Language = 'en' | 'sw';

function isSupportedLanguage(value: string): value is Language {
  return value === 'en' || value === 'sw';
}

export default function CreateCoursePage(): JSX.Element {
  const router = useRouter();
  const t = useTranslations('createCourse');
  const locale = useLocale();
  // The flow runs in one language end to end (CLAUDE.md absolute-locale rule).
  const language: Language = useMemo(
    () => (isSupportedLanguage(locale) ? locale : 'en'),
    [locale],
  );

  const [step, setStep] = useState<FlowStep>('domain');
  const [domain, setDomain] = useState<DomainSelection | null>(null);
  const [scenario, setScenario] = useState<ScenarioResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (documents: ReadonlyArray<AttachedDocument>) => {
      if (!domain || !scenario) return;
      setIsGenerating(true);
      setError(null);
      try {
        const body: GenerateCourseRequest = {
          domain: domain.domainId,
          scenarioDescription: scenario.scenarioDescription,
          difficulty: scenario.difficulty,
          language,
          documents: documents.map((d) => ({
            documentId: d.documentId,
            documentName: d.documentName,
            documentType: d.documentType,
            summary: d.summary,
          })),
        };
        const res = await coursesService.generate(body);
        const courseId = res?.data?.courseId ?? res?.data?.id;
        if (!res?.success || !courseId) {
          setError(t('generationErrorBody'));
          return;
        }
        router.push(ROUTES.coworker.course(courseId));
      } catch {
        setError(t('generationNetworkError'));
      } finally {
        setIsGenerating(false);
      }
    },
    [domain, scenario, language, router, t],
  );

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} showBack />

      <div className="mx-auto max-w-3xl px-4 py-4">
        <StepIndicator step={step} />

        {step === 'domain' ? (
          <DomainPicker
            language={language}
            onSelect={(selection) => {
              setDomain(selection);
              setStep('scenario');
            }}
          />
        ) : null}

        {step === 'scenario' && domain ? (
          <ScenarioForm
            language={language}
            domainLabel={domain.label}
            onBack={() => setStep('domain')}
            onSubmit={(result) => {
              setScenario(result);
              setStep('documents');
            }}
          />
        ) : null}

        {step === 'documents' && domain && scenario ? (
          <DocumentAttach
            language={language}
            onBack={() => setStep('scenario')}
            onContinue={(documents) => void generate(documents)}
          />
        ) : null}
      </div>

      <GenerationModal
        isGenerating={isGenerating}
        error={error}
        onRetry={() => {
          setError(null);
          void generate([]);
        }}
        onCancel={() => {
          setError(null);
          setIsGenerating(false);
        }}
      />
    </>
  );
}

function StepIndicator({ step }: { step: FlowStep }): JSX.Element {
  const t = useTranslations('createCourse');
  const steps: ReadonlyArray<{ key: FlowStep; label: string }> = [
    { key: 'domain', label: t('stepDomain') },
    { key: 'scenario', label: t('stepScenario') },
    { key: 'documents', label: t('stepDocuments') },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);
  return (
    <ol className="mb-4 flex items-center gap-2" aria-label={t('stepProgress')}>
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? 'bg-sky-500 text-white'
                  : done
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`hidden text-xs sm:inline ${
                active ? 'font-medium text-gray-900' : 'text-gray-400'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="h-px flex-1 bg-gray-200" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
