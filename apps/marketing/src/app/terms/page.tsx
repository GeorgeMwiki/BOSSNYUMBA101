import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/shared/PageShell';

export const metadata: Metadata = {
  title: 'Terms of Service — Boss Nyumba',
  description:
    'Terms of service. Your contract with Boss Nyumba. Plain-English summary first, then the binding text.',
};

export default function TermsPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-20 prose prose-invert prose-neutral lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          Legal · Terms
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Terms of Service.
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-foreground/60">
          Effective 2026-04-01 · English binding
        </p>

        <p className="mt-8 text-lg leading-relaxed text-foreground/75">
          By using Boss Nyumba you agree to these terms. The plain-English
          summary covers the spirit; the binding sections below cover the
          letter.
        </p>

        <h2 className="mt-12 font-display text-xl font-semibold text-foreground">
          Plain-English summary
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/70">
          <li>You own your data. We process it on your behalf. You can export and delete it any time.</li>
          <li>You pay for your tier. The Smallholder tier is free up to 5 units; other tiers are billed monthly in TZS.</li>
          <li>You can cancel any time. You keep access until the end of the current month. No early-termination fee.</li>
          <li>We&apos;ll do what we say in the SLA. If we don&apos;t, you get the remedies in the SLA.</li>
          <li>Do not use Boss Nyumba to break the law, abuse tenants, evade tax, or commit fraud.</li>
          <li>We can suspend accounts for abuse, fraud, or non-payment after notice.</li>
          <li>Disputes are resolved in Dar es Salaam under Tanzanian law. We aim to settle in good faith first.</li>
        </ul>

        <h2 className="mt-12 font-display text-xl font-semibold text-foreground">
          1. Definitions
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          &quot;We&quot;, &quot;us&quot;, &quot;Boss Nyumba&quot; means Boss
          Nyumba Limited (registered in Tanzania). &quot;You&quot;, &quot;your&quot;,
          &quot;customer&quot; means the entity or individual using the
          service. &quot;Service&quot; means the Boss Nyumba platform,
          apps, and APIs.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          2. Subscription + billing
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          Tiers, prices, and unit caps are at{' '}
          <Link href="/pricing" className="text-signal-500 hover:underline">/pricing</Link>.
          Billed monthly in TZS. Payable via M-Pesa, Tigo Pesa, Airtel
          Money, bank transfer, or card depending on tier. Overage
          charged at the per-unit rate disclosed on the pricing page.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          3. Acceptable use
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          See{' '}
          <Link href="/legal/acceptable-use" className="text-signal-500 hover:underline">
            /legal/acceptable-use
          </Link>
          . You may not use Boss Nyumba to discriminate against tenants
          unlawfully, to evade tax, to commit fraud, or to interfere
          with the platform.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          4. Data
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          Your data remains yours. We process it on your behalf as a
          processor under the{' '}
          <Link href="/dpa" className="text-signal-500 hover:underline">DPA</Link>.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          5. Liability + warranty
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          Service provided as-is. Our aggregate liability is capped at
          the fees paid in the preceding 12 months. SLA remedies are the
          exclusive remedies for downtime. Nothing in these terms limits
          liability for gross negligence, willful misconduct, or matters
          which cannot be limited under applicable law.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          6. Termination
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          You may cancel any time from Settings -&gt; Billing. We may
          terminate for material breach with 14 days&apos; notice, or
          immediately for fraud, abuse, or sanctions violation. On
          termination you have 90 days to export your data; after that
          we delete it (except hash-chained audit logs required by law).
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          7. Governing law + disputes
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          Tanzanian law. Disputes resolved in Dar es Salaam. We commit
          to a 30-day good-faith dispute window before either party
          escalates.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          8. Contact
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          legal@bossnyumba.com
          <br />
          Plot 12, Msasani Peninsula, Dar es Salaam, Tanzania
        </p>
      </article>
    </PageShell>
  );
}
