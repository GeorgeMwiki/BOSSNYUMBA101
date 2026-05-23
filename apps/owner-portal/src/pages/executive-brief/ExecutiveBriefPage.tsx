/**
 * ExecutiveBriefPage — owner-portal surface for Piece C
 * (`@bossnyumba/executive-brief-engine`).
 *
 * The brief is a daily, MD-tier digest with inline citations: each
 * insight links back to the sub-MD whose dynamic-sections evidence the
 * conclusion. Wave-3 INT-4 lands the surface; the engine itself is
 * carried in via API once the executive-brief-engine route handler is
 * mounted in api-gateway.
 *
 * Gating: behind `executive_brief_enabled` so prod stays unchanged
 * until the flag flips. While the API client hook is unwired, the page
 * renders an honest skeleton with deep-link CTAs so end-users see the
 * surface coming and admins can validate routing.
 *
 * TODO(wave3-int5): replace stub data with
 *   `useExecutiveBrief()` from `@bossnyumba/api-client`. The engine
 *   returns `{ generatedAt, sections: [{ id, title, summary, citations }] }`.
 */

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { FileText, ExternalLink, Sparkles } from 'lucide-react';
import { Skeleton, EmptyState } from '@bossnyumba/design-system';
import { useFeatureFlag } from '../../lib/useFeatureFlag';

interface BriefSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly citations: ReadonlyArray<{ readonly label: string; readonly href: string }>;
}

interface BriefStub {
  readonly generatedAt: string | null;
  readonly sections: ReadonlyArray<BriefSection>;
}

function useExecutiveBriefStub(): { data: BriefStub | null; isLoading: boolean } {
  // TODO(wave3-int5): replace with a real TanStack-Query hook against
  // executive-brief-engine. For now we return a stable empty state so
  // the page is visible behind the flag and typecheck-clean.
  return useMemo(
    () => ({
      data: { generatedAt: null, sections: [] },
      isLoading: false,
    }),
    [],
  );
}

export function ExecutiveBriefPage(): JSX.Element {
  const t = useTranslations('executiveBrief');
  const enabled = useFeatureFlag('executive_brief_enabled');
  const { data, isLoading } = useExecutiveBriefStub();

  if (!enabled) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <EmptyState
          icon={<Sparkles className="h-10 w-10" />}
          title={t('disabledTitle')}
          description={t('disabledDescription')}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data || data.sections.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">
          {t('generatedAt', { time: data.generatedAt ?? '' })}
        </p>
      </header>
      {data.sections.map((section) => (
        <article
          key={section.id}
          data-testid="exec-brief-section"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
          <p className="mt-2 text-sm text-gray-700">{section.summary}</p>
          {section.citations.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {section.citations.map((citation) => (
                <li key={citation.href} className="text-xs">
                  <a
                    href={citation.href}
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {citation.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export default ExecutiveBriefPage;
