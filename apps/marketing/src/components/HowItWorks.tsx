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
      body: 'Event-sourced ingest projects your Postgres records into a per-tenant knowledge graph (Neo4j-backed). Native connectors for M-PESA, Stripe, Flutterwave, plus CSV + API + PMS adapters.',
      bullets: [
        'CSV · API · native PMS connectors',
        'Knowledge graph auto-built as data lands',
        'Reversible at any time',
      ],
    },
    {
      n: '02',
      label: 'Observe',
      title: 'Watch Mwikila work silently, first.',
      body: 'Shadow mode runs for 14 days. Every decision the brain would have made is recorded, cited, and replayable against what actually happened. No action crosses the wall; no trust is spent.',
      bullets: [
        'Policy simulator with side-by-side replay',
        '14-day dry-run by default, extendable',
        'Every would-have-done recorded on the chain',
      ],
    },
    {
      n: '03',
      label: 'Delegate',
      title: 'Turn on what you trust, one domain at a time.',
      body: 'Ten domains — finance, leasing, maintenance, compliance, communications, marketing, HR, procurement, insurance, legal, tenant welfare. Five autonomy levels per domain. Seven red-line actions (evictions · tribunal filings · legal notices · terminations) never auto-execute.',
      bullets: [
        'Per-domain 0 – 4 autonomy dial',
        'Revocable in one click; effective instantly',
        '7 red-line actions guarded at every level',
      ],
    },
    {
      n: '04',
      label: 'Operate',
      title: 'Spend mornings on decisions that matter.',
      body: 'The Head Briefing at 7am assembles overnight autonomous actions, pending decisions with Mwikila\'s recommendation + confidence, KPI deltas, tenant sentiment, and anomalies — in a single first-login screen. You approve the handful of exceptions.',
      bullets: [
        'Talk to your company — first-person agent with tool use',
        'Forecasts with 90% conformal prediction intervals',
        'Cryptographic audit chain on every turn',
      ],
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
