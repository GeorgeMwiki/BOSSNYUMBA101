import type { Metadata } from 'next';
import { getLocale } from '@/lib/locale';
import Link from 'next/link';
import { ShieldCheck, FileSearch, Lock, KeyRound, AlertTriangle } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Usalama — BossNyumba',
      description:
        'Mkao wa usalama wa BossNyumba: njia ya ukaguzi iliyofungamanishwa kwa hash isiyofutika, utengaji wa mpangaji kwa kiwango cha safu, dhamana saba za mstari mwekundu, kifa-funga kinachosalia salama kinapozimwa, na ufichuzi wa kuwajibika. Imejengwa kwa vidhibiti vya SOC 2 / ISO 27001 — uthibitishaji unaendelea.',
    };
  }
  return {
    title: 'Security — BossNyumba',
    description:
      'BossNyumba security posture: append-only hash-chained audit trail, row-level tenant isolation, the seven red-line guarantees, kill-switch fail-closed, and responsible disclosure. Built to SOC 2 / ISO 27001 controls — certification in progress.',
  };
}

interface Pillar {
  readonly icon: typeof ShieldCheck;
  readonly title: string;
  readonly body: string;
}

const PILLARS: ReadonlyArray<Pillar> = [
  {
    icon: FileSearch,
    title: 'Append-only audit trail',
    body: 'Every rent receipt, lease, dispute, and Mr. Mwikila action is written to a cryptographic hash-chained log. Entries are append-only — nothing can be edited or deleted after the fact — and the chain is exportable for your own review.',
  },
  {
    icon: Lock,
    title: 'Tenant isolation by row-level security',
    body: 'Every tenant-scoped table is protected by force-enabled row-level security in the database, bound to the request tenant on the server. One organisation can never read another’s data, even if application code has a bug.',
  },
  {
    icon: KeyRound,
    title: 'Encryption + access control',
    body: 'Encrypted at rest and in transit. Canonical authentication via signed tokens, scoped per tenant. Money movement is policy-gated and routed through four-eye approval for high-risk actions; the kill-switch is fail-closed and cannot be bypassed in any code path.',
  },
  {
    icon: ShieldCheck,
    title: 'Controls posture',
    body: 'BossNyumba is built to SOC 2 / ISO 27001 controls, and aligned with the Tanzania DPA, Kenya DPA, and GDPR. Third-party certification is in progress — we publish our status honestly rather than claim a certificate we do not yet hold.',
  },
];

const RED_LINES: ReadonlyArray<string> = [
  'We will not evict a tenant without the owner’s explicit signature.',
  'We will not move money without policy-approved authorisation.',
  'We will not file with a regulator without owner consent.',
  'We will not delete or modify an audit log entry.',
  'We will not bypass the kill-switch in any code path.',
  'We will not act on a HIGH-risk policy prefix without a literal policy rule.',
  'We will not share tenant or owner data with third parties without consent.',
];

export default function SecurityPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">Security</p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          How we protect your rent, your tenants, and your books.
        </h1>
        <p className="mt-6 max-w-prose-wide text-lg leading-relaxed text-foreground/75">
          Property data is sensitive and rent flows are real money. BossNyumba is built to be
          auditable from day one — isolated per tenant, hash-chained, and fail-closed on anything
          that touches money or a regulator.
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
          {RED_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>

        <div className="mt-16 rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-signal-500" aria-hidden="true" />
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                Report a vulnerability
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                Found a security issue? Email{' '}
                <a
                  href="mailto:security@bossnyumba.com"
                  className="text-signal-500 hover:underline"
                >
                  security@bossnyumba.com
                </a>
                . We acknowledge responsible disclosures within four hours and will keep you updated
                through remediation. Please do not publicly disclose until we have confirmed a fix.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-8 text-sm leading-relaxed text-foreground/70">
          For our wider compliance posture, sub-processors, and the Data Processing Agreement, see
          the{' '}
          <Link href="/trust" className="text-signal-500 hover:underline">
            trust centre
          </Link>
          .
        </p>
      </div>
    </PageShell>
  );
}
