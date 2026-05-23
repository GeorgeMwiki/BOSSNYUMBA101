/**
 * WorkforcePage — owner-portal surface for Piece M
 * (`@bossnyumba/workforce-orchestrator`).
 *
 * Surfaces:
 *   - Assignments table (who is doing what)
 *   - Follow-ups queue (escalations + check-ins)
 *   - Performance signals (per-role aggregate KPIs)
 *
 * Until the orchestrator's API client lands, we render a 3-tab shell
 * with skeleton tables. Critically: tabs reuse the design-system
 * `Tabs` component so the layout is finalised before the data wires.
 *
 * TODO(wave3-int5):
 *   - `useWorkforceAssignments()` -> list of (assignee, task, due)
 *   - `useFollowUpsQueue()` -> queue of nudges + check-in calls
 *   - `usePerformanceSignals()` -> per-role rollups
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Users,
  AlarmClock,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { Skeleton, EmptyState } from '@bossnyumba/design-system';
import { useFeatureFlag } from '../../lib/useFeatureFlag';

type WorkforceTab = 'assignments' | 'followups' | 'performance';

const TAB_META: ReadonlyArray<{
  readonly id: WorkforceTab;
  readonly icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'assignments', icon: Users },
  { id: 'followups', icon: AlarmClock },
  { id: 'performance', icon: TrendingUp },
];

export function WorkforcePage(): JSX.Element {
  const t = useTranslations('workforce');
  const enabled = useFeatureFlag('workforce_enabled');
  const [tab, setTab] = useState<WorkforceTab>('assignments');

  if (!enabled) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          icon={<Sparkles className="h-10 w-10" />}
          title={t('disabledTitle')}
          description={t('disabledDescription')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">{t('subtitle')}</p>
      </header>
      <nav
        className="flex gap-2 border-b border-gray-200"
        role="tablist"
        aria-label={t('tablistLabel')}
      >
        {TAB_META.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            data-testid={`workforce-tab-${id}`}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
              tab === id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {t(`tabs.${id}`)}
          </button>
        ))}
      </nav>

      <section role="tabpanel" aria-labelledby={`workforce-tab-${tab}`}>
        {tab === 'assignments' ? <AssignmentsStub /> : null}
        {tab === 'followups' ? <FollowUpsStub /> : null}
        {tab === 'performance' ? <PerformanceStub /> : null}
      </section>
    </div>
  );
}

function AssignmentsStub(): JSX.Element {
  const t = useTranslations('workforce');
  return (
    <div data-testid="workforce-assignments" className="space-y-3">
      <Skeleton className="h-12 w-full" />
      <EmptyState
        icon={<Users className="h-10 w-10" />}
        title={t('assignments.emptyTitle')}
        description={t('assignments.emptyDescription')}
      />
    </div>
  );
}

function FollowUpsStub(): JSX.Element {
  const t = useTranslations('workforce');
  return (
    <div data-testid="workforce-followups" className="space-y-3">
      <Skeleton className="h-12 w-full" />
      <EmptyState
        icon={<AlarmClock className="h-10 w-10" />}
        title={t('followups.emptyTitle')}
        description={t('followups.emptyDescription')}
      />
    </div>
  );
}

function PerformanceStub(): JSX.Element {
  const t = useTranslations('workforce');
  return (
    <div data-testid="workforce-performance" className="space-y-3">
      <Skeleton className="h-12 w-full" />
      <EmptyState
        icon={<TrendingUp className="h-10 w-10" />}
        title={t('performance.emptyTitle')}
        description={t('performance.emptyDescription')}
      />
    </div>
  );
}

export default WorkforcePage;
