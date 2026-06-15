import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/shared/PageShell';

export const metadata: Metadata = {
  title: 'Legal — BossNyumba',
  description:
    'Terms of service, privacy notice, data processing agreement, sub-processors, acceptable use, security policy, and SLA. Bilingual sw/en where applicable.',
};

interface LegalDoc {
  readonly title: string;
  readonly href: string;
  readonly summary: string;
  readonly updated: string;
}

const DOCS: ReadonlyArray<LegalDoc> = [
  { title: 'Terms of Service',           href: '/terms',         summary: "Your contract with BossNyumba. Plain-English first, EN binding.",         updated: '2026-04-01' },
  { title: 'Privacy Notice',             href: '/privacy',       summary: 'What we collect, how we use it, your rights. Aligned with TZ DPA + GDPR.', updated: '2026-04-01' },
  { title: 'Data Processing Agreement',  href: '/dpa',           summary: 'For enterprise customers processing personal data through BossNyumba.',   updated: '2026-04-01' },
  { title: 'Sub-processors',             href: '/legal/sub-processors', summary: 'Every vendor that processes data on our behalf.',                  updated: '2026-05-01' },
  { title: 'Acceptable Use',             href: '/legal/acceptable-use', summary: 'What you can and cannot do with BossNyumba.',                     updated: '2026-04-01' },
  { title: 'Security Policy',            href: '/security',      summary: 'How we secure the platform and respond to disclosures.',                 updated: '2026-05-15' },
  { title: 'Service Level Agreement',    href: '/legal/sla',     summary: 'Uptime commitments, support response, and remediation.',                 updated: '2026-04-01' },
  { title: 'Cookie Policy',              href: '/legal/cookies', summary: 'What we set, why, and how to opt out.',                                   updated: '2026-04-01' },
];

export default function LegalIndexPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          Legal
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          The legal corner.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground/75">
          Plain-English summaries first; binding documents second.
          Bilingual sw/en where applicable.
        </p>

        <ul className="mt-12 divide-y divide-border rounded-2xl border border-border bg-surface">
          {DOCS.map((doc) => (
            <li key={doc.title}>
              <Link
                href={doc.href}
                className="group block px-6 py-5 transition-colors hover:bg-surface-raised"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-display text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-signal-500">
                    {doc.title}
                  </h2>
                  <p className="font-mono text-[0.65rem] uppercase tracking-widest text-foreground/60 tabular-nums">
                    Updated {doc.updated}
                  </p>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/70">
                  {doc.summary}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
