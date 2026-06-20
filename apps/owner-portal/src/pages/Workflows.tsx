/**
 * Workflow run dashboard — wired to the SINGULAR persistent engine
 * (`/api/v1/workflow`, backed by `@bossnyumba/workflow-engine`). The
 * legacy plural `/workflows` mount (in-memory, lost runs on restart) is
 * gone; this surface uses the four-eyes contract:
 *
 *   POST /workflow/runs                 — start a run
 *   GET  /workflow/runs/my-queue        — caller's open runs
 *   GET  /workflow/runs/:id             — inspect a run
 *   POST /workflow/runs/:id/approve     — human approver path
 *   POST /workflow/runs/:id/reject      — reject pre-commit
 *
 * Borjie admin-web's workflow-engine surface is the reference contract.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Workflow, Play, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api } from '../lib/api';

/**
 * The launchable workflow definitions are the engine's built-in set
 * (`@bossnyumba/workflow-engine/definitions`). There is no list endpoint
 * on the singular engine, so the catalog is mirrored here as static
 * descriptors used only to seed the start form's definition picker.
 */
interface WorkflowDef {
  readonly id: string;
  readonly name: string;
}

const WORKFLOW_DEFS: readonly WorkflowDef[] = [
  { id: 'parcel_edit_v1', name: 'Parcel edit' },
  { id: 'polygon_draw_v1', name: 'Polygon draw / redraw' },
  { id: 'metadata_update_v1', name: 'Metadata update' },
  { id: 'photo_add_v1', name: 'Photo upload' },
  { id: 'inspection_v1', name: 'Inspection completion' },
  { id: 'new_lease_v1', name: 'New lease draft' },
  { id: 'maintenance_completion_v1', name: 'Maintenance completion' },
  { id: 'document_upload_v1', name: 'Document upload' },
  { id: 'po_approval_v1', name: 'Purchase-order approval' },
  { id: 'requisition_submission_v1', name: 'Requisition submission' },
];

type WorkflowRunState =
  | 'open'
  | 'in_progress'
  | 'in_review'
  | 'in_approval'
  | 'committed'
  | 'rejected'
  | 'cancelled';

interface WorkflowRun {
  readonly id: string;
  readonly definitionId: string;
  readonly scope: string;
  readonly scopeRef: string;
  readonly state: WorkflowRunState;
  readonly rejectionReason?: string | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export default function WorkflowsPage(): JSX.Element {
  const t = useTranslations('workflows');
  const [queue, setQueue] = useState<readonly WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [inspect, setInspect] = useState('');

  // Start-run form state — the engine requires definitionId + scope +
  // scopeRef; the legacy { workflowId, input } shape is gone.
  const [definitionId, setDefinitionId] = useState<string>(
    WORKFLOW_DEFS[0]?.id ?? '',
  );
  const [scope, setScope] = useState('');
  const [scopeRef, setScopeRef] = useState('');

  // Approver-decision form state — approve needs approverRole + rationale;
  // reject needs a reason.
  const [approverRole, setApproverRole] = useState('');
  const [rationale, setRationale] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<readonly WorkflowRun[]>('/workflow/runs/my-queue');
    if (res.success && res.data) setQueue(res.data);
    else setError(res.error?.message ?? t('errorLoad'));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function start(): Promise<void> {
    if (!definitionId || !scope || !scopeRef) return;
    setError(null);
    const res = await api.post<WorkflowRun>('/workflow/runs', {
      definitionId,
      scope,
      scopeRef,
      input: {},
    });
    if (res.success && res.data) {
      setRun(res.data);
      void load();
    } else {
      setError(res.error?.message ?? t('errorRun'));
    }
  }

  async function fetchRun(): Promise<void> {
    if (!inspect) return;
    setError(null);
    const res = await api.get<WorkflowRun>(
      `/workflow/runs/${encodeURIComponent(inspect)}`,
    );
    if (res.success && res.data) setRun(res.data);
    else setError(res.error?.message ?? t('errorLookup'));
  }

  async function approve(): Promise<void> {
    if (!run || !approverRole || !rationale) return;
    setError(null);
    const res = await api.post<WorkflowRun>(
      `/workflow/runs/${encodeURIComponent(run.id)}/approve`,
      { approverRole, rationale },
    );
    if (res.success && res.data) {
      setRun(res.data);
      void load();
    } else {
      setError(res.error?.message ?? t('errorApprove'));
    }
  }

  async function reject(): Promise<void> {
    if (!run || !rejectReason) return;
    setError(null);
    const res = await api.post<WorkflowRun>(
      `/workflow/runs/${encodeURIComponent(run.id)}/reject`,
      { reason: rejectReason },
    );
    if (res.success && res.data) {
      setRun(res.data);
      void load();
    } else {
      setError(res.error?.message ?? t('errorReject'));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Workflow className="h-6 w-6 text-sky-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
      </header>

      {error && (
        <div role="alert" aria-live="assertive" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 max-w-xl">
        <h3 className="font-semibold text-gray-900">{t('startTitle')}</h3>
        <div className="space-y-2">
          <label className="block text-xs text-gray-500" htmlFor="wf-def">
            {t('definitionLabel')}
          </label>
          <select
            id="wf-def"
            value={definitionId}
            onChange={(e) => setDefinitionId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {WORKFLOW_DEFS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.id}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder={t('scopePlaceholder')}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={scopeRef}
              onChange={(e) => setScopeRef(e.target.value)}
              placeholder={t('scopeRefPlaceholder')}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void start()}
            disabled={!definitionId || !scope || !scopeRef}
            className="rounded bg-sky-600 text-white px-3 py-2 text-xs inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Play className="h-3 w-3" /> {t('runCta')}
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-gray-900">{t('queueTitle')}</h3>
        {loading ? (
          <div role="status" aria-live="polite" className="text-sm text-gray-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t('loading')}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {queue.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRun(r)}
                className="text-left bg-white border border-gray-200 rounded-xl p-4 space-y-1 hover:border-sky-300"
              >
                <p className="font-semibold text-gray-900">{r.definitionId}</p>
                <p className="text-xs text-gray-500">
                  {r.scope}:{r.scopeRef}
                </p>
                <p className="text-xs text-gray-500">
                  {t('statusLabel')}:{' '}
                  <span className="font-medium">{t(`state.${r.state}`)}</span>
                </p>
              </button>
            ))}
            {queue.length === 0 && (
              <p className="text-sm text-gray-500">{t('emptyQueue')}</p>
            )}
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 max-w-xl">
        <h3 className="font-semibold text-gray-900">{t('inspectTitle')}</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={inspect}
            onChange={(e) => setInspect(e.target.value)}
            placeholder={t('runIdPlaceholder')}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void fetchRun()}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            {t('fetchCta')}
          </button>
        </div>
      </section>

      {run && (
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm space-y-2">
          <p className="font-semibold text-gray-900">
            {t('runHeader', { id: run.id, definitionId: run.definitionId })}
          </p>
          <p className="text-gray-600">
            {t('scopeLabel')}: <span className="font-medium">{run.scope}:{run.scopeRef}</span>
          </p>
          <p className="text-gray-600">
            {t('statusLabel')}:{' '}
            <span className="font-medium">{t(`state.${run.state}`)}</span>
          </p>
          {run.rejectionReason && (
            <p className="text-gray-600">
              {t('rejectionLabel')}: <span className="font-medium">{run.rejectionReason}</span>
            </p>
          )}

          {run.state === 'in_approval' && (
            <div className="space-y-3 pt-2 border-t border-gray-200">
              <div className="space-y-2">
                <input
                  type="text"
                  value={approverRole}
                  onChange={(e) => setApproverRole(e.target.value)}
                  placeholder={t('approverRolePlaceholder')}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder={t('rationalePlaceholder')}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  rows={2}
                />
                <button
                  type="button"
                  onClick={() => void approve()}
                  disabled={!approverRole || !rationale}
                  className="rounded bg-emerald-600 text-white px-4 py-2 text-xs disabled:opacity-50"
                >
                  {t('approveStep')}
                </button>
              </div>
              <div className="space-y-2">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('rejectReasonPlaceholder')}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  rows={2}
                />
                <button
                  type="button"
                  onClick={() => void reject()}
                  disabled={!rejectReason}
                  className="rounded bg-red-600 text-white px-4 py-2 text-xs disabled:opacity-50"
                >
                  {t('rejectStep')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
