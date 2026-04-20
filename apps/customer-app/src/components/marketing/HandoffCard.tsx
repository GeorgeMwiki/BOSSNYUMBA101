'use client';

/**
 * HandoffCard — shown when Mr. Mwikila emits a handoff_to_signup event.
 *
 * Triggers:
 *   - 5+ meaningful turns in the marketing chat, OR
 *   - explicit "sign me up" intent detected server-side.
 *
 * The card pre-fills the signup route with role, portfolio size, country,
 * and primary pain so the prospect does not re-type what they already
 * told Mr. Mwikila.
 */

import Link from 'next/link';

export interface SignupPrefill {
  readonly role: string | null;
  readonly portfolioSize: string | null;
  readonly country: string | null;
  readonly primaryPain: string | null;
  readonly contactName: string | null;
  readonly contactMethod: string | null;
  readonly contactValue: string | null;
}

interface Props {
  readonly prefill: SignupPrefill;
}

export function HandoffCard({ prefill }: Props) {
  const params = new URLSearchParams();
  if (prefill.role) params.set('role', prefill.role);
  if (prefill.portfolioSize) params.set('portfolio', prefill.portfolioSize);
  if (prefill.country) params.set('country', prefill.country);
  if (prefill.primaryPain) params.set('pain', prefill.primaryPain);
  if (prefill.contactName) params.set('name', prefill.contactName);
  if (prefill.contactMethod) params.set('contactMethod', prefill.contactMethod);
  if (prefill.contactValue) params.set('contact', prefill.contactValue);
  const href = `/auth/register?${params.toString()}`;

  return (
    <aside className="my-4 rounded-xl border border-emerald-300 bg-emerald-50 p-5 shadow-sm">
      <h3 className="mb-1 text-lg font-semibold text-emerald-900">
        Karibu. Let me hand you to signup.
      </h3>
      <p className="mb-3 text-sm text-emerald-900/90">
        I have saved what we discussed — role, portfolio, country, and your main pain point.
        Signup takes 90 seconds.
      </p>
      {renderSummary(prefill)}
      <Link
        href={href}
        className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        Continue to signup
      </Link>
    </aside>
  );
}

function renderSummary(prefill: SignupPrefill) {
  const chips: string[] = [];
  if (prefill.role && prefill.role !== 'unknown')
    chips.push(`Role: ${prefill.role.replace('_', ' ')}`);
  if (prefill.portfolioSize && prefill.portfolioSize !== 'unknown')
    chips.push(`Portfolio: ${prefill.portfolioSize}`);
  if (prefill.country) chips.push(`Country: ${prefill.country}`);
  if (prefill.primaryPain) chips.push(`Focus: ${prefill.primaryPain}`);
  if (chips.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c}
          className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900"
        >
          {c}
        </span>
      ))}
    </div>
  );
}
