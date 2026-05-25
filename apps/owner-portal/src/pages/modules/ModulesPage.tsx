/**
 * ModulesPage — owner-portal admin surface for Piece B
 * (`@bossnyumba/module-orchestrator` + `@bossnyumba/module-spec-engine`).
 *
 * Owners with platform-admin tier can:
 *   - Browse running modules
 *   - Spawn new module proposals (the orchestrator runs a 4-eye check)
 *   - Inspect module specs / lineage
 *
 * Page is HQ-tier sovereign — RLS server-side gates anyway, but the
 * `modules_admin_enabled` flag adds a UI gate so the navigation entry
 * stays hidden for non-admins.
 *
 * TODO(wave3-int5):
 *   - `useModules()` -> list with status (proposed | running | retired)
 *   - `useSpawnModule(spec)` -> 4-eye mutation
 *   - render module spec in DiffView when comparing versions
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Boxes, PlusCircle, Sparkles } from 'lucide-react';
import { Button, Skeleton, EmptyState } from '@bossnyumba/design-system';
import { useFeatureFlag } from '../../lib/useFeatureFlag';

interface ModuleSummary {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly status: 'proposed' | 'running' | 'retired';
}

function useModulesStub(): { data: ReadonlyArray<ModuleSummary>; isLoading: boolean } {
  return useMemo(() => ({ data: [], isLoading: false }), []);
}

export function ModulesPage(): JSX.Element {
  const t = useTranslations('modules');
  const enabled = useFeatureFlag('modules_admin_enabled');
  const { data, isLoading } = useModulesStub();
  const [showSpawn, setShowSpawn] = useState(false);

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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <Button
          variant="default"
          onClick={() => setShowSpawn(true)}
          data-testid="modules-spawn-button"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('spawnButton')}
        </Button>
      </header>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-10 w-10" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.map((module) => (
            <li
              key={module.id}
              data-testid="module-card"
              data-module-id={module.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <p className="font-semibold text-gray-900">{module.name}</p>
              <p className="text-xs text-gray-500">
                v{module.version} · {t(`status.${module.status}`)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {showSpawn ? (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="modules-spawn-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('spawnDialogTitle')}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {t('spawnDialogPlaceholder')}
            </p>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowSpawn(false)}>
                {t('close')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ModulesPage;
