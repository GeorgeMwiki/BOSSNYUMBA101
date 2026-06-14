'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { z } from 'zod';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { requirePublicBaseUrl } from '@/lib/env-guard';
import { getMessages, type Locale } from '@/lib/i18n';

interface OwnerForgotPasswordFormProps {
  readonly locale: Locale;
}

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'sent' }
  | { readonly kind: 'error'; readonly message: string };

/**
 * Owner forgot-password form for the public marketing surface.
 *
 * Drives `supabase.auth.resetPasswordForEmail` against the same
 * Supabase browser client the `OwnerSignInForm` uses (single shared
 * singleton — no second auth path). Supabase emails the visitor a
 * recovery link; `redirectTo` lands them on the owner cockpit sign-in
 * (cross-origin in dev), the same origin the sign-in form redirects to
 * on success, so the recovery loop terminates somewhere real rather
 * than a 404.
 *
 * Honest, enumeration-safe success state: we render the same
 * "check your email" panel whether or not the address matched, so the
 * surface never leaks which emails have accounts. A hard failure
 * (network / Supabase error) renders an inline error instead of a
 * silent no-op. Copy resolves through the active locale only — pure EN
 * or pure SW, never mixed.
 */
export function OwnerForgotPasswordForm({ locale }: OwnerForgotPasswordFormProps) {
  const t = getMessages(locale).ownerForgotPasswordPage;

  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const schema = z.object({
    email: z.string().email(t.errors.emailRequired),
  });

  function redirectTo(): string {
    // requirePublicBaseUrl throws in prod when env unset — avoids a
    // recovery link that silently points at localhost from the deployed
    // marketing site.
    const base = requirePublicBaseUrl(
      'NEXT_PUBLIC_OWNER_WEB_ORIGIN',
      'http://localhost:3010',
    ).replace(/\/$/, '');
    return `${base}/sign-in`;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setPhase({
        kind: 'error',
        message: issue?.message ?? t.errors.emailRequired,
      });
      return;
    }
    setPhase({ kind: 'submitting' });
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        parsed.data.email,
        { redirectTo: redirectTo() },
      );
      if (error) {
        setPhase({ kind: 'error', message: error.message ?? t.errors.sendFailed });
        return;
      }
      // Enumeration-safe: always land on the neutral "sent" panel on a
      // clean Supabase response — never disclose whether the address
      // resolved to an account.
      setPhase({ kind: 'sent' });
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : t.errors.sendFailed,
      });
    }
  }

  if (phase.kind === 'sent') {
    return (
      <div
        data-testid="owner-forgot-sent"
        role="status"
        className="space-y-6 rounded-2xl border border-border bg-surface p-8 shadow-md sm:p-10"
      >
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
            {t.sent.heading}
          </h2>
          <p className="text-base leading-relaxed text-foreground/70">
            {t.sent.body}
          </p>
        </div>
        <button
          type="button"
          data-testid="owner-forgot-resend"
          onClick={() => {
            setEmail('');
            setPhase({ kind: 'idle' });
          }}
          className="w-full rounded-md border border-border bg-background px-4 py-3.5 text-base font-semibold text-foreground transition-all duration-fast ease-out hover:bg-surface active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
        >
          {t.sent.resend}
        </button>
        <Link
          href="/sign-in"
          data-testid="owner-forgot-back-link"
          className="block text-center text-sm font-medium text-signal-500 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 rounded-sm"
        >
          {t.actions.backToSignIn}
        </Link>
      </div>
    );
  }

  const formError = phase.kind === 'error' ? phase.message : null;

  return (
    <form
      data-testid="owner-forgot-form"
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6 rounded-2xl border border-border bg-surface p-8 shadow-md sm:p-10"
    >
      <div className="space-y-2">
        <label
          htmlFor="owner-forgot-email"
          className="block text-sm font-medium text-foreground"
        >
          {t.fields.email}
          <span className="ml-2 font-mono text-caption uppercase tracking-widest text-foreground/60">
            {t.fields.emailEn}
          </span>
        </label>
        <input
          id="owner-forgot-email"
          data-testid="owner-forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          aria-invalid={formError ? true : undefined}
          aria-describedby={formError ? 'owner-forgot-error' : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-3 text-base text-foreground placeholder:text-foreground/40 focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
        />
      </div>

      {formError ? (
        <div
          id="owner-forgot-error"
          role="alert"
          data-testid="owner-forgot-error"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {formError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={phase.kind === 'submitting'}
        data-testid="owner-forgot-submit"
        className="w-full rounded-md bg-signal-500 px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-md transition-all duration-fast ease-out hover:bg-signal-400 hover:shadow-lg active:scale-[0.99] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
      >
        {phase.kind === 'submitting' ? t.actions.submitting : t.actions.submit}
      </button>

      <Link
        href="/sign-in"
        data-testid="owner-forgot-back-link"
        className="block text-center text-sm font-medium text-signal-500 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 rounded-sm"
      >
        {t.actions.backToSignIn}
      </Link>
    </form>
  );
}
