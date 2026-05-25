import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, Plus, MessageSquare, CheckCircle2, XCircle } from 'lucide-react';
import { PlanTree, type PlanItem, type PlanTreeAction, type MdrPlanHorizon } from '../../components/PlanTree';
import { MissingBackendNotice } from '../../components/MissingBackendNotice';

/**
 * /plan — MDR plan tree page.
 *
 * Surfaces the MD's proposed/active plan items across all 5 horizons.
 * The owner can accept / reject / pause / resume / complete / add sub-
 * items. "Propose new item" opens the Jarvis console with the prompt
 * pre-filled. Bulk accept/reject for the proposed inbox is one click.
 *
 * Until the brain wires the `/api/v1/owner/plan/items` endpoint we show
 * a small sample tree so the route renders end-to-end. When the gateway
 * returns 503 (live-data-required), we surface `MissingBackendNotice`.
 */

const ENDPOINT = '/api/v1/owner/plan/items';

const SAMPLE_PLAN: ReadonlyArray<PlanItem> = [
  {
    id: 'a1',
    parentId: null,
    horizon: 'annual',
    title: '2026 portfolio NOI target +12%',
    description: 'Lift portfolio net operating income vs. 2025 baseline.',
    status: 'active',
    proposedBy: 'md',
    startDate: '2026-01-01',
    dueDate: '2026-12-31',
  },
  {
    id: 'q1',
    parentId: 'a1',
    horizon: 'quarterly',
    title: 'Q2 — reduce arrears under-30d by 35%',
    status: 'active',
    proposedBy: 'md',
    dueDate: '2026-06-30',
  },
  {
    id: 'm1',
    parentId: 'q1',
    horizon: 'monthly',
    title: 'May — call top-10 arrears tenants',
    status: 'proposed',
    proposedBy: 'md',
    dueDate: '2026-05-31',
  },
  {
    id: 'w1',
    parentId: 'm1',
    horizon: 'weekly',
    title: 'Week 21 — KRA filing dry-run',
    status: 'active',
    proposedBy: 'md',
    dueDate: '2026-05-24',
  },
  {
    id: 'd1',
    parentId: 'w1',
    horizon: 'daily',
    title: 'Today — review Mwikila digest',
    status: 'done',
    proposedBy: 'owner',
  },
  {
    id: 'a2',
    parentId: null,
    horizon: 'annual',
    title: 'Onboard 3 new estates',
    status: 'proposed',
    proposedBy: 'md',
    dueDate: '2026-12-31',
  },
];

interface PlanApiState {
  readonly status: 'loading' | 'ok' | 'missing' | 'fallback';
  readonly items: ReadonlyArray<PlanItem>;
}

export default function PlanPage(): JSX.Element {
  const t = useTranslations('p89.plan');
  const [state, setState] = useState<PlanApiState>({ status: 'loading', items: [] });
  const [horizonFilter, setHorizonFilter] = useState<MdrPlanHorizon | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch(ENDPOINT, { credentials: 'include' });
        if (cancelled) return;
        if (res.status === 503) {
          setState({ status: 'missing', items: [] });
          return;
        }
        if (!res.ok) {
          setState({ status: 'fallback', items: SAMPLE_PLAN });
          return;
        }
        const body = (await res.json()) as { items?: ReadonlyArray<PlanItem> };
        setState({ status: 'ok', items: body.items ?? [] });
      } catch {
        if (!cancelled) setState({ status: 'fallback', items: SAMPLE_PLAN });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const proposed = useMemo(
    () => state.items.filter((i) => i.status === 'proposed'),
    [state.items],
  );

  function dispatchAction(a: PlanTreeAction): void {
    // Stub: in the live path this POSTs to a per-action endpoint and
    // optimistically updates the tree. Locally we just log and update.
    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        if (it.id !== a.itemId) return it;
        switch (a.kind) {
          case 'accept':
            return { ...it, status: 'active' as const };
          case 'reject':
            return { ...it, status: 'cancelled' as const };
          case 'pause':
            return { ...it, status: 'paused' as const };
          case 'resume':
            return { ...it, status: 'active' as const };
          case 'complete':
            return { ...it, status: 'done' as const };
          case 'propose-child':
            return it;
          default:
            return it;
        }
      }),
    }));
    if (a.kind === 'propose-child') {
      // Forward to Jarvis with a pre-filled prompt.
      openInJarvis(`Propose a sub-item under plan item ${a.itemId}.`);
    }
  }

  function openInJarvis(prompt: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(
        new CustomEvent('owner-portal:jarvis-prefill', {
          detail: { prompt, autoSubmit: false },
        }),
      );
    } catch {
      /* ignore */
    }
  }

  function bulkAccept(): void {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.status === 'proposed' ? { ...it, status: 'active' as const } : it,
      ),
    }));
  }

  function bulkReject(): void {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.status === 'proposed' ? { ...it, status: 'cancelled' as const } : it,
      ),
    }));
  }

  if (state.status === 'missing') {
    return (
      <MissingBackendNotice
        title={t('mdrTitle')}
        endpoint={ENDPOINT}
        description="The MDR plan endpoint has not been wired in api-gateway yet."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Calendar className="h-6 w-6 text-indigo-600" />
            Plan
          </h1>
          <p className="text-sm text-gray-500">
            Mr. Mwikila's plan for your portfolio. Annual → quarterly → monthly →
            weekly → daily. Accept, edit, or reject any item — the MD adapts.
          </p>
          {state.status === 'fallback' ? (
            <p className="mt-1 text-xs text-amber-700">
              Plan API not yet wired. Showing a sample plan tree.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openInJarvis('Propose a new plan item for me to review.')}
            className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Propose new item
          </button>
          <button
            type="button"
            onClick={() => openInJarvis('Walk me through the plan and what we should change.')}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
          >
            <MessageSquare className="h-4 w-4" /> Discuss with MD
          </button>
        </div>
      </header>

      {proposed.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-amber-900">
                {proposed.length} proposed item{proposed.length === 1 ? '' : 's'}{' '}
                awaiting your decision
              </div>
              <div className="text-xs text-amber-800">
                Bulk-act on every proposed item below.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={bulkAccept}
                className="inline-flex items-center gap-1 rounded border border-emerald-400 bg-emerald-100 px-2 py-1 text-xs text-emerald-900"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Accept all
              </button>
              <button
                type="button"
                onClick={bulkReject}
                className="inline-flex items-center gap-1 rounded border border-red-400 bg-red-100 px-2 py-1 text-xs text-red-900"
              >
                <XCircle className="h-3.5 w-3.5" /> Reject all
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">Horizon:</span>
          {(['all', 'annual', 'quarterly', 'monthly', 'weekly', 'daily'] as const).map(
            (h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizonFilter(h)}
                className={`rounded-full px-2 py-0.5 ${
                  horizonFilter === h
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 border border-gray-200'
                }`}
              >
                {h}
              </button>
            ),
          )}
        </div>
        <PlanTree items={state.items} horizonFilter={horizonFilter} onAction={dispatchAction} />
      </section>
    </div>
  );
}
