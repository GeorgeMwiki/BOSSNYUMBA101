/**
 * CompliancePage — platform compliance overview.
 *
 * Assumed backend endpoints:
 *   GET /compliance/overview
 *       -> { data: { scorecards: Scorecard[], frameworks: FrameworkStatus[] } }
 *
 * The api client normalizes responses to { success, data }.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { api, formatDate } from '../../lib/api';

type FrameworkState = 'compliant' | 'at_risk' | 'non_compliant' | 'not_assessed';

interface Scorecard {
  key: string;
  label: string;
  passedControls: number;
  totalControls: number;
  lastAuditAt: string | null;
}

interface FrameworkStatus {
  framework: string;
  state: FrameworkState;
  owner: string;
  nextReviewAt: string | null;
  openFindings: number;
}

interface ComplianceOverviewResponse {
  scorecards: Scorecard[];
  frameworks: FrameworkStatus[];
}

const stateBadge: Record<FrameworkState, string> = {
  compliant: 'bg-green-100 text-green-700',
  at_risk: 'bg-amber-100 text-amber-700',
  non_compliant: 'bg-red-100 text-red-700',
  not_assessed: 'bg-gray-100 text-gray-600',
};

export default function CompliancePage() {
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [frameworks, setFrameworks] = useState<FrameworkStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<ComplianceOverviewResponse>('/compliance/overview')
      .then((res) => {
        if (res.success && res.data) {
          setScorecards(res.data.scorecards);
          setFrameworks(res.data.frameworks);
        } else {
          setError(res.error ?? 'Failed to load compliance overview.');
          setScorecards([]);
          setFrameworks([]);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Control scorecards and framework assessment status.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOverview}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Refresh compliance data"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

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
            onClick={fetchOverview}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : scorecards.length === 0 && frameworks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <ShieldCheck className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No compliance data available yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {scorecards.map((sc) => {
              const pct = sc.totalControls === 0 ? 0 : (sc.passedControls / sc.totalControls) * 100;
              const toneClass =
                pct >= 95 ? 'text-green-600' : pct >= 80 ? 'text-amber-600' : 'text-red-600';
              return (
                <div key={sc.key} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs uppercase tracking-wider text-gray-500">{sc.label}</div>
                  <div className={`mt-1 text-xl font-semibold ${toneClass}`}>
                    {sc.passedControls} / {sc.totalControls}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Last audit: {sc.lastAuditAt ? formatDate(sc.lastAuditAt) : 'never'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Framework status</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Framework</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">State</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Owner</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Findings</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Next review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {frameworks.map((f) => (
                  <tr key={f.framework} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {f.state === 'compliant' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : f.state === 'non_compliant' ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="font-medium text-gray-900">{f.framework}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${stateBadge[f.state]}`}>
                        {f.state.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{f.owner}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      <span className={f.openFindings > 0 ? 'text-red-600 font-medium' : 'text-gray-700'}>
                        {f.openFindings}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {f.nextReviewAt ? formatDate(f.nextReviewAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
