'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  MailQuestion,
  ShieldAlert,
} from 'lucide-react';

import { getApiBaseUrl } from '@/lib/api';
import { getCsrfHeaders } from '@/lib/csrf';

/**
 * `/onboarding/redeem?token=...` — bearer-token redemption flow.
 *
 * Exchanges an invite link / magic-link token for a customer session.
 * The token MAY be a JWT (we POST it directly to the gateway exchange
 * endpoint) or a one-time code (the gateway resolves it server-side).
 * Either way, on success the gateway returns a session token + the
 * tenant-scoped customer record so we can render a personalised welcome.
 *
 * Failure modes:
 *  - missing token         → show "Request new invite" CTA
 *  - 4xx (invalid/expired) → same CTA, with the gateway's error message
 *  - 5xx / network         → retry CTA, no destructive state
 *
 * Token validation happens entirely server-side; this page never trusts
 * client-side decoding.
 */

interface RedeemResult {
  readonly token?: string;
  readonly customer?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  readonly tenant?: {
    id?: string;
    name?: string;
  };
}

type Status =
  | { kind: 'idle' }
  | { kind: 'redeeming' }
  | { kind: 'success'; result: RedeemResult }
  | { kind: 'invalid'; message: string }
  | { kind: 'error'; message: string };

async function redeemToken(
  baseUrl: string,
  token: string
): Promise<RedeemResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${baseUrl}/onboarding/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({ token }),
    });

    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      // empty body is fine
    }

    if (response.status === 400 || response.status === 401 || response.status === 404) {
      const message =
        (parsed &&
          typeof parsed === 'object' &&
          'error' in parsed &&
          (parsed as { error?: { message?: string } }).error?.message) ||
        'This invite link is invalid or has expired.';
      const e = new Error(message);
      (e as Error & { kind?: string }).kind = 'invalid';
      throw e;
    }
    if (!response.ok) {
      const message =
        response.status >= 500
          ? 'The server is temporarily unavailable. Please try again.'
          : 'We could not redeem your invite. Please try again.';
      throw new Error(message);
    }

    if (parsed && typeof parsed === 'object') {
      const data =
        ('data' in parsed
          ? (parsed as { data?: RedeemResult }).data
          : (parsed as RedeemResult)) ?? {};
      return data;
    }
    return {};
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function RedeemPageInner(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const baseUrl = useMemo(() => {
    try {
      return getApiBaseUrl();
    } catch (err) {
      console.error('Redeem page: api base URL unavailable', err);
      return '';
    }
  }, []);

  const handleRedeem = useCallback(async () => {
    if (!token) {
      setStatus({
        kind: 'invalid',
        message: 'Missing invite token. Please open the invite link from your email or SMS.',
      });
      return;
    }
    if (!baseUrl) {
      setStatus({
        kind: 'error',
        message: 'API gateway URL is not configured.',
      });
      return;
    }

    setStatus({ kind: 'redeeming' });
    try {
      const result = await redeemToken(baseUrl, token);

      // Persist session token, if returned, the same way `loginAsCustomer`
      // expects (matches CA-AC-007).
      if (result.token && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('customer_token', result.token);
          localStorage.setItem('token', result.token);
        } catch {
          // Storage may be disabled — non-fatal.
        }
      }

      setStatus({ kind: 'success', result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const kind =
        err instanceof Error && (err as Error & { kind?: string }).kind === 'invalid'
          ? 'invalid'
          : 'error';
      setStatus({ kind, message });
    }
  }, [baseUrl, token]);

  useEffect(() => {
    void handleRedeem();
  }, [handleRedeem]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-sm border border-gray-100 p-6 text-center"
        data-testid="redeem-panel"
      >
        {status.kind === 'idle' || status.kind === 'redeeming' ? (
          <>
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary-50 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary-600 animate-spin" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">
              Verifying your invite
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              Hang on while we set up your account...
            </p>
          </>
        ) : null}

        {status.kind === 'success' ? (
          <>
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-success-50 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-success-600" />
            </div>
            <h1
              className="text-lg font-semibold text-gray-900"
              data-testid="redeem-welcome-heading"
            >
              Welcome
              {status.result.customer?.firstName
                ? `, ${status.result.customer.firstName}`
                : ''}
              !
            </h1>
            <p
              className="text-sm text-gray-500 mt-2"
              data-testid="redeem-welcome-message"
            >
              {status.result.tenant?.name
                ? `You are joining ${status.result.tenant.name}. Let's complete your move-in.`
                : "Your account is ready. Let's complete your move-in."}
            </p>
            <button
              type="button"
              onClick={() => router.push('/onboarding')}
              data-testid="redeem-continue-button"
              className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700"
            >
              Continue onboarding
              <ArrowRight className="w-5 h-5" />
            </button>
          </>
        ) : null}

        {status.kind === 'invalid' ? (
          <>
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-danger-50 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-danger-600" />
            </div>
            <h1
              className="text-lg font-semibold text-gray-900"
              data-testid="redeem-error-heading"
            >
              Invite link not valid
            </h1>
            <p
              className="text-sm text-gray-500 mt-2"
              data-testid="redeem-error-message"
            >
              {status.message}
            </p>
            <Link
              href="/support/invite-resend"
              data-testid="request-new-invite-button"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700"
            >
              <MailQuestion className="w-5 h-5" />
              Request new invite
            </Link>
            <Link
              href="/auth/login"
              className="mt-2 inline-block text-sm text-gray-500 underline-offset-2 hover:underline"
            >
              Sign in instead
            </Link>
          </>
        ) : null}

        {status.kind === 'error' ? (
          <>
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-danger-50 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-danger-600" />
            </div>
            <h1
              className="text-lg font-semibold text-gray-900"
              data-testid="redeem-error-heading"
            >
              Something went wrong
            </h1>
            <p
              className="text-sm text-gray-500 mt-2"
              data-testid="redeem-error-message"
            >
              {status.message}
            </p>
            <button
              type="button"
              onClick={() => void handleRedeem()}
              data-testid="redeem-retry-button"
              className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700"
            >
              Try again
            </button>
            <Link
              href="/support/invite-resend"
              data-testid="request-new-invite-button"
              className="mt-2 inline-block text-sm text-gray-500 underline-offset-2 hover:underline"
            >
              Request new invite
            </Link>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default function RedeemPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <RedeemPageInner />
    </Suspense>
  );
}
