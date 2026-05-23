'use client';

/**
 * Estate Manager — team assignments view of Piece M
 * (`@bossnyumba/workforce-orchestrator`).
 *
 * Same data shape as the owner-portal page but the manager only sees
 * their own team. UI is mobile-first (matches the rest of estate-
 * manager-app's dark + dense aesthetic).
 *
 * TODO(wave3-int5): wire workforce list + follow-ups via api-client.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { isFeatureEnabled } from '@/lib/featureFlags';

interface Assignment {
  readonly id: string;
  readonly assignee: string;
  readonly task: string;
  readonly dueLabel: string;
}

function useTeamAssignmentsStub(): {
  data: ReadonlyArray<Assignment>;
  isLoading: boolean;
} {
  return useMemo(() => ({ data: [], isLoading: false }), []);
}

export default function ManagerWorkforcePage() {
  const t = useTranslations('managerWorkforce');
  const enabled = isFeatureEnabled('workforce_enabled');
  const { data } = useTeamAssignmentsStub();

  if (!enabled) {
    return (
      <>
        <PageHeader title={t('title')} subtitle={t('subtitle')} showBack />
        <section className="px-4 py-12 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="mt-4 text-lg font-semibold">{t('disabledTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('disabledDescription')}
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} showBack />
      <section className="px-4 py-4 space-y-3">
        {data.length === 0 ? (
          <div
            data-testid="manager-workforce-empty"
            className="rounded-xl border border-dashed border-gray-700 bg-gray-900/20 p-8 text-center"
          >
            <Users className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-3 text-sm font-medium">{t('emptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('emptyDescription')}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((assignment) => (
              <li
                key={assignment.id}
                data-testid="manager-assignment-row"
                data-assignment-id={assignment.id}
                className="rounded-lg border border-gray-700 bg-gray-900/40 p-3"
              >
                <p className="text-sm font-medium">{assignment.task}</p>
                <p className="text-xs text-muted-foreground">
                  {assignment.assignee} · {assignment.dueLabel}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
