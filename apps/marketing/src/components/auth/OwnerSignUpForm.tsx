'use client';

import { useState, type FormEvent } from 'react';
import { z } from 'zod';

import { apiBaseUrl } from '@/lib/api';
import { getCsrfHeaders } from '@/lib/csrf';
import { requirePublicBaseUrl } from '@/lib/env-guard';
import { getMessages, type Locale } from '@/lib/i18n';

interface OwnerSignUpFormProps {
  readonly locale: Locale;
}

type Field = 'orgName' | 'ownerFullName' | 'ownerEmail' | 'ownerPassword' | 'country' | 'form';

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'error'; readonly field: Field; readonly message: string };

/**
 * Owner sign-up form (marketing surface).
 *
 * Posts the marketing-form shape (orgName + ownerEmail + ownerPassword
 * + country) to `/api/v1/orgs/signup`. The gateway creates the tenant
 * + Supabase auth user inside one flow and mints a canonical Supabase
 * session.
 *
 * Auth handoff to the cockpit (canonical Supabase JWT)
 * ----------------------------------------------------
 * The owner cockpit is a SEPARATE origin (the cross-subdomain HttpOnly
 * `bossnyumba-session` cookie set by the gateway is host-only and not
 * reliably readable cross-origin, so we do NOT depend on it for the
 * landing). Instead, when `signupStatus === 'active'`, the gateway
 * returns the Supabase `access_token` in the JSON body and we hand it to
 * the cockpit in the URL FRAGMENT (`#access_token=…`). The fragment is
 * never sent to any server (no logs / no Referer leak); the cockpit reads
 * it on first load, persists it as its bearer, and authenticates via
 * `GET /auth/me` — which verifies Supabase JWTs. This is the canonical
 * "Supabase JWT is canonical" path and is topology-independent.
 *
 * When `signupStatus === 'pending_sign_in'` no live session exists (the
 * password-grant mint could not complete), so we route the owner to the
 * cockpit's sign-in page with a "from=signup" notice rather than a fake
 * /dashboard success that would bounce them straight back to /login.
 *
 * Inline errors render next to the field that failed; the gateway's
 * `error.field` hint (`ownerEmail`, etc.) is the canonical mapping.
 */
export function OwnerSignUpForm({ locale }: OwnerSignUpFormProps) {
  const t = getMessages(locale).ownerSignUpPage;

  const [orgName, setOrgName] = useState('');
  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [country, setCountry] = useState<'TZ' | 'KE' | 'UG' | 'NG'>('TZ');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const schema = z.object({
    orgName: z.string().min(2, t.errors.orgNameRequired).max(160),
    ownerFullName: z.string().min(2, t.errors.ownerFullNameRequired).max(120),
    ownerEmail: z.string().email(t.errors.emailRequired).max(254),
    ownerPassword: z.string().min(8, t.errors.passwordTooShort).max(200),
    country: z.enum(['TZ', 'KE', 'UG', 'NG']),
  });

  function ownerWebOrigin(): string {
    // requirePublicBaseUrl throws in prod when env unset — avoids silent
    // redirect to localhost from the deployed marketing site.
    return requirePublicBaseUrl(
      'NEXT_PUBLIC_OWNER_WEB_ORIGIN',
      'http://localhost:3010',
    ).replace(/\/$/, '');
  }

  /**
   * Authenticated cockpit landing. The Supabase access_token rides in the
   * URL FRAGMENT so it never reaches a server (no logs / no Referer leak);
   * the cockpit reads `#access_token=…` on first load, persists it as its
   * bearer, and authenticates via `GET /auth/me`.
   */
  function authedDashboardUrl(accessToken: string): string {
    return `${ownerWebOrigin()}/dashboard#access_token=${encodeURIComponent(accessToken)}`;
  }

  /**
   * Account-created-but-not-yet-signed-in landing. No live session exists,
   * so send the owner to the cockpit sign-in page with a notice instead of
   * a fake /dashboard success that would bounce them to /login.
   */
  function signInUrl(): string {
    return `${ownerWebOrigin()}/login?from=signup`;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = schema.safeParse({
      orgName,
      ownerFullName,
      ownerEmail,
      ownerPassword,
      country,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = (issue?.path?.[0] ?? 'form') as Field;
      setPhase({
        kind: 'error',
        field,
        message: issue?.message ?? t.errors.signUpFailed,
      });
      return;
    }
    setPhase({ kind: 'submitting' });
    try {
      const res = await fetch(`${apiBaseUrl()}/api/v1/orgs/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      });
      const json = (await res.json().catch(() => null)) as
        | {
            success: true;
            tenantId: string;
            ownerId: string;
            signupStatus: 'active' | 'pending_sign_in';
            session?: { access_token: string } | null;
          }
        | {
            error: string;
            message?: string;
            issues?: ReadonlyArray<{ path: string; message: string }>;
          }
        | null;
      if (res.ok && json && 'success' in json && json.success) {
        // Branch on the REAL provisioning status — never treat
        // `pending_sign_in` as a logged-in landing.
        const token = json.session?.access_token ?? null;
        if (json.signupStatus === 'active' && token) {
          // Live session: hand the canonical Supabase access_token to the
          // cockpit via the URL fragment so it lands authenticated.
          window.location.assign(authedDashboardUrl(token));
          return;
        }
        // Account created but no live session yet: route to sign-in with a
        // notice instead of a fake /dashboard success.
        window.location.assign(signInUrl());
        return;
      }
      // Map gateway errors onto inline field hints.
      const errCode =
        json && 'error' in json ? json.error : 'unknown';
      const errMsg =
        (json && 'message' in json ? json.message : null) ??
        (json && 'issues' in json ? json.issues?.[0]?.message : null) ??
        t.errors.signUpFailed;
      const issuePath = json && 'issues' in json ? json.issues?.[0]?.path : null;
      const field: Field =
        errCode === 'email_already_registered'
          ? 'ownerEmail'
          : errCode === 'phone_already_registered'
            ? 'form'
            : issuePath === 'ownerEmail' || issuePath === 'ownerPassword' || issuePath === 'orgName'
              ? (issuePath as Field)
              : 'form';
      setPhase({ kind: 'error', field, message: errMsg });
    } catch (err) {
      setPhase({
        kind: 'error',
        field: 'form',
        message: err instanceof Error ? err.message : t.errors.signUpFailed,
      });
    }
  }

  const fieldError = (target: Field): string | null => {
    if (phase.kind !== 'error') return null;
    return phase.field === target ? phase.message : null;
  };

  const formError =
    phase.kind === 'error' && phase.field === 'form' ? phase.message : null;

  return (
    <form
      data-testid="owner-signup-form"
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6 rounded-2xl border border-border bg-surface p-8 shadow-md sm:p-10"
    >
      <div className="space-y-2">
        <label
          htmlFor="owner-signup-orgname"
          className="block text-sm font-medium text-foreground"
        >
          {t.fields.orgName}
          <span className="ml-2 font-mono text-caption uppercase tracking-widest text-foreground/60">
            {t.fields.orgNameSub}
          </span>
        </label>
        <input
          id="owner-signup-orgname"
          data-testid="owner-signup-orgname"
          type="text"
          autoComplete="organization"
          required
          value={orgName}
          onChange={(e) => setOrgName(e.currentTarget.value)}
          aria-invalid={fieldError('orgName') ? true : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-3 text-base text-foreground placeholder:text-foreground/40 focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
        />
        {fieldError('orgName') ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldError('orgName')}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="owner-signup-fullname"
          className="block text-sm font-medium text-foreground"
        >
          {t.fields.ownerFullName}
          <span className="ml-2 font-mono text-caption uppercase tracking-widest text-foreground/60">
            {t.fields.ownerFullNameSub}
          </span>
        </label>
        <input
          id="owner-signup-fullname"
          data-testid="owner-signup-fullname"
          type="text"
          autoComplete="name"
          required
          value={ownerFullName}
          onChange={(e) => setOwnerFullName(e.currentTarget.value)}
          aria-invalid={fieldError('ownerFullName') ? true : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-3 text-base text-foreground placeholder:text-foreground/40 focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
        />
        {fieldError('ownerFullName') ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldError('ownerFullName')}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="owner-signup-email"
          className="block text-sm font-medium text-foreground"
        >
          {t.fields.email}
          <span className="ml-2 font-mono text-caption uppercase tracking-widest text-foreground/60">
            {t.fields.emailSub}
          </span>
        </label>
        <input
          id="owner-signup-email"
          data-testid="owner-signup-email"
          type="email"
          autoComplete="email"
          required
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.currentTarget.value)}
          aria-invalid={fieldError('ownerEmail') ? true : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-3 text-base text-foreground placeholder:text-foreground/40 focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
        />
        {fieldError('ownerEmail') ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldError('ownerEmail')}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="owner-signup-password"
          className="block text-sm font-medium text-foreground"
        >
          {t.fields.password}
          <span className="ml-2 font-mono text-caption uppercase tracking-widest text-foreground/60">
            {t.fields.passwordSub}
          </span>
        </label>
        <input
          id="owner-signup-password"
          data-testid="owner-signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={ownerPassword}
          onChange={(e) => setOwnerPassword(e.currentTarget.value)}
          aria-invalid={fieldError('ownerPassword') ? true : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-3 text-base text-foreground placeholder:text-foreground/40 focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
        />
        {fieldError('ownerPassword') ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldError('ownerPassword')}
          </p>
        ) : null}
        <p className="text-caption text-foreground/60">{t.fields.passwordHelp}</p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="owner-signup-country"
          className="block text-sm font-medium text-foreground"
        >
          {t.fields.country}
        </label>
        <select
          id="owner-signup-country"
          data-testid="owner-signup-country"
          value={country}
          onChange={(e) => setCountry(e.currentTarget.value as 'TZ' | 'KE' | 'UG' | 'NG')}
          className="w-full rounded-md border border-border bg-background px-3 py-3 text-base text-foreground focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
        >
          <option value="TZ">{t.countries.TZ}</option>
          <option value="KE">{t.countries.KE}</option>
          <option value="UG">{t.countries.UG}</option>
          <option value="NG">{t.countries.NG}</option>
        </select>
      </div>

      {formError ? (
        <div
          role="alert"
          data-testid="owner-signup-form-error"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {formError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={phase.kind === 'submitting'}
        data-testid="owner-signup-submit"
        className="w-full rounded-md bg-signal-500 px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-md transition-all duration-fast ease-out hover:bg-signal-400 hover:shadow-lg active:scale-[0.99] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
      >
        {phase.kind === 'submitting' ? t.actions.submitting : t.actions.submit}
      </button>

      <p className="text-caption text-foreground/60">{t.disclaimer}</p>
    </form>
  );
}
