import type { Metadata } from 'next';
import { getLocale } from '@/lib/locale';
import { PageShell } from '@/components/shared/PageShell';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Mkataba wa Uchakataji wa Data — BossNyumba',
      description:
        'Mkataba wa Uchakataji wa Data (DPA) kwa wateja wa kibiashara. Umeoanishwa na Sheria ya Ulinzi wa Data Binafsi ya Tanzania, GDPR, na Sheria ya Ulinzi wa Data ya Kenya.',
    };
  }
  return {
    title: 'Data Processing Agreement — BossNyumba',
    description:
      'Data Processing Agreement (DPA) for enterprise customers. Aligned with TZ DPA, GDPR, and the Kenya Data Protection Act.',
  };
}

export default function DpaPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-20 prose prose-invert prose-neutral lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">Legal · DPA</p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Data Processing Agreement.
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-foreground/60">
          Effective 2026-04-01 · Aligned with TZ DPA + GDPR + KE DPA
        </p>

        <p className="mt-8 text-lg leading-relaxed text-foreground/75">
          This DPA is incorporated by reference into the Terms of Service and applies whenever
          BossNyumba processes personal data on your behalf. For executed counterparts, email{' '}
          <a href="mailto:legal@bossnyumba.com" className="text-signal-500 hover:underline">
            legal@bossnyumba.com
          </a>
          .
        </p>

        <h2 className="mt-12 font-display text-xl font-semibold text-foreground">1. Roles</h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          You are the controller. BossNyumba is the processor. Our sub-processors (cloud, comms, AI
          infra) are listed at{' '}
          <a href="/legal/sub-processors" className="text-signal-500 hover:underline">
            /legal/sub-processors
          </a>
          .
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          2. Subject matter + duration
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          We process portfolio, tenant, and payment data for as long as your account is active and
          for the retention windows in the Privacy Notice.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          3. Security measures
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          See the{' '}
          <a href="/security" className="text-signal-500 hover:underline">
            Security Policy
          </a>
          . Encryption at rest (AES-256) and in transit (TLS 1.3). Row-level security on every
          tenant-scoped table. Cryptographic audit chain. Annual SOC 2 Type II audit.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          4. Sub-processors
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          You consent to the current sub-processors. We give 30 days&apos; notice before adding new
          sub-processors. You may object; if we cannot accommodate, you may terminate without
          penalty.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          5. International transfers
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          Primary processing is in EAT region. For transfers to the EU and US, we rely on Standard
          Contractual Clauses and (where applicable) the EU-US Data Privacy Framework.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          6. Audit rights
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          On the Corporate and Group tiers, you may audit our compliance once per calendar year, on
          30 days&apos; notice, at your cost. SOC 2 Type II report satisfies the audit obligation.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          7. Personal data breach
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          We notify you of a confirmed personal data breach within 24 hours and provide reasonable
          cooperation for your own notification obligations under applicable law.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          8. Return + deletion
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          On termination, you may export your data for 90 days. After that we delete it, except
          hash-chained audit logs required to satisfy tax and regulatory retention.
        </p>
      </article>
    </PageShell>
  );
}
