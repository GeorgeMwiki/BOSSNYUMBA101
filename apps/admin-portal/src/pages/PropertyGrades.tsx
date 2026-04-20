/**
 * Admin-portal PropertyGrades page.
 *
 * GET  /api/v1/property-grading/portfolio
 * GET  /api/v1/property-grading/property/:id
 * GET  /api/v1/property-grading/property/:id/history
 * POST /api/v1/property-grading/recompute/:id
 *
 * Renders a color-coded grid of property grades + a portfolio rollup
 * card at the top. Clicking a property opens the detail panel with
 * dimensions, reasons, and a 12-month grade history chart.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';

type Grade =
  | 'A_PLUS'
  | 'A'
  | 'A_MINUS'
  | 'B_PLUS'
  | 'B'
  | 'B_MINUS'
  | 'C_PLUS'
  | 'C'
  | 'C_MINUS'
  | 'D_PLUS'
  | 'D'
  | 'F'
  | 'INSUFFICIENT_DATA';

interface PortfolioGrade {
  tenantId: string;
  grade: Grade;
  score: number;
  totalProperties: number;
  distribution: Record<Grade, number>;
  topStrengths: PropertyGradeReport[];
  topWeaknesses: PropertyGradeReport[];
  trajectory?: { previousScore: number; delta: number; direction: string };
  weightBy: string;
  computedAt: string;
}

interface PropertyGradeReport {
  propertyId: string;
  tenantId: string;
  grade: Grade;
  score: number;
  reasons?: readonly string[];
  dimensions?: Record<
    string,
    { score: number; grade: Grade; explanation: string; dimension?: string }
  >;
  computedAt?: string;
}

interface HistoryEntry {
  propertyId: string;
  grade: Grade;
  score: number;
  computedAt: string;
}

function gradeColor(grade: Grade): string {
  if (grade.startsWith('A')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (grade.startsWith('B')) return 'bg-sky-100 text-sky-800 border-sky-200';
  if (grade.startsWith('C')) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (grade.startsWith('D')) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (grade === 'F') return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function prettyGrade(grade: Grade): string {
  if (grade === 'INSUFFICIENT_DATA') return 'N/A';
  return grade.replace('_PLUS', '+').replace('_MINUS', '−');
}

export default function PropertyGradesPage(): JSX.Element {
  const [portfolio, setPortfolio] = useState<PortfolioGrade | null>(null);
  const [reports, setReports] = useState<readonly PropertyGradeReport[]>([]);
  const [selected, setSelected] = useState<PropertyGradeReport | null>(null);
  const [history, setHistory] = useState<readonly HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<PortfolioGrade>(
      '/property-grading/portfolio?weightBy=unit_count',
    );
    if (res.success && res.data) {
      setPortfolio(res.data);
      const combined = [...res.data.topStrengths, ...res.data.topWeaknesses];
      const deduped = combined.filter(
        (r, i, arr) => arr.findIndex((other) => other.propertyId === r.propertyId) === i,
      );
      setReports(deduped);
    } else {
      setError(res.error ?? 'Unable to load portfolio grade.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback(async (report: PropertyGradeReport) => {
    setSelected(report);
    const detail = await api.get<PropertyGradeReport>(
      `/property-grading/property/${encodeURIComponent(report.propertyId)}`,
    );
    if (detail.success && detail.data) setSelected(detail.data);
    const hist = await api.get<readonly HistoryEntry[]>(
      `/property-grading/property/${encodeURIComponent(report.propertyId)}/history?months=12`,
    );
    if (hist.success && hist.data) setHistory(hist.data);
  }, []);

  const recomputeAll = useCallback(async () => {
    if (!reports.length) return;
    setRefreshing(true);
    for (const r of reports) {
      // eslint-disable-next-line no-await-in-loop
      await api.post(
        `/property-grading/recompute/${encodeURIComponent(r.propertyId)}`,
        {},
      );
    }
    setRefreshing(false);
    void load();
  }, [reports, load]);

  const family = useMemo(() => collapse(portfolio?.distribution), [portfolio]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading property grades…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-indigo-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Property grades</h2>
            <p className="text-sm text-gray-500">
              A–F report cards powered by Mr. Mwikila's six-dimension scoring model.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={recomputeAll}
          disabled={refreshing || reports.length === 0}
          className="rounded bg-indigo-600 text-white px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Recompute all
        </button>
      </header>

      {error && (
        <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {portfolio && (
        <div className={`rounded-lg border p-5 ${gradeColor(portfolio.grade)}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-75">
                Portfolio grade
              </p>
              <p className="text-4xl font-bold">{prettyGrade(portfolio.grade)}</p>
              <p className="text-sm mt-1">Score {portfolio.score.toFixed(1)} · {portfolio.totalProperties} properties</p>
            </div>
            <div className="text-right text-sm">
              <p>A: {family.A} · B: {family.B} · C: {family.C} · D: {family.D} · F: {family.F}</p>
              {portfolio.trajectory && (
                <p className="mt-2 inline-flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  {portfolio.trajectory.direction} {portfolio.trajectory.delta.toFixed(1)} pts
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.map((r) => (
          <button
            key={r.propertyId}
            type="button"
            onClick={() => void openDetail(r)}
            className={`text-left rounded border p-4 hover:shadow ${gradeColor(r.grade)}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{prettyGrade(r.grade)}</span>
              <span className="text-xs opacity-75">{r.score.toFixed(1)}</span>
            </div>
            <p className="mt-1 text-sm font-medium truncate">{r.propertyId}</p>
          </button>
        ))}
      </section>

      {selected && (
        <aside className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl border-l p-6 overflow-y-auto">
          <header className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {selected.propertyId}
            </h3>
            <button
              type="button"
              onClick={() => { setSelected(null); setHistory([]); }}
              className="text-sm text-gray-500"
            >
              Close
            </button>
          </header>
          <div className={`mt-4 rounded p-4 ${gradeColor(selected.grade)}`}>
            <p className="text-3xl font-bold">{prettyGrade(selected.grade)}</p>
            <p className="text-sm mt-1">Score {selected.score.toFixed(1)}</p>
          </div>
          {selected.dimensions && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">Dimensions</h4>
              {Object.entries(selected.dimensions).map(([dim, detail]) => (
                <div
                  key={dim}
                  className={`rounded border p-3 ${gradeColor(detail.grade)}`}
                >
                  <div className="flex justify-between text-xs uppercase tracking-wide">
                    <span>{dim}</span>
                    <span>{prettyGrade(detail.grade)} · {detail.score.toFixed(1)}</span>
                  </div>
                  <p className="text-xs mt-1">{detail.explanation}</p>
                </div>
              ))}
            </div>
          )}
          {selected.reasons && selected.reasons.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700">Reasons</h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-700 list-disc pl-5">
                {selected.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {history.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700">History</h4>
              <div className="mt-2 flex items-end gap-1 h-24">
                {history.map((entry) => (
                  <div
                    key={entry.computedAt}
                    title={`${prettyGrade(entry.grade)} · ${entry.score.toFixed(1)} · ${entry.computedAt}`}
                    className={`flex-1 rounded-t ${gradeColor(entry.grade).split(' ')[0]}`}
                    style={{ height: `${Math.min(100, entry.score)}%` }}
                  />
                ))}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function collapse(
  distribution: Record<Grade, number> | undefined,
): { A: number; B: number; C: number; D: number; F: number } {
  const out = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  if (!distribution) return out;
  for (const [grade, count] of Object.entries(distribution)) {
    if (!count) continue;
    if (grade.startsWith('A')) out.A += count;
    else if (grade.startsWith('B')) out.B += count;
    else if (grade.startsWith('C')) out.C += count;
    else if (grade.startsWith('D')) out.D += count;
    else if (grade === 'F') out.F += count;
  }
  return out;
}
