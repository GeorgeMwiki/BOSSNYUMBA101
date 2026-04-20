/**
 * /for-tenants — landing page for tenants. Emphasises transparency,
 * Swahili-first UX, and receipts/maintenance in one place.
 */

import { MarketingShell } from '@/components/marketing/MarketingShell';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';

export const metadata = {
  title: 'For Tenants — BOSSNYUMBA',
  description:
    'Receipts, maintenance tickets, and notices in one place. Bilingual English + Swahili. Your landlord and you see the same truth.',
};

export default function ForTenantsPage() {
  return (
    <MarketingShell
      title="Your home, on your terms."
      subtitle="Every shilling of rent you pay shows up in your own dashboard. Every maintenance request has a timeline. Every notice comes in English or Swahili — your choice. BOSSNYUMBA gives you the same truth your landlord sees."
      heroCtaLabel="See what a tenant dashboard looks like"
    >
      <FeatureGrid
        heading="What it does for you"
        items={[
          {
            stat: 'Every payment, logged',
            title: 'Receipts that never get lost',
            body: 'Every rent, service-charge, or deposit payment lands with a receipt in your app — downloadable, emailable, timestamped. No more WhatsApp hunting when a dispute flares.',
          },
          {
            stat: 'Track maintenance in real time',
            title: 'Maintenance requests with a real timeline',
            body: 'Report an issue with photos, see when it was opened, who was dispatched, the quote, the work, the result. If you do not agree with a charge, dispute in one tap.',
          },
          {
            stat: 'Swahili / English toggle',
            title: 'Truly bilingual — not Google Translated',
            body: 'Every notification, lease clause, and even Mr. Mwikila himself switch to Swahili with one toggle. Voice input works in Swahili too.',
          },
          {
            stat: 'Plan your rent, stay on track',
            title: 'Payment plans when you need them',
            body: 'Month tight? Propose a plan to split into two payments on agreed dates. Landlord approves in one tap. Your on-time record stays intact.',
          },
          {
            stat: 'Your 5P score follows you',
            title: 'Build a tenant reputation you own',
            body: 'On-time payments, clean maintenance history, and tidy conduct feed your tenant 5P score — portable to any BOSSNYUMBA landlord you rent from next.',
          },
          {
            stat: 'Notices you can read, not legalese',
            title: 'Notices in plain language',
            body: 'Rent increases, renewal proposals, and compliance notices arrive in plain Swahili or English with the numbers upfront. No fine print surprises.',
          },
        ]}
      />

      <section className="mb-16 rounded-xl border border-emerald-200 bg-emerald-50 p-8">
        <h2 className="mb-3 text-2xl font-semibold text-emerald-900">
          Honest answer for late-paying tenants
        </h2>
        <p className="mb-4 text-emerald-900/80">
          BOSSNYUMBA does not punish late rent — it makes it visible. You get friendly reminders
          with an M-Pesa link so you can pay at 11pm if that is when you have cash. If you are
          chronically short, the payment-plan flow works without an argument. Fair to both sides.
        </p>
        <a
          href="/"
          className="inline-flex items-center rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Ask Mr. Mwikila how plans work
        </a>
      </section>
    </MarketingShell>
  );
}
