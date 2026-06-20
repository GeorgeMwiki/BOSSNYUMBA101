'use client';

/**
 * PersonaDriftClient — admin dashboard renderer (Phase D D7).
 *
 * Fetches `/api/v1/persona-drift/events` (DB scan of
 * `kernel_persona_drift_events`) every 60 s and renders:
 *
 *   - a table of the most recent breaches (timestamp, persona,
 *     severity, worst-dim, excerpt)
 *   - a bar chart of dim-breach counts over the last N days
 *
 * Production binds the endpoint to a router that paginates the table.
 * In the absence of a wired endpoint the client shows a friendly
 * "Awaiting first breach" empty state.
 */

import { useEffect, useMemo, useState } from 'react';

interface DriftEvent {
  readonly id: string;
  readonly personaId: string;
  readonly violationType: string;
  readonly excerpt: string;
  readonly severity: 'low' | 'medium' | 'high';
  readonly detectedAt: string;
  readonly worstDim?: string;
}

interface FetchState {
  readonly status: 'idle' | 'loading' | 'ok' | 'error' | 'unavailable';
  readonly events: ReadonlyArray<DriftEvent>;
  readonly error: string | null;
  readonly fetchedAt: number | null;
}

const POLL_INTERVAL_MS = 60_000;

function endpoint(): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.trim();
  const trimmed = base ? base.replace(/\/$/, '') : '';
  return `${trimmed}/api/v1/persona-drift/events`;
}

/**
 * The persona-drift READ endpoint is not yet mounted in the api-gateway
 * (only the cron writer exists). A 404 / 501 therefore means "backend not
 * wired" — a known deferred state — rather than a runtime failure. Exported
 * for unit-test coverage of the honest-degrade classification.
 */
export function isBackendUnavailableStatus(httpStatus: number): boolean {
  return httpStatus === 404 || httpStatus === 501;
}

export function PersonaDriftClient() {
  const [state, setState] = useState<FetchState>({
    status: 'idle',
    events: [],
    error: null,
    fetchedAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function fetchEvents() {
      try {
        setState((s) => ({ ...s, status: 'loading' }));
        const res = await fetch(endpoint(), { credentials: 'include' });
        // The read endpoint (GET /api/v1/persona-drift/events) is not yet
        // mounted in the api-gateway — only the cron *writer* exists. A 404
        // therefore means "backend not wired", not a runtime failure. Render
        // an honest "unavailable" notice instead of a scary error box (which
        // would otherwise re-appear every poll interval).
        if (isBackendUnavailableStatus(res.status)) {
          if (cancelled) return;
          setState((s) => ({ ...s, status: 'unavailable', error: null }));
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { data?: ReadonlyArray<DriftEvent> };
        if (cancelled) return;
        setState({
          status: 'ok',
          events: data.data ?? [],
          error: null,
          fetchedAt: Date.now(),
        });
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    }
    void fetchEvents();
    const id = setInterval(fetchEvents, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const chartData = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of state.events) {
      const day = e.detectedAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, count]) => ({ day, count }));
  }, [state.events]);

  if (state.status === 'unavailable') {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Persona-drift read endpoint not yet wired.</p>
        <p className="mt-1">
          The cron supervisor already <em>writes</em> breaches to{' '}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            kernel_persona_drift_events
          </code>
          , but the read route{' '}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            GET /api/v1/persona-drift/events
          </code>{' '}
          is not mounted in the api-gateway. This dashboard stays
          unavailable until that endpoint lands — no sample data is shown.
        </p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        Failed to load persona-drift events: {state.error}
      </div>
    );
  }

  if (state.status === 'ok' && state.events.length === 0) {
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-700">
        Awaiting first breach. The persona-drift cron emits one event per
        (tenant, persona, day) when the 24-dim probe exceeds threshold.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          Breach counts by day
        </h2>
        <div className="flex h-32 items-end gap-2 rounded-md border border-slate-200 bg-white p-3">
          {chartData.map((bar) => {
            const maxCount = Math.max(...chartData.map((d) => d.count), 1);
            const heightPct = (bar.count / maxCount) * 100;
            return (
              <div
                key={bar.day}
                className="flex flex-col items-center gap-1"
                title={`${bar.day}: ${bar.count}`}
              >
                <div
                  className="w-6 rounded-t-sm bg-indigo-500"
                  style={{ height: `${heightPct}%` }}
                />
                <span className="text-[10px] text-slate-500">
                  {bar.day.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          Recent breaches
        </h2>
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Persona</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Worst dim</th>
                <th className="px-3 py-2">Excerpt</th>
              </tr>
            </thead>
            <tbody>
              {state.events.slice(0, 50).map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-600">{e.detectedAt}</td>
                  <td className="px-3 py-2">{e.personaId}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        e.severity === 'high'
                          ? 'rounded bg-red-100 px-2 py-0.5 text-red-700'
                          : e.severity === 'medium'
                            ? 'rounded bg-amber-100 px-2 py-0.5 text-amber-700'
                            : 'rounded bg-slate-100 px-2 py-0.5 text-slate-700'
                      }
                    >
                      {e.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {e.worstDim ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{e.excerpt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
