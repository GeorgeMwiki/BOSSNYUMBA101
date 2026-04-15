/**
 * AICockpit — AI provider usage and governance telemetry.
 *
 * Assumed backend endpoints:
 *   GET /ai/usage?window=<1d|7d|30d>
 *       -> { data: { providers: ProviderUsage[], totals: UsageTotals } }
 *
 * The api client returns { success, data } where data is the payload envelope.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Cpu, RefreshCw } from 'lucide-react';
import { api, formatCurrency } from '../../lib/api';

type TimeWindow = '1d' | '7d' | '30d';

interface ProviderUsage {
  provider: string;
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  errorRate: number;
  avgLatencyMs: number;
  costUsd: number;
}

interface UsageTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface AIUsageResponse {
  providers: ProviderUsage[];
  totals: UsageTotals;
}

export default function AICockpit() {
  const [providers, setProviders] = useState<ProviderUsage[]>([]);
  const [totals, setTotals] = useState<UsageTotals | null>(null);
  const [window, setWindow] = useState<TimeWindow>('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<AIUsageResponse>(`/ai/usage?window=${window}`)
      .then((res) => {
        if (res.success && res.data) {
          setProviders(res.data.providers);
          setTotals(res.data.totals);
        } else {
          setError(res.error ?? 'Failed to load AI usage.');
          setProviders([]);
          setTotals(null);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [window]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Cockpit</h1>
          <p className="text-sm text-gray-500 mt-1">
            Usage, cost, and error telemetry across AI providers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={window}
            onChange={(e) => setWindow(e.target.value as TimeWindow)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <button
            type="button"
            onClick={fetchUsage}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Refresh AI usage"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {totals && !loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <SummaryCard label="Requests" value={totals.requests.toLocaleString()} />
          <SummaryCard label="Input tokens" value={totals.inputTokens.toLocaleString()} />
          <SummaryCard label="Output tokens" value={totals.outputTokens.toLocaleString()} />
          <SummaryCard label="Cost" value={formatCurrency(totals.costUsd, 'USD')} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="text-gray-600">{error}</p>
          <button
            type="button"
            onClick={fetchUsage}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <Cpu className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No AI usage recorded in this window.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Provider / Model</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Requests</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Input tokens</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Output tokens</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Error rate</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Avg latency</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {providers.map((p) => (
                <tr key={`${p.provider}:${p.model}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.provider}</div>
                    <div className="text-xs text-gray-500">{p.model}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{p.requests.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{p.inputTokens.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{p.outputTokens.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    <span className={p.errorRate > 0.05 ? 'text-red-600 font-medium' : 'text-gray-700'}>
                      {(p.errorRate * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{p.avgLatencyMs.toLocaleString()} ms</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(p.costUsd, 'USD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}
