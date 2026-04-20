/**
 * Head-of-Estates dashboard — Wave-13.
 *
 * Replaces the default admin home for users with role=HEAD_OF_ESTATES or
 * the headViewMode feature flag turned on. The hero line tells the head
 * exactly what Mr. Mwikila did this week and how many items need them;
 * four summary cards break down exceptions, latest briefing, portfolio
 * health, and pending strategic decisions.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import {
  Sparkles,
  AlertTriangle,
  FileText,
  Activity,
  Scale,
  Mic,
  MessageSquare,
} from 'lucide-react';
import { api } from '../lib/api';

interface HeadStats {
  readonly actionsThisWeek: number;
}

interface ExceptionSummary {
  readonly id: string;
  readonly priority: 'P1' | 'P2' | 'P3';
  readonly domain: string;
  readonly title: string;
}

export default function HeadOfEstates(): JSX.Element {
  const t = useTranslations('head');
  const [stats, setStats] = useState<HeadStats | null>(null);
  const [exceptions, setExceptions] = useState<readonly ExceptionSummary[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<HeadStats>('/audit/autonomous-actions/stats'),
      api.get<readonly ExceptionSummary[]>('/exceptions'),
    ]).then(([s, e]) => {
      if (!active) return;
      if (s.success && s.data) setStats(s.data);
      if (e.success && e.data) setExceptions(e.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const p1 = exceptions.filter((x) => x.priority === 'P1').length;
  const p2 = exceptions.filter((x) => x.priority === 'P2').length;
  const p3 = exceptions.filter((x) => x.priority === 'P3').length;

  return (
    <div className="space-y-6">
      <header className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl p-6 flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t('heroTitle')}</h1>
          <p className="text-sm text-violet-100">
            {t('heroSub', {
              actions: stats?.actionsThisWeek ?? 0,
              needsYou: exceptions.length,
            })}
          </p>
        </div>
        <Sparkles className="h-10 w-10" />
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardExceptions p1={p1} p2={p2} p3={p3} />
        <CardBriefing />
        <CardPortfolioHealth />
        <CardStrategicPending />
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">{t('quickActionsTitle')}</h3>
        <div className="flex flex-wrap gap-2">
          <QuickAction icon={<MessageSquare className="h-4 w-4" />} label={t('askMwikila')} />
          <QuickAction icon={<Scale className="h-4 w-4" />} label={t('whatIfScenario')} />
          <QuickAction icon={<Activity className="h-4 w-4" />} label={t('approveAllRoutine')} />
          <QuickAction icon={<Mic className="h-4 w-4" />} label={t('listenBriefing')} />
        </div>
      </section>
    </div>
  );
}

function CardExceptions({
  p1,
  p2,
  p3,
}: {
  p1: number;
  p2: number;
  p3: number;
}): JSX.Element {
  const t = useTranslations('head');
  return (
    <Link
      to="/exceptions"
      data-testid="card-exceptions"
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-violet-300 hover:shadow-sm transition"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold text-gray-900">{t('cardExceptionsTitle')}</h3>
      </div>
      <div className="flex items-baseline gap-3 text-sm">
        <span className="text-2xl font-semibold text-gray-900">{p1 + p2 + p3}</span>
        <span className="text-gray-500">{t('cardExceptionsNeedAttention')}</span>
      </div>
      <div className="mt-3 flex gap-2 text-xs">
        <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">P1 {p1}</span>
        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">P2 {p2}</span>
        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">P3 {p3}</span>
      </div>
    </Link>
  );
}

function CardBriefing(): JSX.Element {
  const t = useTranslations('head');
  return (
    <div
      data-testid="card-briefing"
      className="bg-white rounded-xl border border-gray-200 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-violet-600" />
        <h3 className="font-semibold text-gray-900">{t('cardBriefingTitle')}</h3>
      </div>
      <p className="text-sm text-gray-600">{t('cardBriefingPlaceholder')}</p>
    </div>
  );
}

function CardPortfolioHealth(): JSX.Element {
  const t = useTranslations('head');
  return (
    <div
      data-testid="card-portfolio"
      className="bg-white rounded-xl border border-gray-200 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-5 w-5 text-emerald-600" />
        <h3 className="font-semibold text-gray-900">{t('cardPortfolioTitle')}</h3>
      </div>
      <p className="text-sm text-gray-600">{t('cardPortfolioPlaceholder')}</p>
    </div>
  );
}

function CardStrategicPending(): JSX.Element {
  const t = useTranslations('head');
  return (
    <div
      data-testid="card-strategic"
      className="bg-white rounded-xl border border-gray-200 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Scale className="h-5 w-5 text-indigo-600" />
        <h3 className="font-semibold text-gray-900">{t('cardStrategicTitle')}</h3>
      </div>
      <p className="text-sm text-gray-600">{t('cardStrategicPlaceholder')}</p>
    </div>
  );
}

function QuickAction({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-violet-300 hover:bg-violet-50"
    >
      {icon}
      {label}
    </button>
  );
}
