/**
 * Workflow catalog + run dashboard — Wave 15 UI gap closure.
 *
 *   GET  /api/v1/workflows         — available definitions
 *   POST /api/v1/workflows/run     — start a run
 *   GET  /api/v1/workflows/:runId  — inspect a run
 *   POST /api/v1/workflows/:runId/advance — approve / reject a step
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Workflow, Play, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface WorkflowDef {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly description?: string;
  readonly stepCount: number;
  readonly defaultRoles?: readonly string[];
}

interface WorkflowRun {
  readonly id: string;
  readonly workflowId: string;
  readonly status: 'running' | 'awaiting_human' | 'completed' | 'failed';
  readonly currentStep?: string;
  readonly startedAt: string;
  readonly steps?: readonly {
    readonly id: string;
    readonly status: string;
    readonly startedAt: string;
    readonly endedAt?: string;
  }[];
}

export default function WorkflowsPage(): JSX.Element {
  const [defs, setDefs] = useState<readonly WorkflowDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [inspect, setInspect] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<readonly WorkflowDef[]>('/workflows');
    if (res.success && res.data) setDefs(res.data);
    else setError(res.error ?? 'Unable to load workflows.');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function start(def: WorkflowDef): Promise<void> {
    const res = await api.post<WorkflowRun>('/workflows/run', {
      workflowId: def.id,
      input: {},
    });
    if (res.success && res.data) {
      setRun(res.data);
    } else {
      setError(res.error ?? 'Workflow run failed.');
    }
  }

  async function fetchRun(): Promise<void> {
    if (!inspect) return;
    const res = await api.get<WorkflowRun>(
      `/workflows/${encodeURIComponent(inspect)}`,
    );
    if (res.success && res.data) setRun(res.data);
    else setError(res.error ?? 'Run lookup failed.');
  }

  async function advance(approve: boolean): Promise<void> {
    if (!run) return;
    const res = await api.post<WorkflowRun>(
      `/workflows/${encodeURIComponent(run.id)}/advance`,
      { approve, reason: approve ? 'approved via admin portal' : 'rejected' },
    );
    if (res.success && res.data) setRun(res.data);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Workflow className="h-6 w-6 text-sky-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Workflows</h2>
          <p className="text-sm text-gray-500">
            Orchestrated multi-step automations with human approval gates.
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {defs.map((d) => (
            <div
              key={d.id}
              className="bg-white border border-gray-200 rounded-xl p-4 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{d.name}</p>
                  <p className="text-xs text-gray-500">
                    {d.id} v{d.version} · {d.stepCount} steps
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void start(d)}
                  className="rounded bg-sky-600 text-white px-3 py-1 text-xs inline-flex items-center gap-1"
                >
                  <Play className="h-3 w-3" /> run
                </button>
              </div>
              {d.description && (
                <p className="text-sm text-gray-600">{d.description}</p>
              )}
              {d.defaultRoles && d.defaultRoles.length > 0 && (
                <p className="text-xs text-gray-400">
                  Roles: {d.defaultRoles.join(', ')}
                </p>
              )}
            </div>
          ))}
          {defs.length === 0 && (
            <p className="text-sm text-gray-500">No workflow definitions registered.</p>
          )}
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 max-w-xl">
        <h3 className="font-semibold text-gray-900">Inspect run</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={inspect}
            onChange={(e) => setInspect(e.target.value)}
            placeholder="Run ID"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void fetchRun()}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Fetch
          </button>
        </div>
      </section>

      {run && (
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm space-y-2">
          <p className="font-semibold text-gray-900">
            Run {run.id} · {run.workflowId}
          </p>
          <p className="text-gray-600">
            Status: <span className="font-medium">{run.status}</span>
            {run.currentStep ? ` · step: ${run.currentStep}` : ''}
          </p>
          {run.status === 'awaiting_human' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void advance(true)}
                className="rounded bg-emerald-600 text-white px-4 py-2 text-xs"
              >
                Approve step
              </button>
              <button
                type="button"
                onClick={() => void advance(false)}
                className="rounded bg-red-600 text-white px-4 py-2 text-xs"
              >
                Reject step
              </button>
            </div>
          )}
          {run.steps && run.steps.length > 0 && (
            <ul className="mt-2 space-y-1">
              {run.steps.map((s) => (
                <li key={s.id} className="text-xs text-gray-600">
                  {s.id} → {s.status} ({s.startedAt}
                  {s.endedAt ? ` → ${s.endedAt}` : ''})
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
