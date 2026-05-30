import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { TIERS, tierLabel, type PricingTier } from '@/lib/pricing';
import { formatCurrency, formatNumber } from '@/lib/format';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

/**
 * Pricing — five-tier ladder ported from Borjie's mining ladder.
 *
 * Locale-aware:
 *   - Each tier surfaces via `tierLabel(tier, locale)` so the English
 *     UI renders "Smallholder / Family / Professional / Corporate /
 *     Group" while the Swahili UI keeps the heritage names
 *     (Mkulima / Mwanafamilia / Mfanyabiashara / Kampuni / Group).
 *
 * Design rules:
 *   - TZS-primary per CLAUDE.md money rule (formatCurrency used for
 *     every render, never hard-coded "TZS" prefix).
 *   - No "trial" CTA copy per Borjie discipline. Only "Sign Up",
 *     "Book a demo", "Talk to sales".
 *   - The "Professional" tier (id `mfanyabiashara`) is highlighted as
 *     the most-chosen plan for property managers.
 *   - Per-unit overage shown as secondary metric, not a hidden cost.
 *
 * The home page renders the headline + grid. The /pricing page
 * additionally renders the comparison matrix + FAQ — see
 * src/app/pricing/page.tsx.
 */

interface PricingCopy {
  readonly kicker: string;
  readonly headline: string;
  readonly subOne: string;
  readonly subTwo: string;
  readonly perPortfolioPerMonth: string;
  readonly tailoredToYourPortfolio: string;
  readonly free: string;
  readonly custom: string;
  readonly unlimitedUnits: string;
  readonly upToUnits: (n: string) => string;
  readonly unlimitedSeats: string;
  readonly seatsLabel: (n: number) => string;
  readonly overage: (price: string) => string;
  readonly ctaSales: string;
  readonly ctaDemo: string;
  readonly ctaSignUp: string;
  readonly mostChosen: string;
  readonly everythingIn: (label: string) => string;
  readonly footnote: string;
  readonly featureBullets: {
    readonly mwikilaChat: string;
    readonly mpesaCollection: string;
    readonly doubleEntryLedger: string;
    readonly cryptoAudit: string;
    readonly swahiliEnglish: string;
    readonly tenantOnboarding: string;
    readonly maintenanceTriage: string;
    readonly ownerStatements: string;
    readonly leaseTitleRegistry: string;
    readonly vendorDispatch: string;
    readonly multiCurrency: string;
    readonly regulatoryCalendar: string;
    readonly rentForecasts: string;
    readonly prioritySupport: string;
    readonly masterBrainLmbm: string;
    readonly treasurySweep: string;
    readonly housingRegulator: string;
    readonly ssoScim: string;
    readonly dedicatedSuccess: string;
    readonly crossTenantPattern: string;
    readonly onPremPrivate: string;
    readonly slaSre: string;
    readonly customAuditReports: string;
    readonly multiCountryMultiCurrency: string;
  };
}

const COPY: Record<Locale, PricingCopy> = {
  en: {
    kicker: '09 · Pricing',
    headline: 'Five tiers. TZS-primary. No surprises.',
    subOne: 'From the free Smallholder tier — built for the single landlord — to Group, for multi-country REITs.',
    subTwo: 'Every tier ships the same Mr. Mwikila brain, audit chain, and bilingual sw/en interface.',
    perPortfolioPerMonth: 'per portfolio · per month',
    tailoredToYourPortfolio: 'tailored to your portfolio',
    free: 'Free',
    custom: 'Custom',
    unlimitedUnits: 'Unlimited units',
    upToUnits: (n) => `Up to ${n} units`,
    unlimitedSeats: 'Unlimited user seats',
    seatsLabel: (n) => `${n} user seat${n === 1 ? '' : 's'}`,
    overage: (price) => `${price} per unit beyond cap`,
    ctaSales: 'Talk to sales',
    ctaDemo: 'Book a 20-minute demo',
    ctaSignUp: 'Sign Up — free',
    mostChosen: 'Most chosen',
    everythingIn: (label) => `Everything in ${label}`,
    footnote:
      'All tiers include SOC 2 Type II, append-only audit trail, and the seven red-line guarantees. Billed monthly in TZS. Cancel any time. No card needed to sign up.',
    featureBullets: {
      mwikilaChat: 'Mr. Mwikila chat',
      mpesaCollection: 'M-Pesa rent collection',
      doubleEntryLedger: 'Double-entry ledger',
      cryptoAudit: 'Cryptographic audit',
      swahiliEnglish: 'Swahili + English',
      tenantOnboarding: 'Tenant onboarding',
      maintenanceTriage: 'Maintenance triage',
      ownerStatements: 'Owner statements',
      leaseTitleRegistry: 'Lease + title registry',
      vendorDispatch: 'Vendor + handyman dispatch',
      multiCurrency: 'Multi-currency (TZS/KES/USD)',
      regulatoryCalendar: 'Regulatory calendar',
      rentForecasts: 'Rent-rate forecasts',
      prioritySupport: 'Priority support 4-hr SLA',
      masterBrainLmbm: 'Master Brain + LMBM',
      treasurySweep: 'Treasury sweep + escrow',
      housingRegulator: 'Housing-regulator e-filing',
      ssoScim: 'SSO / SCIM provisioning',
      dedicatedSuccess: 'Dedicated success manager',
      crossTenantPattern: 'Cross-tenant pattern library',
      onPremPrivate: 'On-prem / private cloud',
      slaSre: '99.95% SLA + named SRE',
      customAuditReports: 'Custom audit + reports',
      multiCountryMultiCurrency: 'Multi-country, multi-currency',
    },
  },
  sw: {
    kicker: '09 · Bei',
    headline: 'Madaraja matano. TZS kama msingi. Hakuna mshangao.',
    subOne: 'Kutoka daraja la bure la Mkulima — kwa mmiliki mmoja wa nyumba — hadi Group, kwa REIT za mataifa mengi.',
    subTwo: 'Kila daraja linatoa ubongo wa Bw. Mwikila, mnyororo wa ukaguzi, na kiolesura cha lugha mbili sw/en.',
    perPortfolioPerMonth: 'kwa portfolio · kwa mwezi',
    tailoredToYourPortfolio: 'iliyobinafsishwa kwa portfolio yako',
    free: 'Bure',
    custom: 'Maalum',
    unlimitedUnits: 'Vyumba bila kikomo',
    upToUnits: (n) => `Hadi vyumba ${n}`,
    unlimitedSeats: 'Viti vya watumiaji bila kikomo',
    seatsLabel: (n) => `Viti ${n} vya watumiaji`,
    overage: (price) => `${price} kwa kila chumba zaidi ya kikomo`,
    ctaSales: 'Ongea na timu ya mauzo',
    ctaDemo: 'Weka onyesho la dakika 20',
    ctaSignUp: 'Jisajili — bure',
    mostChosen: 'Linachaguliwa zaidi',
    everythingIn: (label) => `Yote yaliyomo katika ${label}`,
    footnote:
      'Madaraja yote yanajumuisha SOC 2 Type II, mnyororo wa ukaguzi usiobadilika, na dhamana saba za mstari mwekundu. Kulipwa kila mwezi kwa TZS. Acha wakati wowote. Hakuna kadi inayohitajika kujisajili.',
    featureBullets: {
      mwikilaChat: 'Mazungumzo na Bw. Mwikila',
      mpesaCollection: 'Ukusanyaji wa kodi kwa M-Pesa',
      doubleEntryLedger: 'Daftari la maingizo mawili',
      cryptoAudit: 'Ukaguzi wa kriptografia',
      swahiliEnglish: 'Kiswahili + Kiingereza',
      tenantOnboarding: 'Usajili wa wapangaji',
      maintenanceTriage: 'Upangaji wa matengenezo',
      ownerStatements: 'Taarifa za mmiliki',
      leaseTitleRegistry: 'Daftari la kodi na hati',
      vendorDispatch: 'Tuma wasambazaji + mafundi',
      multiCurrency: 'Sarafu nyingi (TZS/KES/USD)',
      regulatoryCalendar: 'Kalenda ya udhibiti',
      rentForecasts: 'Utabiri wa viwango vya kodi',
      prioritySupport: 'Msaada wa kipaumbele SLA ya saa 4',
      masterBrainLmbm: 'Ubongo Mkuu + LMBM',
      treasurySweep: 'Usimamizi wa hazina + escrow',
      housingRegulator: 'Uwasilishaji wa mdhibiti wa nyumba',
      ssoScim: 'SSO / SCIM provisioning',
      dedicatedSuccess: 'Meneja wa mafanikio aliyepewa',
      crossTenantPattern: 'Maktaba ya mifumo ya wapangaji',
      onPremPrivate: 'On-prem / wingu binafsi',
      slaSre: 'SLA ya 99.95% + SRE aliyetajwa',
      customAuditReports: 'Ukaguzi maalum + ripoti',
      multiCountryMultiCurrency: 'Nchi nyingi, sarafu nyingi',
    },
  },
};

function ctaCopy(tier: PricingTier, copy: PricingCopy): { href: string; label: string } {
  if (tier.ctaKey === 'sales') {
    return { href: '/contact', label: copy.ctaSales };
  }
  if (tier.ctaKey === 'demo') {
    return { href: '/book-demo', label: copy.ctaDemo };
  }
  return { href: '/sign-up', label: copy.ctaSignUp };
}

function priceCopy(tier: PricingTier, copy: PricingCopy): { primary: string; unit: string } {
  if (tier.priceMonthlyTzs === 'custom') {
    return { primary: copy.custom, unit: copy.tailoredToYourPortfolio };
  }
  if (tier.priceMonthlyTzs === 0) {
    return { primary: copy.free, unit: copy.perPortfolioPerMonth };
  }
  return {
    primary: formatCurrency(tier.priceMonthlyTzs, 'TZS'),
    unit: copy.perPortfolioPerMonth,
  };
}

function capCopy(tier: PricingTier, copy: PricingCopy): string {
  if (tier.unitCap === 'unlimited') return copy.unlimitedUnits;
  return copy.upToUnits(formatNumber(tier.unitCap));
}

function seatsCopy(tier: PricingTier, copy: PricingCopy): string {
  if (tier.seats === 'unlimited') return copy.unlimitedSeats;
  return copy.seatsLabel(tier.seats);
}

function overageCopy(tier: PricingTier, copy: PricingCopy): string | null {
  if (tier.perUnitTzs === 'custom') return null;
  if (tier.perUnitTzs === 0) return null;
  return copy.overage(formatCurrency(tier.perUnitTzs, 'TZS'));
}

function tierFeatureBullets(
  position: PricingTier['position'],
  copy: PricingCopy,
): readonly string[] {
  const b = copy.featureBullets;
  const labels = {
    smallholder: tierLabel(TIERS[0], localeFromCopy(copy)),
    family: tierLabel(TIERS[1], localeFromCopy(copy)),
    professional: tierLabel(TIERS[2], localeFromCopy(copy)),
    corporate: tierLabel(TIERS[3], localeFromCopy(copy)),
  };
  switch (position) {
    case 1:
      return [
        b.mwikilaChat,
        b.mpesaCollection,
        b.doubleEntryLedger,
        b.cryptoAudit,
        b.swahiliEnglish,
      ];
    case 2:
      return [
        copy.everythingIn(labels.smallholder),
        b.tenantOnboarding,
        b.maintenanceTriage,
        b.ownerStatements,
        b.leaseTitleRegistry,
      ];
    case 3:
      return [
        copy.everythingIn(labels.family),
        b.vendorDispatch,
        b.multiCurrency,
        b.regulatoryCalendar,
        b.rentForecasts,
        b.prioritySupport,
      ];
    case 4:
      return [
        copy.everythingIn(labels.professional),
        b.masterBrainLmbm,
        b.treasurySweep,
        b.housingRegulator,
        b.ssoScim,
        b.dedicatedSuccess,
      ];
    case 5:
      return [
        copy.everythingIn(labels.corporate),
        b.crossTenantPattern,
        b.onPremPrivate,
        b.slaSre,
        b.customAuditReports,
        b.multiCountryMultiCurrency,
      ];
    default:
      return [];
  }
}

/**
 * Reverse-lookup the locale that produced a given COPY object. Used by
 * helper functions that only receive `copy` (avoids re-threading
 * `locale` through six helpers).
 */
function localeFromCopy(copy: PricingCopy): Locale {
  return copy === COPY.sw ? 'sw' : 'en';
}

export interface PricingProps {
  readonly locale?: Locale;
}

export function Pricing({ locale = DEFAULT_LOCALE }: PricingProps = {}) {
  const copy = COPY[locale] ?? COPY[DEFAULT_LOCALE];
  return (
    <section
      className="relative mx-auto max-w-7xl px-6 pb-24 pt-4 lg:px-8"
      id="pricing"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          {copy.kicker}
        </p>
        <h2 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          {copy.headline}
        </h2>
        <p className="mx-auto mt-5 max-w-prose-wide text-lg leading-relaxed text-neutral-500">
          {copy.subOne} {copy.subTwo}
        </p>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {TIERS.map((tier) => {
          const label = tierLabel(tier, locale);
          const cta = ctaCopy(tier, copy);
          const price = priceCopy(tier, copy);
          const overage = overageCopy(tier, copy);
          return (
            <article
              key={tier.id}
              className={[
                'flex flex-col rounded-2xl border p-6 transition-all duration-base ease-out',
                tier.highlighted
                  ? 'border-signal-500/40 bg-surface ring-1 ring-signal-500/30 shadow-[0_0_48px_-16px_hsl(var(--signal-500)/0.35)]'
                  : 'border-border bg-surface',
              ].join(' ')}
              aria-label={`Tier ${tier.position}: ${label}`}
            >
              <header>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-[0.62rem] uppercase tracking-widest text-neutral-500">
                      T{tier.position}
                    </p>
                    <h3 className="mt-0.5 font-display text-2xl font-medium tracking-tight">
                      {label}
                    </h3>
                  </div>
                  {tier.highlighted && (
                    <span className="rounded-full bg-signal-500/15 px-2 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-signal-500">
                      {copy.mostChosen}
                    </span>
                  )}
                </div>
                <p className="mt-2 min-h-[2.5rem] text-xs leading-snug text-neutral-500">
                  {tier.tagline[locale]}
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
                  <li>{capCopy(tier, copy)}</li>
                  <li>{seatsCopy(tier, copy)}</li>
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
                {tierFeatureBullets(tier.position, copy).map((featureLabel) => (
                  <li key={featureLabel} className="flex items-start gap-2 text-xs leading-relaxed">
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-500"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                    <span className="text-foreground">{featureLabel}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <p className="mt-10 text-center text-xs text-neutral-500">
        {copy.footnote}
      </p>
    </section>
  );
}
