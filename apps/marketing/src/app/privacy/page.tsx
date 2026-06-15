import type { Metadata } from 'next';
import { PageShell } from '@/components/shared/PageShell';

export const metadata: Metadata = {
  title: 'Privacy Notice — BossNyumba',
  description:
    "Privacy notice. What we collect, how we use it, your rights under the TZ Personal Data Protection Act and GDPR.",
};

export default function PrivacyPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-20 prose prose-invert prose-neutral lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          Legal · Privacy
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Privacy Notice.
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-foreground/60">
          Effective 2026-04-01 · Aligned with TZ DPA, GDPR, and Kenya DPA
        </p>

        <p className="mt-8 text-lg leading-relaxed text-foreground/75">
          BossNyumba (operated by Boss Nyumba Limited, registered in
          Tanzania) processes personal data on behalf of landlords,
          property managers, tenants, and partners. This notice explains
          what we collect, how we use it, and your rights.
        </p>

        <h2 className="mt-12 font-display text-xl font-semibold text-foreground">
          1. What we collect
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          Account data (name, phone, email, NIDA/passport hash). Portfolio
          data (properties, leases, tenants, rent payments). Communications
          (chat with Mr. Mwikila, SMS, email). Telemetry (audit logs, IP
          address, device). M-Pesa, Tigo Pesa, Airtel Money transaction
          references — never your wallet PIN.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          2. How we use it
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          To provide the service (rent collection, owner statements,
          maintenance triage). To improve the platform (anonymised
          aggregates only). To comply with legal obligations (regulator
          filings, tax reporting). To prevent fraud and abuse. We do not
          sell your data; we do not use it to train external AI models.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          3. Your rights
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          Access, correct, export, delete, restrict, and object. Email{' '}
          <a href="mailto:privacy@bossnyumba.com" className="text-signal-500 hover:underline">
            privacy@bossnyumba.com
          </a>{' '}
          and we respond within 30 days. You can also lodge a complaint
          with the TZ Personal Data Protection Commission or your local
          DPA.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          4. Retention
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          We retain account and portfolio data while your account is
          active and for 90 days after cancellation. Hash-chained audit
          logs are retained for 7 years per tax and compliance law. Chat
          transcripts are retained for 12 months.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          5. International transfers
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          Primary processing is in EAT region. Some sub-processors are in
          the EU or US under appropriate safeguards (SCCs, adequacy
          decisions). The full list is at{' '}
          <a href="/legal/sub-processors" className="text-signal-500 hover:underline">
            /legal/sub-processors
          </a>
          .
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          6. Contact
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          Data Protection Officer: dpo@bossnyumba.com
          <br />
          Privacy questions: privacy@bossnyumba.com
          <br />
          Mailing: Plot 12, Msasani Peninsula, Dar es Salaam, Tanzania
        </p>
      </article>
    </PageShell>
  );
}
