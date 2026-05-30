import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  Code,
  Layers,
  ScrollText,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';

export const metadata: Metadata = {
  title: 'Documentation — Boss Nyumba',
  description:
    'Get started, integrate, and operate Boss Nyumba. API reference, M-Pesa connector, audit chain, autonomy dial, and platform architecture.',
};

interface DocSection {
  readonly icon: typeof BookOpen;
  readonly title: string;
  readonly body: string;
  readonly href: string;
}

const SECTIONS: ReadonlyArray<DocSection> = [
  {
    icon: BookOpen,
    title: 'Getting started',
    body: 'Sign up, add your first property, take your first rent payment over M-Pesa. Fifteen minutes.',
    href: '/docs/getting-started',
  },
  {
    icon: Layers,
    title: 'Concepts',
    body: 'Autonomy dial, Master Brain, LMBM, Mr. Mwikila modes, audit chain, the seven red-lines.',
    href: '/docs/concepts',
  },
  {
    icon: Wallet,
    title: 'M-Pesa + payments',
    body: 'Connect M-Pesa, Tigo Pesa, Airtel Money. Reconciliation. Disbursements. Multi-currency.',
    href: '/docs/payments',
  },
  {
    icon: Code,
    title: 'API reference',
    body: 'Hono-style REST API. Auth, properties, tenants, leases, ledger, webhooks. OpenAPI spec.',
    href: '/docs/api',
  },
  {
    icon: ShieldCheck,
    title: 'Security + compliance',
    body: 'SOC 2 Type II, ISO 27001, TZ DPA, GDPR. Audit chain, RLS, kill-switch, four-eyes.',
    href: '/docs/security',
  },
  {
    icon: ScrollText,
    title: 'Workflows',
    body: 'Tenant onboarding, maintenance triage, owner statements, regulator filings, AGM voting.',
    href: '/docs/workflows',
  },
];

export default function DocsIndexPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          Documentation
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Everything you need to run Boss Nyumba.
        </h1>
        <p className="mt-6 max-w-prose-wide text-lg leading-relaxed text-foreground/75">
          End-user guides, integration docs, API reference, and security
          policy — all in one place. Swahili and English. The chat
          widget asks Mr. Mwikila when the docs don&apos;t answer.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <Link
              key={s.title}
              href={s.href}
              className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-6 transition-all hover:border-signal-500/40 hover:bg-surface-raised"
            >
              <s.icon className="h-5 w-5 text-signal-500" aria-hidden="true" />
              <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-signal-500">
                {s.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                {s.body}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Need a human?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Email{' '}
            <a href="mailto:docs@bossnyumba.com" className="text-signal-500 hover:underline">
              docs@bossnyumba.com
            </a>{' '}
            or open the in-app chat. Mr. Mwikila handles most questions;
            we read every escalation.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
