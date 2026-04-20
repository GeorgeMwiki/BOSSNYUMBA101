'use client';

/**
 * Live affordability demo — wraps the shared rent-affordability
 * calculator block from @bossnyumba/chat-ui so the prospect gets a
 * real working widget with no signup.
 */

import { useState } from 'react';

function classify(rent: number, income: number): {
  readonly ratio: number;
  readonly status: 'green' | 'yellow' | 'red';
  readonly label: string;
} {
  if (income <= 0) return { ratio: 0, status: 'red', label: 'Enter income' };
  const ratio = rent / income;
  if (ratio <= 0.33)
    return { ratio, status: 'green', label: 'Comfortably affordable' };
  if (ratio <= 0.4)
    return { ratio, status: 'yellow', label: 'Tight — budget carefully' };
  return { ratio, status: 'red', label: 'Unaffordable — reject or coach' };
}

const STATUS_COLOR: Record<'green' | 'yellow' | 'red', string> = {
  green: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  yellow: 'text-amber-800 bg-amber-50 border-amber-200',
  red: 'text-red-700 bg-red-50 border-red-200',
};

export function LiveAffordabilityDemo() {
  const [rent, setRent] = useState(450_000);
  const [income, setIncome] = useState(1_500_000);
  const { ratio, status, label } = classify(rent, income);
  const percent = Math.round(ratio * 1000) / 10;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Live demo — rent affordability
      </div>
      <h3 className="mb-2 text-lg font-semibold">Try a live affordability check.</h3>
      <p className="mb-4 text-sm text-slate-700">
        Adjust rent and gross monthly income. Mr. Mwikila uses the same rule of thumb for
        tenant screening across your portfolio.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Monthly rent (TZS)</span>
          <input
            type="number"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={rent}
            min={0}
            onChange={(e) => setRent(Number(e.target.value) || 0)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Gross monthly income (TZS)</span>
          <input
            type="number"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={income}
            min={0}
            onChange={(e) => setIncome(Number(e.target.value) || 0)}
          />
        </label>
      </div>
      <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-semibold ${STATUS_COLOR[status]}`}>
        {label} — rent is {percent}% of income.
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Rule of thumb: &le; 33% is healthy, 33-40% is tight, &gt; 40% we recommend rejecting or
        coaching the applicant before signing a lease.
      </p>
    </div>
  );
}
