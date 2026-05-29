import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { TIERS, type PricingTier } from '@/lib/pricing';
import { formatCurrency, formatNumber } from '@/lib/format';

/**
 * Pricing — five-tier ladder ported from Borjie's Swahili-named tiers
 * (Mkulima / Mwanafamilia / Mfanyabiashara / Kampuni / Group).
 *
 * Design rules:
 *   - TZS-primary per CLAUDE.md money rule (formatCurrency used for
 *     every render, never hard-coded "TZS" prefix).
 *   - No "trial" CTA copy per Borjie discipline. Only "Sign Up",
 *     "Book a demo", "Talk to sales".
 *   - Mfanyabiashara is the highlighted tier (most chosen by
 *     professional managers).
 *   - Per-unit overage shown as secondary metric, not a hidden cost.
 *
 * The home page renders the headline + grid. The /pricing page
 * additionally renders the comparison matrix + FAQ — see
 * src/app/pricing/page.tsx.
 */
function ctaCopy(tier: PricingTier): { href: string; label: string } {
  if (tier.ctaKey === 'sales') {
    return { href: '/contact', label: 'Talk to sales' };
  }
  if (tier.ctaKey === 'demo') {
    return { href: '/book-demo', label: 'Book a 20-minute demo' };
  }
  return { href: '/sign-up', label: 'Sign Up — free' };
}

function priceCopy(tier: PricingTier): { primary: string; unit: string } {
  if (tier.priceMonthlyTzs === 'custom') {
    return { primary: 'Custom', unit: 'tailored to your portfolio' };
  }
  if (tier.priceMonthlyTzs === 0) {
    return { primary: 'Free', unit: 'per portfolio · per month' };
  }
  return {
    primary: formatCurrency(tier.priceMonthlyTzs, 'TZS'),
    unit: 'per portfolio · per month',
  };
}

function capCopy(tier: PricingTier): string {
  if (tier.unitCap === 'unlimited') return 'Unlimited units';
  return `Up to ${formatNumber(tier.unitCap)} units`;
}

function seatsCopy(tier: PricingTier): string {
  if (tier.seats === 'unlimited') return 'Unlimited user seats';
  return `${tier.seats} user seat${tier.seats === 1 ? '' : 's'}`;
}

function overageCopy(tier: PricingTier): string | null {
  if (tier.perUnitTzs === 'custom') return null;
  if (tier.perUnitTzs === 0) return null;
  return `${formatCurrency(tier.perUnitTzs, 'TZS')} per unit beyond cap`;
}

export function Pricing() {
  return (
    <section
      className="relative mx-auto max-w-7xl px-6 pb-24 pt-4 lg:px-8"
      id="pricing"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          09 · Bei (Pricing)
        </p>
        <h2 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Five tiers. Swahili names. TZS-primary.
        </h2>
        <p className="mx-auto mt-5 max-w-prose-wide text-lg leading-relaxed text-neutral-500">
          From Mkulima — free for the single landlord — to Group, for
          multi-country REITs. Every tier ships the same Mr. Mwikila
          brain, audit chain, and bilingual sw/en interface.
        </p>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {TIERS.map((tier) => {
          const cta = ctaCopy(tier);
          const price = priceCopy(tier);
          const overage = overageCopy(tier);
          return (
            <article
              key={tier.id}
              className={[
                'flex flex-col rounded-2xl border p-6 transition-all duration-base ease-out',
                tier.highlighted
                  ? 'border-signal-500/40 bg-surface ring-1 ring-signal-500/30 shadow-[0_0_48px_-16px_hsl(var(--signal-500)/0.35)]'
                  : 'border-border bg-surface',
              ].join(' ')}
              aria-label={`Tier ${tier.position}: ${tier.name}`}
            >
              <header>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-[0.62rem] uppercase tracking-widest text-neutral-500">
                      T{tier.position}
                    </p>
                    <h3 className="mt-0.5 font-display text-2xl font-medium tracking-tight">
                      {tier.name}
                    </h3>
                  </div>
                  {tier.highlighted && (
                    <span className="rounded-full bg-signal-500/15 px-2 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-signal-500">
                      Most chosen
                    </span>
                  )}
                </div>
                <p className="mt-2 min-h-[2.5rem] text-xs leading-snug text-neutral-500">
                  <span className="italic">{tier.tagline.sw}</span>
                  <br />
                  <span>{tier.tagline.en}</span>
                </p>
              </header>

              <div className="mt-5">
                <p className="font-display text-3xl font-medium leading-none tracking-tight tabular-nums">
                  {price.primary}
                </p>
                <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500">
                  {price.unit}
                </p>
                <ul className="mt-4 space-y-1 text-xs text-neutral-500">
                  <li>{capCopy(tier)}</li>
                  <li>{seatsCopy(tier)}</li>
                  {overage && <li>{overage}</li>}
                </ul>
              </div>

              <Link
                href={cta.href}
                className={[
                  'mt-6 inline-flex h-11 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-all duration-fast ease-out active:scale-[0.98]',
                  tier.highlighted
                    ? 'bg-signal-500 text-primary-foreground shadow-md hover:bg-signal-400 hover:shadow-lg'
                    : 'border border-border text-foreground hover:bg-surface-raised',
                ].join(' ')}
              >
                {tier.highlighted && <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                {cta.label}
              </Link>

              <ul className="mt-6 space-y-2 border-t border-border pt-5">
                {(tier.position === 1
                  ? [
                      'Mr. Mwikila chat',
                      'M-Pesa rent collection',
                      'Double-entry ledger',
                      'Cryptographic audit',
                      'Swahili + English',
                    ]
                  : tier.position === 2
                    ? [
                        'Everything in Mkulima',
                        'Tenant onboarding',
                        'Maintenance triage',
                        'Owner statements',
                        'Lease + title registry',
                      ]
                    : tier.position === 3
                      ? [
                          'Everything in Mwanafamilia',
                          'Vendor + handyman dispatch',
                          'Multi-currency (TZS/KES/USD)',
                          'Regulatory calendar',
                          'Rent-rate forecasts',
                          'Priority support 4-hr SLA',
                        ]
                      : tier.position === 4
                        ? [
                            'Everything in Mfanyabiashara',
                            'Master Brain + LMBM',
                            'Treasury sweep + escrow',
                            'Housing-regulator e-filing',
                            'SSO / SCIM provisioning',
                            'Dedicated success manager',
                          ]
                        : [
                            'Everything in Kampuni',
                            'Cross-tenant pattern library',
                            'On-prem / private cloud',
                            '99.95% SLA + named SRE',
                            'Custom audit + reports',
                            'Multi-country, multi-currency',
                          ]
                ).map((label) => (
                  <li key={label} className="flex items-start gap-2 text-xs leading-relaxed">
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-500"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                    <span className="text-foreground">{label}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <p className="mt-10 text-center text-xs text-neutral-500">
        All tiers include SOC 2 Type II, append-only audit trail, and the
        seven red-line guarantees. Billed monthly in TZS. Cancel any
        time. No card needed to sign up.
      </p>
    </section>
  );
}
