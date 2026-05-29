import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Minus, Sparkles } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { Pricing } from '@/components/Pricing';
import { FaqAccordion } from '@/components/shared/FaqAccordion';
import { MwikilaChip } from '@/components/shared/MwikilaChip';
import { TIERS, COMPARISON, PRICING_FAQ, type TierId } from '@/lib/pricing';

export const metadata: Metadata = {
  title: 'Pricing — Boss Nyumba',
  description:
    'Five tiers: Mkulima (free, single landlord), Mwanafamilia (family portfolio), Mfanyabiashara (professional manager), Kampuni (REITs + companies), Group (multi-country). TZS-primary, billed monthly. M-Pesa / Tigo Pesa / Airtel Money / bank / card accepted.',
};

/**
 * /pricing — full pricing page ported from Borjie's LitFin-rhythm
 * pricing template. Sections:
 *   1. Hero ribbon (kicker, headline, subhead, Mr. Mwikila chip)
 *   2. T1-T5 pricing cards (shared Pricing component)
 *   3. Trust-badge wordwall
 *   4. Feature comparison matrix (grouped by domain)
 *   5. FAQ accordion (8 questions, bilingual sw/en)
 *   6. Closing CTA (Sign Up / Book a demo)
 *
 * Hard rule: no "trial" language anywhere (Borjie discipline).
 */
function tierShipsFeature(tierId: TierId, feature: (typeof COMPARISON)[number]): boolean {
  return feature.tiers.includes(tierId);
}

const TRUST_BADGES: readonly string[] = [
  'SOC 2 Type II',
  'ISO 27001',
  'GDPR + TZ DPA aligned',
  'M-Pesa partner',
  'Tigo Pesa partner',
  'Airtel Money partner',
  'OpenSSF best practices',
  'Cryptographic audit chain',
];

export default function PricingPage() {
  // Group comparison rows by domain for editorial structure.
  const groups = Array.from(
    new Set(COMPARISON.map((row) => row.group)),
  );

  return (
    <PageShell>
      {/* HERO */}
      <section
        className="relative overflow-hidden"
        aria-labelledby="pricing-page-heading"
      >
        <div className="hero-aurora" aria-hidden="true" />
        <div
          className="absolute inset-0 cinematic-grid opacity-30"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center lg:py-28">
          <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
            Pricing
          </p>
          <h1
            id="pricing-page-heading"
            className="mt-5 font-display text-5xl font-medium tracking-tight text-balance sm:text-6xl"
          >
            Priced per portfolio, not per door.
          </h1>
          <p className="mx-auto mt-6 max-w-prose-widest text-lg leading-relaxed text-neutral-400 sm:text-xl">
            Mkulima is free for the single landlord. Group is bespoke
            for multi-country REITs. The same Mr. Mwikila brain runs
            every tier.
          </p>
          <div className="mt-8 flex justify-center">
            <MwikilaChip />
          </div>
        </div>
      </section>

      {/* T1-T5 PRICING GRID */}
      <Pricing />

      {/* TRUST BADGE STRIP */}
      <section
        className="mx-auto max-w-4xl px-6 pb-12 pt-4 text-center lg:px-8"
        aria-label="Trust badges"
      >
        <p className="mx-auto mb-6 max-w-xl font-mono text-xs uppercase tracking-widest text-neutral-500">
          Trusted with billions of TZS in rent under management.
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {TRUST_BADGES.map((badge) => (
            <li
              key={badge}
              className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500"
            >
              {badge}
            </li>
          ))}
        </ul>
      </section>

      {/* COMPARISON MATRIX */}
      <section
        className="mx-auto max-w-7xl px-6 pb-24 lg:px-8"
        aria-labelledby="pricing-compare-heading"
      >
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="pricing-compare-heading"
            className="font-display text-3xl font-medium tracking-tight"
          >
            Every feature, every tier.
          </h2>
          <p className="mx-auto mt-3 max-w-prose-wide text-base leading-relaxed text-neutral-400">
            Compare side-by-side. Mfanyabiashara is the most chosen tier;
            Group is for multi-country sovereign portfolios.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-border bg-surface shadow-md">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised">
                <th className="px-5 py-4 text-left font-mono text-[0.68rem] uppercase tracking-widest text-neutral-400">
                  Feature
                </th>
                {TIERS.map((tier) => (
                  <th
                    key={tier.id}
                    className="px-3 py-4 text-center font-display text-sm font-medium tracking-tight text-foreground"
                  >
                    <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-neutral-500">
                      T{tier.position}
                    </span>
                    {tier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.flatMap((group) => [
                <tr
                  key={`group-${group}`}
                  className="border-b border-border bg-surface-sunken"
                >
                  <td
                    colSpan={1 + TIERS.length}
                    className="px-5 py-2 font-mono text-[0.65rem] uppercase tracking-widest text-signal-500"
                  >
                    {group}
                  </td>
                </tr>,
                ...COMPARISON.filter((c) => c.group === group).map((row) => (
                  <tr
                    key={`${group}-${row.feature}`}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-5 py-3 text-left text-foreground">
                      {row.feature}
                    </td>
                    {TIERS.map((tier) => {
                      const has = tierShipsFeature(tier.id, row);
                      return (
                        <td key={tier.id} className="px-3 py-3 text-center">
                          {has ? (
                            <Check
                              className="mx-auto h-4 w-4 text-signal-500"
                              aria-label="included"
                            />
                          ) : (
                            <Minus
                              className="mx-auto h-4 w-4 text-neutral-600"
                              aria-label="not included"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section
        className="mx-auto max-w-3xl px-6 pb-24 lg:px-8"
        aria-labelledby="pricing-faq-heading"
      >
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
            Maswali (Questions)
          </p>
          <h2
            id="pricing-faq-heading"
            className="mt-3 font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl"
          >
            Pricing FAQ
          </h2>
          <p className="mx-auto mt-3 max-w-prose-wide text-base leading-relaxed text-neutral-400">
            Eight answers we hear most often. Have another? Ask Mr.
            Mwikila in the chat widget — he speaks Swahili by default.
          </p>
        </div>
        <div className="mt-12">
          <FaqAccordion items={PRICING_FAQ} />
        </div>
      </section>

      {/* CLOSING CTA */}
      <section
        className="border-t border-border bg-surface/40 px-5 py-16 md:py-24"
        aria-labelledby="pricing-closing-cta"
      >
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="pricing-closing-cta"
            className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl lg:text-5xl"
          >
            Anza leo. Hakuna kadi inahitajika.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-neutral-400">
            Start today. No card needed. Mkulima is free up to 5 units —
            sign up with your M-Pesa number or email.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-signal-500 px-7 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-base ease-out hover:bg-signal-400 hover:shadow-lg active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Sign Up
              <ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/book-demo"
              className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-surface/60 px-7 text-sm font-semibold text-foreground transition-colors duration-fast hover:bg-surface-raised"
            >
              Book a 20-minute demo
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
