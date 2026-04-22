import { Check } from 'lucide-react';

/**
 * HowItWorks — the four-phase onboarding arc, shown as a horizontal
 * numbered sequence. Answers the "how do I actually adopt this?"
 * question in one screen. No stock illustrations, no photography —
 * just disciplined editorial typography and subtle dividing rules.
 */
export function HowItWorks() {
  const steps = [
    {
      n: '01',
      label: 'Connect',
      title: 'Plug into what you already have.',
      body: 'One-click imports for leases, tenants, and payment history. Native connectors for M-PESA, Stripe, Flutterwave, and 14 property-management systems.',
      bullets: ['CSV + API + native PMS', 'Zero-lift migration', 'Reversible at any time'],
    },
    {
      n: '02',
      label: 'Observe',
      title: 'Watch Mwikila work silently, first.',
      body: 'Shadow mode runs for 14 days. You see exactly what the brain would do, without it doing anything. No surprises, no lost trust.',
      bullets: ['Full policy simulator', '14-day dry-run by default', 'Side-by-side with your real ops'],
    },
    {
      n: '03',
      label: 'Delegate',
      title: 'Turn on what you trust, one domain at a time.',
      body: 'Finance, maintenance, compliance, leasing — ten domains. Grant autonomy level 1 this week, level 3 next month. You set the pace.',
      bullets: ['Per-domain autonomy dial', 'Revocable in one click', '7 red-line actions always guarded'],
    },
    {
      n: '04',
      label: 'Operate',
      title: 'Spend mornings on decisions that matter.',
      body: 'The briefing at 7am tells you what Mwikila did, what it flagged, and where the portfolio stands. You approve the handful of exceptions.',
      bullets: ['Cohesive head briefing UI', 'Extended-thinking on hard calls', 'Append-only audit trail'],
    },
  ];

  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-4 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          04 · How It Works
        </p>
        <h2 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          From connect to operate. Your first month.
        </h2>
      </div>

      <ol className="mt-14 grid gap-px rounded-2xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <li key={s.n} className="flex flex-col bg-surface p-8">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs uppercase tracking-widest text-signal-500">
                {s.label}
              </span>
              <span className="font-mono text-xs text-neutral-500">· {s.n}</span>
            </div>
            <h3 className="mt-4 font-display text-xl font-medium leading-tight tracking-tight text-balance">
              {s.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-500">{s.body}</p>
            <ul className="mt-5 space-y-2">
              {s.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-500" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
