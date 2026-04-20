/**
 * /pricing — tiered pricing page. Primary CTA is "talk to Mr. Mwikila
 * for a custom quote" rather than a self-serve button — the platform
 * is relationship-first.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata = {
  title: 'Pricing — BOSSNYUMBA',
  description:
    'Transparent pricing for East African estate portfolios. Starter at $19/month, Growth at $79, Estate at $249. Enterprise is custom — talk to Mr. Mwikila.',
};

interface Tier {
  readonly id: string;
  readonly name: string;
  readonly price: string;
  readonly ceiling: string;
  readonly audience: string;
  readonly includes: readonly string[];
  readonly featured?: boolean;
}

const TIERS: readonly Tier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$19 / month',
    ceiling: 'Up to 10 units',
    audience: 'Solo owners with a single block or a handful of doors.',
    includes: [
      'Rent + service-charge tracking',
      'M-Pesa / Airtel / Azam reconciliation',
      'Tenant + lease basics',
      '500 Mr. Mwikila turns / month',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$79 / month',
    ceiling: 'Up to 50 units',
    audience: 'Growing owners and small agencies running 11-50 units.',
    featured: true,
    includes: [
      'Everything in Starter',
      'Maintenance dispatch + vendor routing',
      'Scheduled owner reports',
      'Tenant 5P health scoring',
      '3,000 Mr. Mwikila turns / month',
    ],
  },
  {
    id: 'estate',
    name: 'Estate',
    price: '$249 / month',
    ceiling: 'Up to 250 units',
    audience: 'Estate managers and agencies running 51-250 units.',
    includes: [
      'Everything in Growth',
      'Multi-property dashboards',
      'IoT gate / meter integration',
      'Compliance plugins (KE, TZ, UG)',
      'Station-master voice-log module',
      '15,000 Mr. Mwikila turns / month',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    ceiling: '250+ units',
    audience: 'Portfolios above 250 units. Priced by scope.',
    includes: [
      'Everything in Estate',
      'Dedicated tenant instance',
      'Custom compliance plugins',
      'White-label portals',
      'SLA-backed support',
    ],
  },
];

export default async function PricingPage() {
  const t = await getTranslations('pricingPage');
  return (
    <MarketingShell
      title={t('heroTitle')}
      subtitle={t('heroSubtitle')}
      heroCtaLabel={t('heroCta')}
    >
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => (
          <article
            key={tier.id}
            className={`flex flex-col rounded-xl border p-6 shadow-sm ${
              tier.featured
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            {tier.featured && (
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Most common
              </div>
            )}
            <h3 className="mb-1 text-xl font-semibold text-slate-900">{tier.name}</h3>
            <div className="mb-2 text-2xl font-bold text-slate-900">{tier.price}</div>
            <div className="mb-4 text-sm text-slate-600">{tier.ceiling}</div>
            <p className="mb-4 text-sm text-slate-700">{tier.audience}</p>
            <ul className="mb-6 flex-1 space-y-2 text-sm text-slate-800">
              {tier.includes.map((inc) => (
                <li key={inc} className="flex gap-2">
                  <span className="text-emerald-600">+</span>
                  <span>{inc}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/"
              className={`rounded-lg px-4 py-2 text-center text-sm font-semibold ${
                tier.featured
                  ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                  : 'border border-slate-300 bg-white text-slate-800 hover:border-emerald-500'
              }`}
            >
              {tier.id === 'enterprise' ? 'Get a quote' : 'Ask Mr. Mwikila'}
            </Link>
          </article>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="mb-3 text-xl font-semibold">{t('numbersCompare')}</h2>
        <p className="mb-4 text-sm text-slate-700">
          A junior estate officer in Nairobi costs $300-$500/month fully loaded. BOSSNYUMBA does
          not replace the officer — it multiplies them. An officer with BOSSNYUMBA handles 60-80
          units; without it, 20-30 is the ceiling. Pricing is designed so the platform pays back
          inside month 2 for almost every portfolio we have modelled.
        </p>
        <p className="text-sm text-slate-700">
          Annual plans get a 2-month discount. Nonprofits and community-housing operators get 40%
          off — ask Mr. Mwikila about the community rate.
        </p>
      </section>
    </MarketingShell>
  );
}
