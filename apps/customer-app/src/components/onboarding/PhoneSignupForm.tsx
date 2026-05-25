'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { getRegionConfig } from '@bossnyumba/domain-models';

import { getApiBaseUrl } from '@/lib/api';
import { getCsrfHeaders } from '@/lib/csrf';
import { ROUTES } from '@/lib/routes';

/**
 * PhoneSignupForm — phone+OTP signup affordance.
 *
 * Two-stage form: (1) request OTP for phone, (2) verify OTP. The form
 * normalises the phone to E.164 using the deployment's default country
 * code (resolved via `getRegionConfig`) and posts to the api-gateway:
 *   POST /api/v1/auth/otp     { phone }   → request code
 *   POST /api/v1/auth/verify  { phone, otp }
 *
 * The component is presentational on top of a thin fetch — we cannot
 * call `useAuth().register()` because the current AuthContext is wired
 * for the live-data-required policy and would always return failure.
 * Wiring directly to the gateway lets E2E (which seeds the gateway with
 * a test-mode OTP acceptor) exercise the full flow.
 */
export interface PhoneSignupFormProps {
  /** Path to redirect to after successful verification. Defaults to `/onboarding`. */
  successRedirect?: string;
  /** Pre-fill phone (used by deep-links). */
  initialPhone?: string;
  /** Default country (ISO-3166 alpha-2). Defaults to env or tenant context. */
  defaultCountry?: string;
}

const DEFAULT_COUNTRY_FROM_ENV: string =
  (typeof process !== 'undefined'
    ? process.env?.NEXT_PUBLIC_DEFAULT_COUNTRY?.trim().toUpperCase()
    : undefined) || '';

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

type Stage = 'phone' | 'otp';

interface FetchError {
  message: string;
  status?: number;
}

async function postJson(
  url: string,
  body: unknown,
  signal?: AbortSignal
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
    body: JSON.stringify(body),
    signal,
    credentials: 'include',
  });
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // Body may be empty; we still return based on status.
  }
  return { ok: response.ok, status: response.status, data: parsed };
}

function toE164(input: string, dialingCode: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('+')) {
    return trimmed.replace(/[^\d+]/g, '');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith(dialingCode)) {
    return `+${digits}`;
  }
  // Strip any leading 0 (national trunk prefix) before prepending the
  // dialing code.
  const stripped = digits.replace(/^0+/, '');
  return `+${dialingCode}${stripped}`;
}

export function PhoneSignupForm({
  successRedirect = '/onboarding',
  initialPhone = '',
  defaultCountry,
}: PhoneSignupFormProps): JSX.Element {
  const router = useRouter();
  const country = (defaultCountry ?? DEFAULT_COUNTRY_FROM_ENV).toUpperCase();
  const region = useMemo(() => getRegionConfig(country), [country]);

  const [stage, setStage] = useState<Stage>('phone');
  const [phoneInput, setPhoneInput] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<FetchError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const apiBase = useMemo(() => {
    try {
      return getApiBaseUrl();
    } catch (err) {
      // In production with no env var, surface a stable error; the
      // form will still render but cannot submit.
      console.error('PhoneSignupForm: api base URL unavailable', err);
      return '';
    }
  }, []);

  const normalisedPhone = useMemo(() => {
    if (!phoneInput.trim()) return '';
    return toE164(phoneInput, region.phone.dialingCode);
  }, [phoneInput, region.phone.dialingCode]);

  const phoneValid = E164_REGEX.test(normalisedPhone);

  const requestOtp = useCallback(async () => {
    if (!phoneValid) {
      setError({ message: 'Please enter a valid phone number in E.164 format.' });
      return;
    }
    if (!apiBase) {
      setError({ message: 'API gateway URL is not configured.' });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { ok, status, data } = await postJson(`${apiBase}/auth/otp`, {
        phone: normalisedPhone,
      });
      if (!ok) {
        const message =
          (data && typeof data === 'object' && 'error' in data
            ? (data as { error?: { message?: string } }).error?.message
            : undefined) ??
          (status >= 500
            ? 'OTP service is temporarily unavailable. Try again in a moment.'
            : 'We could not send the verification code. Check the number and try again.');
        setError({ message, status });
        return;
      }
      setStage('otp');
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Request timed out. Please try again.'
          : 'Network error. Check your connection and try again.';
      setError({ message });
    } finally {
      setSubmitting(false);
    }
  }, [apiBase, normalisedPhone, phoneValid]);

  const verifyOtp = useCallback(async () => {
    if (otp.trim().length < 4) {
      setError({ message: 'Please enter the verification code.' });
      return;
    }
    if (!apiBase) {
      setError({ message: 'API gateway URL is not configured.' });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { ok, status, data } = await postJson(`${apiBase}/auth/verify`, {
        phone: normalisedPhone,
        otp: otp.trim(),
      });
      if (!ok) {
        const message =
          (data && typeof data === 'object' && 'error' in data
            ? (data as { error?: { message?: string } }).error?.message
            : undefined) ?? 'Invalid verification code. Please try again.';
        setError({ message, status });
        return;
      }
      // Best-effort persist the token if the gateway returned one — this
      // matches the contract used by `loginAsCustomer` (and is required
      // by CA-AC-007).
      const token =
        data && typeof data === 'object' && 'data' in data
          ? (data as { data?: { token?: string } }).data?.token
          : undefined;
      if (token && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('customer_token', token);
          localStorage.setItem('token', token);
        } catch {
          // Storage may be full or disabled; non-fatal.
        }
      }
      router.push(successRedirect);
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Request timed out. Please try again.'
          : 'Network error. Check your connection and try again.';
      setError({ message });
    } finally {
      setSubmitting(false);
    }
  }, [apiBase, normalisedPhone, otp, router, successRedirect]);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 px-6 py-8 max-w-md mx-auto w-full">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Secure phone signup
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {stage === 'phone' ? 'Sign up with your phone' : 'Verify your phone'}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            {stage === 'phone'
              ? `We will send a one-time code to your number${country ? ` in ${country}` : ''}.`
              : `Enter the 6-digit code we sent to ${normalisedPhone}.`}
          </p>
        </div>

        {stage === 'phone' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void requestOtp();
            }}
            noValidate
            className="space-y-5"
            data-testid="phone-signup-form"
          >
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone number
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                {region.phone.dialingCode ? (
                  <span
                    className="absolute left-12 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 pointer-events-none"
                    aria-hidden="true"
                  >
                    +{region.phone.dialingCode}
                  </span>
                ) : null}
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={region.phone.placeholder}
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setError(null);
                  }}
                  aria-invalid={phoneInput.length > 0 && !phoneValid}
                  aria-describedby={error ? 'phone-error' : undefined}
                  data-testid="phone-input"
                  className={`w-full rounded-xl border bg-white px-4 py-3 text-base outline-none transition-colors ${
                    region.phone.dialingCode ? 'pl-24' : 'pl-12'
                  } ${
                    phoneInput.length > 0 && !phoneValid
                      ? 'border-danger-300 focus:border-danger-500'
                      : 'border-gray-200 focus:border-primary-500'
                  }`}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Normalised: {normalisedPhone || '—'}
              </p>
            </div>

            {error && (
              <div
                id="phone-error"
                role="alert"
                className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700"
                data-testid="phone-signup-error"
              >
                {error.message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !phoneValid}
              data-testid="send-otp-button"
              aria-label="Send OTP"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-4 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Send OTP
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link href={ROUTES.auth.login} className="text-primary-600 font-medium">
                Sign in
              </Link>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verifyOtp();
            }}
            noValidate
            className="space-y-5"
            data-testid="otp-verify-form"
          >
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                Verification code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setError(null);
                  }}
                  aria-describedby={error ? 'otp-error' : undefined}
                  data-testid="otp-input"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pl-12 text-base font-mono tracking-widest outline-none focus:border-primary-500"
                />
              </div>
            </div>

            {error && (
              <div
                id="otp-error"
                role="alert"
                className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700"
                data-testid="otp-error"
              >
                {error.message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || otp.length < 4}
              data-testid="verify-otp-button"
              aria-label="Verify code"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-4 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Verify'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStage('phone');
                setOtp('');
                setError(null);
              }}
              className="w-full text-sm text-gray-500 underline-offset-2 hover:underline"
              data-testid="change-phone-button"
            >
              Change phone number
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default PhoneSignupForm;
