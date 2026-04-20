/**
 * Organisation insights — Wave 15 UI gap closure.
 *
 *   GET /api/v1/org/bottlenecks
 *   GET /api/v1/org/improvements
 *   GET /api/v1/org/process-stats/:kind
 */

import React, { useCallback, useEffect, useState } from 'react';
import { TrendingUp, Loader2, AlertOctagon } from 'lucide-react';
import { api } from '../lib/api';

interface Bottleneck {
  readonly id: string;
  readonly kind: string;
  readonly severity: 'info' | 'warn' | 'critical';
  readonly title: string;
  readonly description: string;
  readonly detectedAt: string;
}

interface ImprovementRow {
  readonly metric: string;
  readonly baseline: number;
  readonly current: number;
  readonly delta: number;
  readonly direction: 'up' | 'down' | 'flat';
}

interface Improvements {
  readonly windowDays: number;
  readonly rows: readonly ImprovementRow[];
}

interface ProcessStats {
  readonly kind: string;
  readonly total: number;
  readonly avgDurationMs: number;
  readonly p95DurationMs: number;
  readonly slaBreachCount: number;
}

const PROCESS_KINDS = ['rent_collection', 'maintenance_resolution', 'lease_renewal'] as const;

export default function OrgInsights(): JSX.Element {
  const [bottlenecks, setBottlenecks] = useState<readonly Bottleneck[]>([]);
  const [improvements, setImprovements] = useState<Improvements | null>(null);
  const [statsByKind, setStatsByKind] = useState<Record<string, ProcessStats | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, imp] = await Promise.all([
      api.get<readonly Bottleneck[]>('/org/bottlenecks'),
      api.get<Improvements>('/org/improvements'),
    ]);
    if (b.success && b.data) setBottlenecks(b.data);
    else if (!b.success) setError(b.error ?? 'Org service unavailable.');
    if (imp.success && imp.data) setImprovements(imp.data);

    const stats: Record<string, ProcessStats | null> = {};
    for (const kind of PROCESS_KINDS) {
      const res = await api.get<ProcessStats>(`/org/process-stats/${kind}`);
      stats[kind] = res.success && res.data ? res.data : null;
    }
    setStatsByKind(stats);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-violet-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Organisation insights</h2>
          <p className="text-sm text-gray-500">
            Bottlenecks, improvements, and process performance.
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
        <>
          <section>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-amber-500" />
              Current bottlenecks ({bottlenecks.length})
            </h3>
            {bottlenecks.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500">
                No bottlenecks detected.
              </div>
            ) : (
              <ul className="space-y-2">
                {bottlenecks.map((b) => (
                  <li
                    key={b.id}
                    className={`rounded-xl border p-4 text-sm ${
                      b.severity === 'critical'
                        ? 'bg-red-50 border-red-200'
                        : b.severity === 'warn'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-white border-gray-200'
                    }`}
                  >
                    <p className="font-medium">{b.title}</p>
                    <p className="text-gray-600">{b.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {b.kind} · {new Date(b.detectedAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {improvements && (
            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-3">
                Improvements (last {improvements.windowDays}d)
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-2">Metric</th>
                    <th>Baseline</th>
                    <th>Current</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {improvements.rows.map((r) => (
                    <tr key={r.metric} className="border-t border-gray-100">
                      <td className="py-2 font-medium">{r.metric}</td>
                      <td>{r.baseline}</td>
                      <td>{r.current}</td>
                      <td
                        className={
                          r.direction === 'up'
                            ? 'text-emerald-600'
                            : r.direction === 'down'
                              ? 'text-red-600'
                              : 'text-gray-600'
                        }
                      >
                        {r.delta > 0 ? '+' : ''}
                        {r.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="grid gap-3 md:grid-cols-3">
            {PROCESS_KINDS.map((kind) => {
              const s = statsByKind[kind];
              return (
                <div
                  key={kind}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <p className="text-xs text-gray-500">{kind}</p>
                  {s ? (
                    <>
                      <p className="text-2xl font-semibold mt-1">{s.total}</p>
                      <p className="text-xs text-gray-500">
                        avg {Math.round(s.avgDurationMs / 1000)}s · p95{' '}
                        {Math.round(s.p95DurationMs / 1000)}s
                      </p>
                      {s.slaBreachCount > 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          {s.slaBreachCount} SLA breaches
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">No data.</p>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
