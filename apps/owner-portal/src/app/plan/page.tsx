import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, Plus, MessageSquare, CheckCircle2, XCircle } from 'lucide-react';
import { PlanTree, type PlanItem, type PlanTreeAction, type MdrPlanHorizon } from '../../components/PlanTree';
import { MissingBackendNotice } from '../../components/MissingBackendNotice';
import { api } from '../../lib/api';

/**
 * /plan — MDR plan tree page.
 *
 * Surfaces the MD's proposed/active plan items across all 5 horizons.
 * The owner can accept / reject / pause / resume / complete / add sub-
 * items. "Propose new item" opens the Jarvis console with the prompt
 * pre-filled. Bulk accept/reject for the proposed inbox is one click.
 *
 * Backed by `/api/v1/owner/plan/*` (plan.hono.ts). The base URL +
 * `/api/v1` prefix + bearer are handled by `lib/api` (VITE_API_URL).
 * Every action POSTs/PATCHes to the gateway and reconciles the tree from
 * the returned row — there is no sample fallback. When the gateway is
 * unreachable / unconfigured (503) we surface `MissingBackendNotice`.
 */

const LIST_ENDPOINT = '/owner/plan/items';
const PUBLIC_ENDPOINT = '/api/v1/owner/plan/items';

const ACTION_PATH: Record<
  Exclude<PlanTreeAction['kind'], 'propose-child'>,
  string
> = {
  accept: 'accept',
  reject: 'reject',
  pause: 'pause',
  resume: 'resume',
  complete: 'complete',
};

interface PlanListResponse {
  readonly success?: boolean;
  readonly items?: ReadonlyArray<PlanItem>;
}

interface PlanItemResponse {
  readonly success?: boolean;
  readonly item?: PlanItem;
}

interface PlanApiState {
  readonly status: 'loading' | 'ok' | 'missing';
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
        const res = (await api.get<unknown>(LIST_ENDPOINT)) as PlanListResponse;
        if (cancelled) return;
        setState({ status: 'ok', items: res.items ?? [] });
      } catch {
        // Gateway unreachable / 503 / unconfigured — no sample fallback.
        if (!cancelled) setState({ status: 'missing', items: [] });
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

  function replaceItem(updated: PlanItem): void {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === updated.id ? updated : it)),
    }));
  }

  async function dispatchAction(a: PlanTreeAction): Promise<void> {
    if (a.kind === 'propose-child') {
      openInJarvis(`Propose a sub-item under plan item ${a.itemId}.`);
      return;
    }
    try {
      const res = (await api.patch<unknown>(
        `${LIST_ENDPOINT}/${a.itemId}/${ACTION_PATH[a.kind]}`,
      )) as PlanItemResponse;
      if (res.item) replaceItem(res.item);
    } catch (error) {
      // Surface the failure without mutating local state so the tree
      // stays consistent with the server.
      console.error('Plan action failed:', error);
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

  async function bulkAct(kind: 'accept' | 'reject'): Promise<void> {
    const targets = state.items.filter((i) => i.status === 'proposed');
    const results = await Promise.allSettled(
      targets.map((it) =>
        api.patch<unknown>(`${LIST_ENDPOINT}/${it.id}/${ACTION_PATH[kind]}`),
      ),
    );
    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        const idx = targets.findIndex((t2) => t2.id === it.id);
        if (idx === -1) return it;
        const settled = results[idx];
        if (settled.status !== 'fulfilled') return it;
        const item = (settled.value as PlanItemResponse).item;
        return item ?? it;
      }),
    }));
  }

  if (state.status === 'missing') {
    return (
      <MissingBackendNotice
        title={t('mdrTitle')}
        endpoint={PUBLIC_ENDPOINT}
        description="The MDR plan endpoint is unreachable. Confirm the api-gateway is running and VITE_API_URL is configured."
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
                onClick={() => void bulkAct('accept')}
                className="inline-flex items-center gap-1 rounded border border-emerald-400 bg-emerald-100 px-2 py-1 text-xs text-emerald-900"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Accept all
              </button>
              <button
                type="button"
                onClick={() => void bulkAct('reject')}
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
        <PlanTree
          items={state.items}
          horizonFilter={horizonFilter}
          onAction={(a) => void dispatchAction(a)}
        />
      </section>
    </div>
  );
}
