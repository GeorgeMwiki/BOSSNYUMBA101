import Link from 'next/link';
import { Check, Minus } from 'lucide-react';

/**
 * Pricing — three-tier institutional pricing card with monthly/annual
 * toggle deliberately omitted (our pricing is per-unit, billed monthly,
 * no "save 20%" annual trick). The "Estate" tier is the hero.
 */
export function Pricing() {
  const tiers = [
    {
      name: 'Portfolio',
      tagline: 'For independent operators',
      price: '$1.20',
      unit: 'per unit · per month',
      minimum: 'From 50 units',
      highlighted: false,
      features: [
        { label: 'Head Briefing + autonomy dial',          included: true },
        { label: 'Finance + Maintenance + Communications', included: true },
        { label: '3 user seats',                            included: true },
        { label: 'Standard support',                        included: true },
        { label: 'Custom policy simulator',                 included: false },
        { label: 'Cross-tenant pattern library',            included: false },
        { label: 'On-prem deployment',                      included: false },
      ],
      cta: 'Start 30-day trial',
    },
    {
      name: 'Estate',
      tagline: 'For professional property managers',
      price: '$0.85',
      unit: 'per unit · per month',
      minimum: 'From 500 units',
      highlighted: true,
      features: [
        { label: 'All Portfolio features',                  included: true },
        { label: 'All 10 autonomy domains',                 included: true },
        { label: '25 user seats',                           included: true },
        { label: 'Custom policy simulator',                 included: true },
        { label: 'Junior-AI factory for team leads',        included: true },
        { label: 'Priority support, 4-hour SLA',            included: true },
        { label: 'Dedicated success manager',               included: false },
      ],
      cta: 'Book a 20-minute demo',
    },
    {
      name: 'Institutional',
      tagline: 'For funds, REITs, sovereign portfolios',
      price: 'Custom',
      unit: '',
      minimum: '5,000+ units',
      highlighted: false,
      features: [
        { label: 'Everything in Estate',                    included: true },
        { label: 'Unlimited seats + SSO/SCIM',              included: true },
        { label: 'Cross-tenant pattern library',            included: true },
        { label: 'On-prem or private cloud',                included: true },
        { label: 'Dedicated success manager',               included: true },
        { label: 'Custom audit reports',                    included: true },
        { label: '99.95% SLA + named support engineer',     included: true },
      ],
      cta: 'Talk to institutional sales',
    },
  ];

  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-4 lg:px-8" id="pricing">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          05 · Pricing
        </p>
        <h2 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Priced per unit, not per feature.
        </h2>
        <p className="mx-auto mt-5 max-w-[52ch] text-lg leading-relaxed text-neutral-500">
          No seat tax. No tiers that lock the features you need. The brain is
          the same at 50 units or 50,000 — price scales linearly.
        </p>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {tiers.map((tier) => (
          <article
            key={tier.name}
            className={[
              'flex flex-col rounded-2xl border p-8 transition-all duration-base ease-out',
              tier.highlighted
                ? 'border-signal-500/40 bg-surface ring-1 ring-signal-500/30 shadow-[0_0_48px_-16px_hsl(var(--signal-500)/0.35)]'
                : 'border-border bg-surface',
            ].join(' ')}
          >
            <header>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-medium tracking-tight">{tier.name}</h3>
                {tier.highlighted && (
                  <span className="rounded-full bg-signal-500/15 px-2.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-widest text-signal-500">
                    Most chosen
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-neutral-500">{tier.tagline}</p>
            </header>

            <div className="mt-6">
              <p className="font-display text-5xl font-medium leading-none tracking-tight tabular-nums">
                {tier.price}
              </p>
              <p className="mt-2 font-mono text-xs uppercase tracking-widest text-neutral-500">
                {tier.unit || '\u00A0'}
              </p>
              <p className="mt-4 text-xs text-neutral-500">{tier.minimum}</p>
            </div>

            <Link
              href="/book-demo"
              className={[
                'mt-8 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition-all duration-fast ease-out active:scale-[0.98]',
                tier.highlighted
                  ? 'bg-signal-500 text-primary-foreground shadow-md hover:bg-signal-400 hover:shadow-lg'
                  : 'border border-border text-foreground hover:bg-surface-raised',
              ].join(' ')}
            >
              {tier.cta}
            </Link>

            <ul className="mt-8 space-y-3 border-t border-border pt-6">
              {tier.features.map((f) => (
                <li key={f.label} className="flex items-start gap-3 text-sm">
                  {f.included ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal-500" />
                  ) : (
                    <Minus className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  )}
                  <span className={f.included ? 'text-foreground' : 'text-neutral-500 line-through decoration-neutral-400/30'}>
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-neutral-500">
        All tiers include SOC 2 Type II, append-only audit trail, 11-language
        support, and the seven red-line guarantees. Billed monthly. Cancel any time.
      </p>
    </section>
  );
}
