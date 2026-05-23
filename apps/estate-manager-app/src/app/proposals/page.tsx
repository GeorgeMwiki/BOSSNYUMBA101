'use client';

/**
 * Estate Manager — module-update proposals review.
 *
 * Piece B's `module_update_proposals` table holds pending changes the
 * orchestrator wants the manager (or a 4-eye delegate) to approve. This
 * page lists them with inline approve / reject affordances. Decisions
 * route to `moduleOrchestratorService.respondToProposal()`.
 *
 * For this branch the list is empty because the orchestrator's
 * api-client port has not landed; the page exists so the routing +
 * layout are validated and operators can preview the surface.
 *
 * TODO(wave3-int5):
 *   - `useModuleUpdateProposals({ status: 'pending' })`
 *   - `useApproveProposal(id)` + `useRejectProposal(id, reason)`
 *   - Render the spec diff via genui's `DiffView` once embedded.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardCheck, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { isFeatureEnabled } from '@/lib/featureFlags';

interface ProposalRow {
  readonly id: string;
  readonly moduleName: string;
  readonly summary: string;
  readonly proposedAt: string;
}

function useProposalsStub(): { data: ReadonlyArray<ProposalRow>; isLoading: boolean } {
  return useMemo(() => ({ data: [], isLoading: false }), []);
}

export default function ManagerProposalsPage() {
  const t = useTranslations('managerProposals');
  const enabled = isFeatureEnabled('module_proposals_enabled');
  const { data } = useProposalsStub();

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
            data-testid="manager-proposals-empty"
            className="rounded-xl border border-dashed border-gray-700 bg-gray-900/20 p-8 text-center"
          >
            <ClipboardCheck className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-3 text-sm font-medium">{t('emptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('emptyDescription')}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.map((proposal) => (
              <li
                key={proposal.id}
                data-testid="manager-proposal-row"
                data-proposal-id={proposal.id}
                className="rounded-xl border border-gray-700 bg-gray-900/40 p-4"
              >
                <p className="text-sm font-semibold">{proposal.moduleName}</p>
                <p className="text-xs text-muted-foreground">{proposal.summary}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {proposal.proposedAt}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    data-testid={`proposal-approve-${proposal.id}`}
                    className="text-xs px-3 py-1 rounded-md bg-amber-500 text-gray-900 font-medium"
                  >
                    {t('approve')}
                  </button>
                  <button
                    type="button"
                    data-testid={`proposal-reject-${proposal.id}`}
                    className="text-xs px-3 py-1 rounded-md border border-gray-700 text-muted-foreground"
                  >
                    {t('reject')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
