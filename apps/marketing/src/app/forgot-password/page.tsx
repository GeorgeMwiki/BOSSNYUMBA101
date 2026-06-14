import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

import { PageShell } from '@/components/shared/PageShell';
import { MwikilaChip } from '@/components/shared/MwikilaChip';
import { OwnerForgotPasswordForm } from '@/components/auth/OwnerForgotPasswordForm';
import { getLocale } from '@/lib/locale';
import { getMessages } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getMessages(locale).ownerForgotPasswordPage;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
  };
}

/**
 * /forgot-password — owner password-recovery landing (blocker #H31).
 *
 * The sign-in page's "Forgot your password?" link previously pointed to
 * `/sign-in/forgot`, which 404'd — recovery was unreachable. This page
 * mounts the real `<OwnerForgotPasswordForm>` client component, which
 * calls `supabase.auth.resetPasswordForEmail` against the same Supabase
 * browser client the sign-in form uses and emails the visitor a secure
 * recovery link.
 *
 * Locale-aware: the entire page resolves through `getLocale()` so the
 * render is pure English or pure Swahili — never mixed.
 */
export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  const t = getMessages(locale).ownerForgotPasswordPage;

  return (
    <PageShell>
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="hero-aurora" aria-hidden="true" />
        <div className="absolute inset-0 cinematic-grid opacity-20" aria-hidden="true" />
        <div className="relative mx-auto max-w-xl px-6 py-20 lg:py-28">
          <header className="mb-10 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
              {t.kicker}
            </p>
            <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
              {t.heading}
            </h1>
            <p className="mx-auto mt-5 max-w-prose-wide text-base leading-relaxed text-foreground/70">
              {t.sub}
            </p>
            <div className="mt-6 flex justify-center">
              <MwikilaChip variant="compact" />
            </div>
          </header>

          <OwnerForgotPasswordForm locale={locale} />

          <p className="mt-8 inline-flex w-full items-center justify-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-foreground/60">
            <ShieldCheck className="h-3 w-3 text-signal-500" aria-hidden="true" />
            BRELA · TRA · Housing-regulator verified
          </p>
        </div>
      </div>
    </PageShell>
  );
}
