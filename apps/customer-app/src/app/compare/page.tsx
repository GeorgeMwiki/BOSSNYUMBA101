/**
 * /compare — fair side-by-side vs AppFolio, Yardi, spreadsheets.
 * Be honest, not dismissive. That builds more trust than any feature list.
 */

import { getTranslations } from 'next-intl/server';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata = {
  title: 'Compare — BOSSNYUMBA vs AppFolio vs Yardi vs spreadsheets',
  description:
    'An honest side-by-side. Where BOSSNYUMBA wins, where it does not, and when you should pick the competitor.',
};

interface Row {
  readonly criterion: string;
  readonly bossnyumba: string;
  readonly appfolio: string;
  readonly yardi: string;
  readonly spreadsheet: string;
}

const ROWS: readonly Row[] = [
  {
    criterion: 'Mobile-money reconciliation (M-Pesa, Airtel, Azam, GePG)',
    bossnyumba: 'Native — drop a statement, 94% auto-match',
    appfolio: 'Not supported',
    yardi: 'Not supported',
    spreadsheet: 'Manual',
  },
  {
    criterion: 'East African compliance plugins (KRA, TRA, URA)',
    bossnyumba: 'Out of the box',
    appfolio: 'Custom build',
    yardi: 'Custom build',
    spreadsheet: 'Your accountant',
  },
  {
    criterion: 'Swahili first-class UX + voice',
    bossnyumba: 'Full platform + voice',
    appfolio: 'English only',
    yardi: 'English only',
    spreadsheet: 'Whatever you type',
  },
  {
    criterion: 'AI copilot — drafts + acts, not just Q&A',
    bossnyumba: 'Mr. Mwikila is the product',
    appfolio: 'Assistant feature, bolted on',
    yardi: 'Beta assistant',
    spreadsheet: 'None',
  },
  {
    criterion: 'Fit for 200+ unit portfolios',
    bossnyumba: 'Yes — Estate / Enterprise tiers',
    appfolio: 'Yes — their sweet spot',
    yardi: 'Yes — the incumbent',
    spreadsheet: 'Falls apart after 40',
  },
  {
    criterion: 'Small landlord (under 20 units)',
    bossnyumba: '$19/month Starter',
    appfolio: 'Overkill + expensive',
    yardi: 'Overkill + expensive',
    spreadsheet: 'Fine if you are disciplined',
  },
  {
    criterion: 'Offline-first station-master app',
    bossnyumba: 'Yes — syncs on reconnect',
    appfolio: 'No',
    yardi: 'No',
    spreadsheet: 'Paper',
  },
  {
    criterion: 'Tenant self-service (receipts, disputes, plans)',
    bossnyumba: 'Full mobile app',
    appfolio: 'Portal',
    yardi: 'Portal',
    spreadsheet: 'None',
  },
];

export default async function ComparePage() {
  const t = await getTranslations('comparePage');
  return (
    <MarketingShell
      title={t('heroTitle')}
      subtitle={t('heroSubtitle')}
      heroCtaLabel={t('heroCta')}
    >
      <section className="mb-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-800">{t('criterion')}</th>
              <th className="px-4 py-3 text-left font-semibold text-emerald-700">BOSSNYUMBA</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">{t('appfolioHeader')}</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">{t('yardiHeader')}</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">{t('spreadsheet')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {ROWS.map((r) => (
              <tr key={r.criterion}>
                <td className="px-4 py-3 font-medium text-slate-800">{r.criterion}</td>
                <td className="px-4 py-3 text-emerald-800">{r.bossnyumba}</td>
                <td className="px-4 py-3 text-slate-700">{r.appfolio}</td>
                <td className="px-4 py-3 text-slate-700">{r.yardi}</td>
                <td className="px-4 py-3 text-slate-700">{r.spreadsheet}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-16 grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="mb-2 text-lg font-semibold">{t('pickAppfolio')}</h3>
          <p className="text-sm text-slate-700">
            You run 500+ US-based units, ACH is your primary rail, and US compliance is the point.
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="mb-2 text-lg font-semibold">{t('pickYardi')}</h3>
          <p className="text-sm text-slate-700">
            You need enterprise-grade accounting rigor across multiple jurisdictions and you have
            an IT team.
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="mb-2 text-lg font-semibold">{t('pickSpreadsheet')}</h3>
          <p className="text-sm text-slate-700">
            You are running under 10 units, collecting cash, and have no interest in AI.
            Spreadsheets are underrated.
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-8">
        <h2 className="mb-3 text-2xl font-semibold text-emerald-900">{t('pickBossnyumba')}</h2>
        <p className="mb-4 text-emerald-900/80">
          Your portfolio is in East Africa, your tenants speak Swahili or pay via M-Pesa, and you
          want the AI to be the product — not a toy bolted onto an old database. Between 8 units
          and 300, that is almost always us. Outside that band, we will tell you honestly.
        </p>
        <a
          href="/"
          className="inline-flex items-center rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Launch a live demo
        </a>
      </section>
    </MarketingShell>
  );
}
