'use client';

/**
 * /coworker/training/scenarios — scenario-simulation surface (gap 9).
 *
 * Lists the tenant's estate rehearsal scenarios (arrears negotiation,
 * lease-compliance interview, maintenance-incident triage, move-out
 * inspection, tenant dispute) and runs an interactive session against the
 * gateway's /api/v1/scenarios/* routes via the api-client.
 *
 * Admin-locked role-mode deep-link: a `?roleMode=<mode>` query param requests
 * a specific junior sub-persona to rehearse as. The SERVER validates it
 * against the scenario kind's allowlist (a client cannot self-grant a mode);
 * here we only narrow it to the known allowlist before forwarding and surface
 * the lock as a banner. The server rejects a mismatch with FORBIDDEN_ROLE_MODE,
 * which the workspace renders as a graceful, recoverable state.
 *
 * HONEST-DEGRADE: all scenario content is fetched; a 503 or `degraded: true`
 * response yields an empty / unavailable state — never fabricated content.
 */

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { ScenarioView, ScenarioRoleMode } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  ScenarioBrowser,
  ScenarioWorkspace,
  TrainingProvider,
  TrainingNav,
  toTrainingLanguage,
  ROLE_MODES,
  roleModeLabelKey,
} from '@/features/training';

/** Narrow a raw query value to a known role-mode (server is authoritative). */
function parseRoleMode(raw: string | null): ScenarioRoleMode | null {
  if (!raw) return null;
  return (ROLE_MODES as readonly string[]).includes(raw)
    ? (raw as ScenarioRoleMode)
    : null;
}

function ScenarioSimulationFallback() {
  const t = useTranslations('training');
  return <PageHeader title={t('scenariosTitle')} subtitle={t('scenariosSubtitle')} showBack />;
}

export default function ScenarioSimulationPage() {
  return (
    <Suspense fallback={<ScenarioSimulationFallback />}>
      <ScenarioSimulationPageInner />
    </Suspense>
  );
}

function ScenarioSimulationPageInner() {
  const t = useTranslations('training');
  const locale = useLocale();
  const language = toTrainingLanguage(locale);
  const searchParams = useSearchParams();
  const deepLinkRoleMode = useMemo(
    () => parseRoleMode(searchParams?.get('roleMode') ?? null),
    [searchParams],
  );

  const [active, setActive] = useState<ScenarioView | null>(null);

  const lockedRoleModeLabel = deepLinkRoleMode
    ? t(roleModeLabelKey(deepLinkRoleMode))
    : null;

  return (
    <>
      <PageHeader title={t('scenariosTitle')} subtitle={t('scenariosSubtitle')} showBack />

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-4">
        <TrainingNav />

        <TrainingProvider language={language} genericErrorMessage={t('genericError')}>
          {active ? (
            <ScenarioWorkspace
              scenario={active}
              roleMode={deepLinkRoleMode}
              language={language}
              onExit={() => setActive(null)}
            />
          ) : (
            <ScenarioBrowser
              language={language}
              onSelect={setActive}
              lockedRoleModeLabel={lockedRoleModeLabel}
            />
          )}
        </TrainingProvider>
      </div>
    </>
  );
}
