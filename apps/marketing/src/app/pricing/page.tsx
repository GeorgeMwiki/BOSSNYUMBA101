import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Minus, Sparkles } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { Pricing } from '@/components/Pricing';
import { FaqAccordion } from '@/components/shared/FaqAccordion';
import { MwikilaChip } from '@/components/shared/MwikilaChip';
import { getLocale } from '@/lib/locale';
import { type Locale } from '@/lib/i18n';
import {
  TIERS,
  COMPARISON,
  pricingFaq,
  tierLabel,
  comparisonGroupLabel,
  comparisonFeatureLabel,
  type TierId,
} from '@/lib/pricing';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Bei — Boss Nyumba',
      description:
        'Madaraja matano, msingi wa TZS, kulipwa kila mwezi. Mkulima ni bure kwa mmiliki mmoja wa nyumba; Mwanafamilia, Mfanyabiashara, Kampuni, na Group hupanda kutoka hapo. M-Pesa, Tigo Pesa, Airtel Money, benki, na kadi zinakubaliwa.',
    };
  }
  return {
    title: 'Pricing — Boss Nyumba',
    description:
      'Five tiers, TZS-primary, billed monthly. Smallholder is free for the single landlord; Family, Professional, Corporate, and Group scale up from there. M-Pesa, Tigo Pesa, Airtel Money, bank, and card payments accepted.',
  };
}

/**
 * /pricing — full pricing page. Locale-aware end-to-end: the entire
 * page consumes `getLocale()` and all tier labels resolve through
 * `tierLabel(tier, locale)` so the English render is pure English
 * and the Swahili render is pure Swahili.
 *
 * Sections:
 *   1. Hero ribbon (kicker, headline, subhead, Mr. Mwikila chip)
 *   2. T1-T5 pricing cards (shared Pricing component)
 *   3. Trust-badge wordwall
 *   4. Feature comparison matrix (grouped by domain)
 *   5. FAQ accordion (8 questions, per-locale dictionary)
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

interface PageCopy {
  readonly heroKicker: string;
  readonly heroHeading: string;
  readonly heroSubOne: string;
  readonly heroSubTwo: string;
  readonly trustHeading: string;
  readonly compareHeading: string;
  readonly compareSub: (highlight: string) => string;
  readonly featureColumn: string;
  readonly faqKicker: string;
  readonly faqHeading: string;
  readonly faqSub: string;
  readonly ctaHeading: string;
  readonly ctaSub: (smallholder: string) => string;
  readonly ctaPrimary: string;
  readonly ctaSecondary: string;
}

const COPY: Record<Locale, PageCopy> = {
  en: {
    heroKicker: 'Pricing',
    heroHeading: 'Priced per portfolio, not per door.',
    heroSubOne: 'The Smallholder tier is free for the single landlord.',
    heroSubTwo: 'Group is bespoke for multi-country REITs. The same Mr. Mwikila brain runs every tier.',
    trustHeading: 'Trusted with billions of TZS in rent under management.',
    compareHeading: 'Every feature, every tier.',
    compareSub: (highlight) =>
      `Compare side-by-side. ${highlight} is the most chosen tier; Group is for multi-country sovereign portfolios.`,
    featureColumn: 'Feature',
    faqKicker: 'Questions',
    faqHeading: 'Pricing FAQ',
    faqSub:
      'Eight answers we hear most often. Have another? Ask Mr. Mwikila in the chat widget — he speaks Swahili by default.',
    ctaHeading: 'Start today. No card needed.',
    ctaSub: (smallholder) =>
      `The ${smallholder} tier is free up to 5 units — sign up with your M-Pesa number or email.`,
    ctaPrimary: 'Sign Up',
    ctaSecondary: 'Book a 20-minute demo',
  },
  sw: {
    heroKicker: 'Bei',
    heroHeading: 'Bei kwa portfolio, si kwa mlango.',
    heroSubOne: 'Daraja la Mkulima ni bure kwa mmiliki mmoja wa nyumba.',
    heroSubTwo:
      'Daraja la Group ni la kibinafsi kwa REIT za mataifa mengi. Ubongo wa Bw. Mwikila ni sawa kwa kila daraja.',
    trustHeading: 'Inayoaminika na mabilioni ya TZS ya kodi inayosimamiwa.',
    compareHeading: 'Kila kipengele, kila daraja.',
    compareSub: (highlight) =>
      `Linganisha pamoja. ${highlight} ndilo daraja linalochaguliwa zaidi; Group ni kwa portfolio za enzi za mataifa mengi.`,
    featureColumn: 'Kipengele',
    faqKicker: 'Maswali',
    faqHeading: 'Maswali ya Bei',
    faqSub:
      'Majibu nane tunayoulizwa mara nyingi. Una swali lingine? Muulize Bw. Mwikila kwenye dirisha la mazungumzo — anaongea Kiswahili kwa chaguo-msingi.',
    ctaHeading: 'Anza leo. Hakuna kadi inayohitajika.',
    ctaSub: (smallholder) =>
      `Daraja la ${smallholder} ni bure hadi vyumba 5 — jisajili kwa nambari yako ya M-Pesa au barua pepe.`,
    ctaPrimary: 'Jisajili',
    ctaSecondary: 'Weka onyesho la dakika 20',
  },
};

export default async function PricingPage() {
  const locale = await getLocale();
  const copy = COPY[locale] ?? COPY.en;
  const faq = pricingFaq(locale);
  const highlightedTier = TIERS.find((t) => t.highlighted) ?? TIERS[2];
  const smallholderTier = TIERS[0];

  // Group comparison rows by domain for editorial structure.
  const groups = Array.from(new Set(COMPARISON.map((row) => row.group)));

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
            {copy.heroKicker}
          </p>
          <h1
            id="pricing-page-heading"
            className="mt-5 font-display text-5xl font-medium tracking-tight text-balance sm:text-6xl"
          >
            {copy.heroHeading}
          </h1>
          <p className="mx-auto mt-6 max-w-prose-widest text-lg leading-relaxed text-neutral-400 sm:text-xl">
            {copy.heroSubOne} {copy.heroSubTwo}
          </p>
          <div className="mt-8 flex justify-center">
            <MwikilaChip />
          </div>
        </div>
      </section>

      {/* T1-T5 PRICING GRID */}
      <Pricing locale={locale} />

      {/* TRUST BADGE STRIP */}
      <section
        className="mx-auto max-w-4xl px-6 pb-12 pt-4 text-center lg:px-8"
        aria-label="Trust badges"
      >
        <p className="mx-auto mb-6 max-w-xl font-mono text-xs uppercase tracking-widest text-neutral-500">
          {copy.trustHeading}
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
            {copy.compareHeading}
          </h2>
          <p className="mx-auto mt-3 max-w-prose-wide text-base leading-relaxed text-neutral-400">
            {copy.compareSub(tierLabel(highlightedTier, locale))}
          </p>
        </div>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-border bg-surface shadow-md">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised">
                <th className="px-5 py-4 text-left font-mono text-[0.68rem] uppercase tracking-widest text-neutral-400">
                  {copy.featureColumn}
                </th>
                {TIERS.map((tier) => (
                  <th
                    key={tier.id}
                    className="px-3 py-4 text-center font-display text-sm font-medium tracking-tight text-foreground"
                  >
                    <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-neutral-500">
                      T{tier.position}
                    </span>
                    {tierLabel(tier, locale)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.flatMap((group) => {
                // Pull the SW group label from the first row matching this
                // group (every row in the group shares the same groupSw).
                const sampleRow = COMPARISON.find((c) => c.group === group);
                const groupLabelLocalised = sampleRow
                  ? comparisonGroupLabel(sampleRow, locale)
                  : group;
                return [
                <tr
                  key={`group-${group}`}
                  className="border-b border-border bg-surface-sunken"
                >
                  <td
                    colSpan={1 + TIERS.length}
                    className="px-5 py-2 font-mono text-[0.65rem] uppercase tracking-widest text-signal-500"
                  >
                    {groupLabelLocalised}
                  </td>
                </tr>,
                ...COMPARISON.filter((c) => c.group === group).map((row) => (
                  <tr
                    key={`${group}-${row.feature}`}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-5 py-3 text-left text-foreground">
                      {comparisonFeatureLabel(row, locale)}
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
              ];
              })}
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
            {copy.faqKicker}
          </p>
          <h2
            id="pricing-faq-heading"
            className="mt-3 font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl"
          >
            {copy.faqHeading}
          </h2>
          <p className="mx-auto mt-3 max-w-prose-wide text-base leading-relaxed text-neutral-400">
            {copy.faqSub}
          </p>
        </div>
        <div className="mt-12">
          <FaqAccordion items={faq} />
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
            {copy.ctaHeading}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-neutral-400">
            {copy.ctaSub(tierLabel(smallholderTier, locale))}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-signal-500 px-7 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-base ease-out hover:bg-signal-400 hover:shadow-lg active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {copy.ctaPrimary}
              <ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/book-demo"
              className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-surface/60 px-7 text-sm font-semibold text-foreground transition-colors duration-fast hover:bg-surface-raised"
            >
              {copy.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
