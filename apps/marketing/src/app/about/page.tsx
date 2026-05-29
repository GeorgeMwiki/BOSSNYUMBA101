import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/shared/PageShell';
import { MwikilaChip } from '@/components/shared/MwikilaChip';

export const metadata: Metadata = {
  title: 'About Boss Nyumba — built in Tanzania for African real estate',
  description:
    "Boss Nyumba is an AI-native operating system for landlords, tenants, and property managers in Tanzania and East Africa. Built in Dar es Salaam, Swahili-first, audit-grade, M-Pesa native.",
};

const SECTIONS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Why BossNyumba exists',
    body:
      'East African rental markets lose an estimated 18% of annual rent to manual chase, missing receipts, and disputes that never settle. Council-levy filings are paper-and-WhatsApp. Tenants pay over M-Pesa and walk away with no proof. Landlords keep books on phones that get replaced every two years. Boss Nyumba collapses that broken stack into one AI-native operating system — Mr. Mwikila, your AI Property Operations Manager, runs the business end-to-end alongside the owner.',
  },
  {
    title: 'Who we serve',
    body:
      "Individual landlords with two units in Kinondoni and family portfolios across Mwanza. Professional property managers running 250-unit blocks in Arusha. REIT executives consolidating five entities across Tanzania and Kenya. Tenants signing leases in Mbeya, and leasing agencies placing bank-relocation prospects in Dar. Cooperatives transparently running their own buildings. Housing regulators wanting live signal instead of yearly surveys.",
  },
  {
    title: 'How we build',
    body:
      "Boss Nyumba is multi-tenant by design. Every query is scoped by tenant id end-to-end. Storage is regional, encrypted at rest, with cryptographic audit-hash chains on every rent receipt, lease, and dispute. We default to Swahili and toggle to English — two languages, one source of truth. M-Pesa, Tigo Pesa, Airtel Money, and bank rails are native, not bolted on. Open-source where we can be, proprietary where compliance demands.",
  },
  {
    title: 'Where we are based',
    body:
      'Headquartered in Dar es Salaam, with field operators across Arusha, Mwanza, Mbeya, Nairobi, and Mombasa. Our team is East-African-led, property-experienced, and obsessed with closing the gap between landlords, tenants, banks, and regulators.',
  },
  {
    title: 'Meet Mr. Mwikila',
    body:
      "Mr. Mwikila is the canonical user-facing identity of the Boss Nyumba brain. One Mr. Mwikila per portfolio, knowing everything about it — leases, tenants, maintenance, council levies, owner statements, multi-currency cashflow. He speaks Swahili by default and switches to English on request. He never pretends to be human; the chat header always reads \"Mr. Mwikila — Boss Nyumba's AI Property Operations Manager\".",
  },
];

export default function AboutPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          About
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          The AI operating system for East African real estate.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-neutral-300">
          Boss Nyumba is built in Dar es Salaam, for the property sector
          that houses the continent. We replace WhatsApp rent chase,
          paper leases, and ad-hoc bookkeeping with one Master Brain
          that runs the portfolio with the owner.
        </p>
        <div className="mt-6">
          <MwikilaChip />
        </div>

        <div className="mt-12 space-y-8 text-sm leading-relaxed text-neutral-400">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {s.title}
              </h2>
              <p className="mt-3">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap gap-3">
          <Link
            href="/sign-up"
            className="rounded-md bg-signal-500 px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-signal-400"
          >
            Sign Up
          </Link>
          <Link
            href="/for-tenant"
            className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
          >
            For tenants
          </Link>
          <Link
            href="/for-portfolio-landlord"
            className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
          >
            For portfolio landlords
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
