/**
 * AI spend monitor — Wave 15 UI gap closure.
 *
 *   GET /api/v1/ai-costs/summary  — current-month totals + per-model breakdown
 *   GET /api/v1/ai-costs/entries  — recent LLM call entries
 *   GET /api/v1/ai-costs/budget   — monthly cap (null if unset)
 *   PUT /api/v1/ai-costs/budget   — admin sets cap
 *
 * The summary API returns USD-micro amounts (1e-6 USD). This page
 * formats them as dollars with two decimals.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Coins, Loader2, DollarSign, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

interface ModelBreakdownRow {
  readonly model: string;
  readonly calls: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly costUsdMicro: number;
}

interface Summary {
  readonly totalCostUsdMicro: number;
  readonly totalCalls: number;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly perModel: readonly ModelBreakdownRow[];
}

interface Budget {
  readonly monthlyCapUsdMicro: number;
  readonly hardStop: boolean;
  readonly updatedAt?: string;
}

interface SummaryResponse {
  readonly summary: Summary;
  readonly budget: Budget | null;
  readonly overBudget: boolean;
}

interface Entry {
  readonly id: string;
  readonly model: string;
  readonly costUsdMicro: number;
  readonly createdAt: string;
  readonly purpose?: string;
}

function dollars(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(2)}`;
}

export default function AiCosts(): JSX.Element {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftCap, setDraftCap] = useState('');
  const [hardStop, setHardStop] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, e] = await Promise.all([
      api.get<SummaryResponse>('/ai-costs/summary'),
      api.get<readonly Entry[]>('/ai-costs/entries'),
    ]);
    if (s.success && s.data) {
      setSummary(s.data);
      if (s.data.budget) {
        setDraftCap((s.data.budget.monthlyCapUsdMicro / 1_000_000).toString());
        setHardStop(s.data.budget.hardStop);
      }
    } else {
      setError(s.error ?? 'Unable to load summary.');
    }
    if (e.success && e.data) setEntries(e.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBudget(): Promise<void> {
    const capUsd = Number(draftCap);
    if (!Number.isFinite(capUsd) || capUsd < 0) {
      setError('Cap must be a non-negative number.');
      return;
    }
    const res = await api.put('/ai-costs/budget', {
      monthlyCapUsdMicro: Math.round(capUsd * 1_000_000),
      hardStop,
    });
    if (res.success) {
      void load();
    } else {
      setError(res.error ?? 'Failed to save budget.');
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading AI spend…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Coins className="h-6 w-6 text-amber-500" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">AI spend</h2>
          <p className="text-sm text-gray-500">
            Current-month usage, model mix, and monthly cap.
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {summary && (
        <>
          {summary.overBudget && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Over budget — new AI calls
              are being blocked by hard-stop.
            </div>
          )}

          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="This month"
              value={dollars(summary.summary.totalCostUsdMicro)}
            />
            <StatCard
              label="Calls"
              value={summary.summary.totalCalls.toLocaleString()}
            />
            <StatCard
              label="Cap"
              value={
                summary.budget
                  ? dollars(summary.budget.monthlyCapUsdMicro)
                  : '—'
              }
            />
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Per-model breakdown</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-2">Model</th>
                  <th>Calls</th>
                  <th>Prompt tokens</th>
                  <th>Completion tokens</th>
                  <th className="text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {summary.summary.perModel.map((row) => (
                  <tr key={row.model} className="border-t border-gray-100">
                    <td className="py-2 font-medium">{row.model}</td>
                    <td>{row.calls}</td>
                    <td>{row.promptTokens.toLocaleString()}</td>
                    <td>{row.completionTokens.toLocaleString()}</td>
                    <td className="text-right">{dollars(row.costUsdMicro)}</td>
                  </tr>
                ))}
                {summary.summary.perModel.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-gray-500">
                      No calls yet this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 max-w-xl">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              <h3 className="font-semibold text-gray-900">Monthly cap</h3>
            </div>
            <label className="block text-sm">
              <span className="text-gray-700">Cap (USD)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={draftCap}
                onChange={(e) => setDraftCap(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                data-testid="ai-cost-cap"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hardStop}
                onChange={(e) => setHardStop(e.target.checked)}
              />
              Hard-stop when cap reached
            </label>
            <button
              type="button"
              onClick={() => void saveBudget()}
              className="rounded bg-amber-500 text-white px-4 py-2 text-sm"
            >
              Save
            </button>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Recent calls</h3>
            <ul className="space-y-2 text-sm">
              {entries.slice(0, 20).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between py-1 border-b border-gray-100 last:border-b-0"
                >
                  <span>
                    <span className="font-medium">{e.model}</span>
                    {e.purpose ? (
                      <span className="text-gray-500"> — {e.purpose}</span>
                    ) : null}
                  </span>
                  <span className="text-gray-600 text-xs">
                    {dollars(e.costUsdMicro)} · {new Date(e.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
              {entries.length === 0 && (
                <li className="text-gray-500">No entries yet.</li>
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
