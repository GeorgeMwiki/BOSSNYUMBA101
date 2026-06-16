import type { Metadata } from 'next';
import { getLocale } from '@/lib/locale';
import Link from 'next/link';
import { MessageSquare, Mail } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Nyaraka — BossNyumba',
      description:
        'Nyaraka za BossNyumba bado zinaandaliwa. Kwa sasa, muulize Mwl. Mwikila ndani ya programu au mtumie barua pepe timu ya nyaraka.',
    };
  }
  return {
    title: 'Documentation — BossNyumba',
    description:
      'BossNyumba documentation is being written. Ask Mr. Mwikila in the app or email the docs team in the meantime.',
  };
}

export default function DocsIndexPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">Documentation</p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          The docs are being written.
        </h1>
        <p className="mt-6 max-w-prose-wide text-lg leading-relaxed text-foreground/75">
          We are writing the getting-started guides, M-Pesa connector notes, API reference, and
          security docs now. While they land, the fastest way to get an answer is to ask Mr. Mwikila
          in the app — he answers most questions directly — or email the team.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <Link
            href="/sign-in"
            className="group flex h-full flex-col rounded-2xl border border-signal-500/40 bg-surface p-6 ring-1 ring-signal-500/20 transition-all hover:bg-surface-raised"
          >
            <MessageSquare className="h-5 w-5 text-signal-500" aria-hidden="true" />
            <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-signal-500">
              Ask Mr. Mwikila
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              Open the in-app chat. Mr. Mwikila walks you through setup, payments, and any workflow
              — in Swahili or English.
            </p>
          </Link>
          <a
            href="mailto:docs@bossnyumba.com"
            className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-6 transition-all hover:border-signal-500/40 hover:bg-surface-raised"
          >
            <Mail className="h-5 w-5 text-signal-500" aria-hidden="true" />
            <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-signal-500">
              Email the docs team
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              Write to docs@bossnyumba.com. We read every message and will point you to the right
              person or guide.
            </p>
          </a>
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Looking for security or compliance?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Our{' '}
            <Link href="/security" className="text-signal-500 hover:underline">
              security posture
            </Link>{' '}
            and{' '}
            <Link href="/trust" className="text-signal-500 hover:underline">
              trust centre
            </Link>{' '}
            are published today — audit trail, tenant isolation, the seven red-line guarantees, and
            our certification status.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
