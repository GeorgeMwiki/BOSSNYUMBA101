/**
 * /for-station-masters — landing for watchmen, caretakers, site supervisors.
 * Voice-first + offline-first is the pitch.
 */

import { getTranslations } from 'next-intl/server';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';

export const metadata = {
  title: 'For Station Masters — BOSSNYUMBA',
  description:
    'Voice-first incident logging in Swahili. Offline when connectivity dies. Your work, finally visible to the manager.',
};

export default async function ForStationMastersPage() {
  const t = await getTranslations('forStationMasters');
  return (
    <MarketingShell
      title={t('heroTitle')}
      subtitle={t('heroSubtitle')}
      heroCtaLabel={t('heroCta')}
    >
      <FeatureGrid
        heading="What the app does on your phone"
        items={[
          {
            stat: 'Swahili voice -> structured ticket',
            title: 'Log an incident in 30 seconds of speech',
            body: 'Open the app, tap record, speak in Swahili what happened. "Gari la bluu iliingia saa tano usiku, haijatoka." Mr. Mwikila turns that into a structured incident with time, plate, action.',
          },
          {
            stat: 'Offline for hours, no data lost',
            title: 'Works without the internet',
            body: 'The app queues photos, voice notes, and meter readings locally. When you get a signal — 3G, WiFi, or the estate router — everything syncs in seconds.',
          },
          {
            stat: 'Meter read -> ledger in 1 tap',
            title: 'Meter readings become invoices automatically',
            body: 'Snap the meter, tap the unit. The reading lands in the tenant ledger as a billable utility item. No more paper notebooks, no more tenant disputes.',
          },
          {
            stat: 'Photo-first reports the manager reads',
            title: 'Reports the manager actually acts on',
            body: 'Every incident you log goes straight to the manager with your photos + voice note attached. No more reports stuck at the gate waiting for someone to ask.',
          },
          {
            stat: 'Simple interface, no training',
            title: 'Big buttons, no jargon',
            body: 'The station-master view is 4 big buttons: log incident, read meter, open gate log, send to manager. No tabs, no menus, no forms. Works in low light.',
          },
          {
            stat: 'Your work counts toward your 5P record',
            title: 'Your performance finally visible',
            body: 'The platform tracks your logs, your response time, your clean audit. Good station masters get a portable 5P record they can show when they want a new posting.',
          },
        ]}
      />

      <section className="mb-16 rounded-xl border border-emerald-200 bg-emerald-50 p-8">
        <h2 className="mb-3 text-2xl font-semibold text-emerald-900">
          Rural district, patchy signal, old phone?
        </h2>
        <p className="mb-4 text-emerald-900/80">
          The app runs on Android 7 and up, queues offline for days, and falls back to SMS for
          critical alerts. If you have 2G once a day, you are fine.
        </p>
        <a
          href="/"
          className="inline-flex items-center rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Ask about the offline flow
        </a>
      </section>
    </MarketingShell>
  );
}
