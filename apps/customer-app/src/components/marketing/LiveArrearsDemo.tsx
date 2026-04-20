'use client';

/**
 * Live arrears-triage demo — canned streaming walkthrough. Starts on
 * click, reveals steps on a short interval so the prospect literally
 * watches Mr. Mwikila think. No signup, no API call — the transcript
 * is pre-authored so there is zero cost and predictable UX.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Step {
  readonly t: number; // ms offset
  readonly line: string;
  readonly kind: 'thinking' | 'action' | 'decision';
}

const SCRIPT: readonly Step[] = [
  { t: 0, kind: 'thinking', line: 'Opening case: Tenant in Unit 7 — 45 days late. Outstanding: TZS 740,000.' },
  { t: 900, kind: 'thinking', line: 'Tenant 5P score history: 11 of the last 12 months on time. Single incident.' },
  { t: 1800, kind: 'decision', line: 'Because 45 days is beyond the reminder-only window, I draft a payment plan proposal.' },
  { t: 2700, kind: 'action', line: 'Plan: split into 2 payments — TZS 370,000 on the 1st, TZS 370,000 on the 15th.' },
  { t: 3500, kind: 'thinking', line: 'Drafting WhatsApp message in Swahili — calm, no pressure, one-tap accept link.' },
  { t: 4400, kind: 'action', line: 'Ready for your approval. Your edit history tells me you prefer a softer tone on long-term tenants.' },
  { t: 5200, kind: 'decision', line: 'Awaiting your approve button. If you approve, it dispatches immediately.' },
];

export function LiveArrearsDemo() {
  const t = useTranslations('liveArrears');
  const [running, setRunning] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState<number>(0);

  useEffect(() => {
    if (!running) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    SCRIPT.forEach((step, i) => {
      timers.push(
        setTimeout(() => setVisibleSteps((prev) => Math.max(prev, i + 1)), step.t)
      );
    });
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [running]);

  const start = () => {
    setVisibleSteps(0);
    setRunning(true);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Live demo — arrears triage
      </div>
      <h3 className="mb-2 text-lg font-semibold">{t('heading')}</h3>
      <p className="mb-4 text-sm text-slate-700">
        Canned walkthrough — no signup. Click start and watch each step narrate in real time.
      </p>
      <button
        type="button"
        onClick={start}
        disabled={running && visibleSteps < SCRIPT.length}
        className="mb-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {visibleSteps === 0 ? 'Start demo' : visibleSteps === SCRIPT.length ? 'Replay' : 'Running…'}
      </button>
      <ol className="space-y-2 text-sm">
        {SCRIPT.slice(0, visibleSteps).map((step, i) => (
          <li
            key={i}
            className={`rounded-lg border-l-4 px-3 py-2 ${
              step.kind === 'action'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                : step.kind === 'decision'
                  ? 'border-amber-500 bg-amber-50 text-amber-900'
                  : 'border-slate-300 bg-slate-50 text-slate-800'
            }`}
          >
            <span className="mr-1 font-semibold capitalize">{step.kind}:</span>
            {step.line}
          </li>
        ))}
      </ol>
    </div>
  );
}
