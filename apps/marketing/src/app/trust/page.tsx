import type { Metadata } from 'next';
import { getLocale } from '@/lib/locale';
import Link from 'next/link';
import { ShieldCheck, FileSearch, Lock, Activity } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kituo cha uaminifu — BossNyumba',
      description:
        'Kituo cha uaminifu. Vidhibiti vya SOC 2 / ISO 27001 vimewekwa (uthibitishaji unaendelea), msimamo wa Sheria ya TZ ya Ulinzi wa Data Binafsi (DPA) na GDPR, mnyororo wa ukaguzi uliosimbwa kwa njia ya fiche, kistasha cha dharura, wachakataji-wadogo, na dhamana saba za mstari mwekundu.',
    };
  }
  return {
    title: 'Trust centre — BossNyumba',
    description:
      'Trust centre. SOC 2 / ISO 27001 controls in place (certification in progress), TZ DPA + GDPR posture, cryptographic audit chain, kill-switch, sub-processors, and the seven red-line guarantees.',
  };
}

const PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Controls in place',
    body: 'Built to SOC 2 / ISO 27001 controls — certification in progress. Aligned with TZ DPA, KE DPA, and GDPR.',
  },
  {
    icon: FileSearch,
    title: 'Auditable',
    body: 'Append-only hash-chained audit log on every rent receipt, lease, dispute, and Mr. Mwikila action. Exportable.',
  },
  {
    icon: Lock,
    title: 'Encrypted',
    body: 'AES-256 at rest. TLS 1.3 in transit. Row-level security on every tenant-scoped table.',
  },
  {
    icon: Activity,
    title: 'Observable',
    body: 'System status published at /status. Sev-1 + Sev-2 post-mortems published. Live telemetry board coming.',
  },
];

export default function TrustPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">Trust centre</p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          How we earn the trust to manage your rent.
        </h1>
        <p className="mt-6 max-w-prose-wide text-lg leading-relaxed text-foreground/75">
          Property data is sensitive. Rent flows are real money. BossNyumba is built to be auditable
          from day one — not certified after the fact.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {PILLARS.map((p) => (
            <article
              key={p.title}
              className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6"
            >
              <p.icon className="h-5 w-5 text-signal-500" aria-hidden="true" />
              <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
                {p.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">{p.body}</p>
            </article>
          ))}
        </div>

        <h2 className="mt-16 font-display text-2xl font-semibold tracking-tight text-foreground">
          The seven red-line guarantees
        </h2>
        <p className="mt-3 max-w-prose-wide text-sm leading-relaxed text-foreground/70">
          There are seven things BossNyumba will never do, regardless of how the autonomy dial is
          configured.
        </p>
        <ol className="mt-6 list-decimal space-y-3 pl-6 text-sm leading-relaxed text-foreground/70">
          <li>We will not evict a tenant without the owner&apos;s explicit signature.</li>
          <li>We will not move money without policy-approved authorisation.</li>
          <li>We will not file with a regulator without owner consent.</li>
          <li>We will not delete or modify an audit log entry.</li>
          <li>We will not bypass the kill-switch in any code path.</li>
          <li>We will not act on a HIGH-risk policy prefix without a literal policy rule.</li>
          <li>We will not share tenant or owner data with third parties without consent.</li>
        </ol>

        <div className="mt-16 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Audit + compliance documents
          </h2>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-foreground/70">
            <li>
              <Link href="/security" className="text-signal-500 hover:underline">
                Security policy
              </Link>{' '}
              and{' '}
              <Link href="/legal" className="text-signal-500 hover:underline">
                sub-processors
              </Link>
            </li>
            <li>
              Control summaries and compliance status — request from{' '}
              <a href="mailto:trust@bossnyumba.com" className="text-signal-500 hover:underline">
                trust@bossnyumba.com
              </a>
            </li>
            <li>
              <Link href="/dpa" className="text-signal-500 hover:underline">
                Data Processing Agreement
              </Link>
            </li>
            <li>
              <Link href="/status" className="text-signal-500 hover:underline">
                System status
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
