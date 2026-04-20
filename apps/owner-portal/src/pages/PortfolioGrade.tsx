/**
 * Owner-portal PortfolioGrade page.
 *
 * GET /api/v1/property-grading/portfolio
 *
 * Shows the owner's portfolio grade, the three strongest and three
 * weakest properties, and Mr. Mwikila's narrative reasons — a simpler
 * surface than the admin grid.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
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

interface PropertySummary {
  propertyId: string;
  grade: Grade;
  score: number;
  reasons?: readonly string[];
}

interface PortfolioGrade {
  tenantId: string;
  grade: Grade;
  score: number;
  totalProperties: number;
  distribution: Record<Grade, number>;
  topStrengths: PropertySummary[];
  topWeaknesses: PropertySummary[];
  trajectory?: { previousScore: number; delta: number; direction: string };
}

function gradeColor(grade: Grade): string {
  if (grade.startsWith('A')) return 'bg-emerald-600 text-white';
  if (grade.startsWith('B')) return 'bg-sky-600 text-white';
  if (grade.startsWith('C')) return 'bg-amber-500 text-white';
  if (grade.startsWith('D')) return 'bg-orange-600 text-white';
  if (grade === 'F') return 'bg-rose-600 text-white';
  return 'bg-gray-400 text-white';
}

function prettyGrade(grade: Grade): string {
  if (grade === 'INSUFFICIENT_DATA') return 'N/A';
  return grade.replace('_PLUS', '+').replace('_MINUS', '−');
}

export default function PortfolioGradePage(): JSX.Element {
  const t = useTranslations('portfolioGradePage');
  const [data, setData] = useState<PortfolioGrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<PortfolioGrade>(
      '/property-grading/portfolio?weightBy=unit_count',
    );
    if (res.success && res.data) setData(res.data);
    else setError(res.error?.message ?? 'Unable to load your portfolio grade.');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your grade…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
        {error ?? 'No portfolio grade available yet.'}
      </div>
    );
  }

  const narrative = buildNarrative(data);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">
          {t('subtitle')}
        </p>
      </header>

      <section className={`rounded-xl p-8 ${gradeColor(data.grade)}`}>
        <p className="uppercase text-xs tracking-wide opacity-75">
          {t('portfolioGrade')}
        </p>
        <p className="text-6xl font-bold mt-1">{prettyGrade(data.grade)}</p>
        <p className="text-base mt-2">
          Score {data.score.toFixed(1)} across {data.totalProperties} properties
        </p>
        {data.trajectory && (
          <p className="mt-4 inline-flex items-center gap-2 bg-white/20 rounded px-3 py-1 text-sm">
            Trajectory: {data.trajectory.direction} {data.trajectory.delta.toFixed(1)} pts vs last period
          </p>
        )}
      </section>

      <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-5">
        <header className="flex items-center gap-2 text-indigo-700">
          <Sparkles className="h-5 w-5" />
          <h2 className="font-semibold">{t('mrMwikilaSays')}</h2>
        </header>
        <p className="mt-2 text-sm text-indigo-900 whitespace-pre-line">
          {narrative}
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="rounded border border-emerald-200 bg-white p-4">
          <h3 className="font-semibold text-emerald-800">{t('top3Strongest')}</h3>
          <ul className="mt-2 space-y-2">
            {data.topStrengths.map((p) => (
              <li
                key={p.propertyId}
                className="flex items-center justify-between text-sm"
              >
                <span>{p.propertyId}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${gradeColor(p.grade)}`}
                >
                  {prettyGrade(p.grade)} · {p.score.toFixed(1)}
                </span>
              </li>
            ))}
            {data.topStrengths.length === 0 && (
              <li className="text-sm text-gray-500">{t('noDataYet')}</li>
            )}
          </ul>
        </div>

        <div className="rounded border border-rose-200 bg-white p-4">
          <h3 className="font-semibold text-rose-800">{t('top3NeedingAttention')}</h3>
          <ul className="mt-2 space-y-2">
            {data.topWeaknesses.map((p) => (
              <li
                key={p.propertyId}
                className="flex items-center justify-between text-sm"
              >
                <span>{p.propertyId}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${gradeColor(p.grade)}`}
                >
                  {prettyGrade(p.grade)} · {p.score.toFixed(1)}
                </span>
              </li>
            ))}
            {data.topWeaknesses.length === 0 && (
              <li className="text-sm text-gray-500">{t('noDataYet')}</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function buildNarrative(data: PortfolioGrade): string {
  if (data.grade === 'INSUFFICIENT_DATA') {
    return 'We do not yet have enough live data to grade your portfolio. Upload at least one month of payments, maintenance cases, and compliance records, then come back.';
  }
  const family = collapse(data.distribution);
  const strongest = data.topStrengths[0];
  const weakest = data.topWeaknesses[0];
  const lines: string[] = [];
  lines.push(
    `Your portfolio earned a ${prettyGrade(data.grade)} (${data.score.toFixed(1)} / 100) across ${data.totalProperties} properties.`,
  );
  lines.push(
    `Distribution — A: ${family.A}, B: ${family.B}, C: ${family.C}, D: ${family.D}, F: ${family.F}.`,
  );
  if (strongest) {
    lines.push(
      `${strongest.propertyId} is your strongest performer at ${prettyGrade(strongest.grade)}.`,
    );
  }
  if (weakest && weakest.propertyId !== strongest?.propertyId) {
    lines.push(
      `${weakest.propertyId} is the biggest drag at ${prettyGrade(weakest.grade)}. Focus here for the fastest score improvement.`,
    );
  }
  return lines.join('\n');
}

function collapse(distribution: Record<Grade, number>): {
  A: number;
  B: number;
  C: number;
  D: number;
  F: number;
} {
  const out = { A: 0, B: 0, C: 0, D: 0, F: 0 };
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
