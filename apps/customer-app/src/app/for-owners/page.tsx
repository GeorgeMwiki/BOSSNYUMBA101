/**
 * /for-owners — landing page for property owners.
 *
 * Mr. Mwikila voice. Floating chat widget is already mounted by the
 * root layout; every CTA on this page just deep-links to / which
 * auto-opens the chat in owner context.
 */

import { getTranslations } from 'next-intl/server';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';

export const metadata = {
  title: 'For Owners — BossNyumba',
  description:
    'Automate the grind, keep the judgement. Rent reminders, M-Pesa reconciliation, and owner-grade reports in one place.',
};

export default async function ForOwnersPage() {
  const t = await getTranslations('forOwners');
  return (
    <MarketingShell
      title={t('heroTitle')}
      subtitle={t('heroSubtitle')}
      heroCtaLabel={t('heroCta')}
    >
      <FeatureGrid
        heading="What changes in your week"
        items={[
          {
            stat: 'Arrears age: 45d -> 12d',
            title: 'Rent reminders on autopilot',
            body: 'Three-stage cascade (pre-due, due date, post-due) with one-tap M-Pesa/Airtel/Azam deep-links. 70% of late rent self-resolves before you lift a finger.',
          },
          {
            stat: 'Reconciliation: 94% automatic',
            title: 'Mobile-money reconciliation that just works',
            body: 'Drop your M-Pesa/Airtel/Azam statements. Mr. Mwikila matches deposits to invoices by amount, phone hash, and reference. You confirm the 6% that is fuzzy.',
          },
          {
            stat: 'Owner reports: 90 seconds',
            title: 'Monthly owner reports generate themselves',
            body: 'The 1st of every month, a 3-page owner report lands in your inbox — executive summary, line items, and a "what I recommend next month" section. Review, sign, send.',
          },
          {
            stat: 'Vacancy fill: -18 days',
            title: 'Vacancy forecast 60 days out',
            body: 'Mr. Mwikila watches lease end dates, tenant 5P scores, and local market signals. You get a 60-day heads-up on every likely vacancy with a recommended listing plan.',
          },
          {
            stat: 'Compliance: zero missed',
            title: 'Compliance plugins ship KE / TZ / UG out of the box',
            body: 'KRA VAT return, TRA monthly filing, URA license renewals — all pre-filled from your ledger. No accountant gymnastics.',
          },
          {
            stat: '3x officer productivity',
            title: 'Your estate officer covers more ground',
            body: 'A human officer with BossNyumba handles 60-80 units; without it, 20-30 is the ceiling. You do not replace the human — you let them do the human part.',
          },
        ]}
      />

      <section className="mb-16 rounded-xl border border-emerald-200 bg-emerald-50 p-8">
        <h2 className="mb-3 text-2xl font-semibold text-emerald-900">
          How I would change your Monday
        </h2>
        <p className="mb-4 text-emerald-900/80">
          Tell me how many units you run and I will walk you through a specific week. Five blocks
          in Dar? 20 doors in Karen? Three mixed-use buildings in Kampala? All different — and I
          will give you a concrete answer to each.
        </p>
        <a
          href="/"
          className="inline-flex items-center rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Ask Mr. Mwikila
        </a>
      </section>
    </MarketingShell>
  );
}
