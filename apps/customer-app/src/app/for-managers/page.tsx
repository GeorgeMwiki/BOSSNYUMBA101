/**
 * /for-managers — landing page for property / estate managers.
 * Emphasises the "200 units single-handed" promise.
 */

import { getTranslations } from 'next-intl/server';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';

export const metadata = {
  title: 'For Managers — BOSSNYUMBA',
  description:
    'Manage 200 units single-handed. Owner reports, vendor dispatch, and a copilot who drafts before you ask.',
};

export default async function ForManagersPage() {
  const t = await getTranslations('forManagers');
  return (
    <MarketingShell
      title={t('heroTitle')}
      subtitle={t('heroSubtitle')}
      heroCtaLabel={t('heroCta')}
    >
      <FeatureGrid
        heading="What a manager actually gets"
        items={[
          {
            stat: 'Month-end: 6d -> 90min',
            title: 'Owner reports on schedule, every 1st',
            body: 'Every owner in your book gets their report on the 1st — already written, already reconciled. You review, edit if you want, approve. Cuts month-end from days to an hour.',
          },
          {
            stat: 'Triage 23 cases in 20 min',
            title: 'Arrears dashboard across your entire book',
            body: 'Every arrears case across all owners, sorted by severity, each with a pre-drafted recommended action, the tenant 5P history, and eligibility for a payment plan.',
          },
          {
            stat: 'Vendor dispatch <5 min',
            title: 'Maintenance taxonomy + vendor routing',
            body: 'A tenant reports a leaking tap. Mr. Mwikila classifies it, picks the right vendor from your roster, sends you the quote range, and dispatches once you approve.',
          },
          {
            stat: 'Compliance: 12 owners = 12 calendars',
            title: 'Compliance calendars per owner',
            body: 'Each owner has a different tax residency, VAT status, and license renewal cadence. Mr. Mwikila keeps a separate calendar per owner and surfaces the next action each morning.',
          },
          {
            stat: 'Lease drafting: 90 seconds',
            title: 'Lease + renewal drafting with local nuance',
            body: 'Tell Mr. Mwikila the unit, tenant, and rent, and he drafts a lease that references the right local tenancy law. You sign, tenant signs, stored in the ledger.',
          },
          {
            stat: '+3 owners without new hires',
            title: 'Scale your book without scaling your headcount',
            body: 'A manager on BOSSNYUMBA handles 3x the unit count without breaking. New owner onboarding takes 2 hours, not 2 weeks.',
          },
        ]}
      />

      <section className="mb-16 rounded-xl border border-emerald-200 bg-emerald-50 p-8">
        <h2 className="mb-3 text-2xl font-semibold text-emerald-900">
          Starting your own management company?
        </h2>
        <p className="mb-4 text-emerald-900/80">
          Day one you get lease templates, owner reports, maintenance dispatch, and a white-label
          portal so owners see your brand. $79/month for 50 units means you look like a 10-person
          firm with a one-person cost base.
        </p>
        <a
          href="/"
          className="inline-flex items-center rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Walk me through the first 90 days
        </a>
      </section>
    </MarketingShell>
  );
}
