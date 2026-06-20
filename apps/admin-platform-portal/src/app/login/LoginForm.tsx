'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Logomark } from '@bossnyumba/design-system';
import { getCsrfHeaders } from '@/lib/csrf';

interface LoginState {
  readonly phase: 'idle' | 'submitting' | 'error';
  readonly error?: string;
}

/**
 * Sanitise the post-login redirect target. Only same-origin relative
 * paths are allowed — a value must start with a single `/` and must not
 * be a scheme-relative URL (`//evil.com`), a backslash variant
 * (`/\evil.com`, which some browsers normalise to `//`), or an absolute
 * URL with a scheme (`https://evil.com`, `javascript:…`). Anything else
 * falls back to the dashboard root so a crafted `?next=` link can never
 * bounce a freshly-authenticated operator off-origin.
 */
export function safeNext(raw: string | null): string {
  if (!raw) return '/';
  // Must be an absolute path on this origin.
  if (!raw.startsWith('/')) return '/';
  // Reject protocol-relative ("//host") and backslash-smuggled variants.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

/**
 * Extract the platform session JWT from the identity `/sessions` login
 * response body. The session itself is ALSO set as an httpOnly cookie (which
 * JS cannot read), but non-cookie callers — the Jarvis SDK client, system-
 * health fetcher, EventSource — authenticate via `Authorization: Bearer …`
 * sourced from `sessionStorage.platform_token`. The identity service returns
 * the same JWT in the body precisely so the browser can stash it for those
 * callers. We accept a few canonical field names / nestings so this stays
 * resilient to the exact body shape, and ignore anything non-string.
 */
export function extractSessionToken(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const obj = body as Record<string, unknown>;
  const candidates: ReadonlyArray<unknown> = [
    obj.token,
    obj.accessToken,
    obj.sessionToken,
    obj.platformToken,
    (obj.session as Record<string, unknown> | undefined)?.token,
    (obj.session as Record<string, unknown> | undefined)?.accessToken,
    (obj.data as Record<string, unknown> | undefined)?.token,
    (obj.data as Record<string, unknown> | undefined)?.accessToken,
    (obj.data as Record<string, unknown> | undefined)?.sessionToken,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return null;
}

/**
 * Persist the session JWT to `sessionStorage.platform_token` so non-cookie
 * callers (Jarvis SDK, system-health, EventSource) can send it as a bearer.
 * Best-effort: sessionStorage can throw in locked-down / private-mode
 * contexts; a failure here must not block the redirect (the httpOnly cookie
 * still carries cookie-capable requests).
 */
function stashPlatformToken(token: string | null): void {
  if (!token) return;
  try {
    window.sessionStorage.setItem('platform_token', token);
  } catch {
    // Non-fatal: cookie path still authenticates cookie-capable requests.
  }
}

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<LoginState>({ phase: 'idle' });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ phase: 'submitting' });
    try {
      const res = await fetch('/api/platform/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ email, password, next }),
      });
      if (res.ok) {
        // Stash the session JWT for non-cookie callers (Jarvis SDK, system-
        // health, EventSource) BEFORE redirecting. Without this the Jarvis
        // console reads an absent `platform_token` and every Send hits the
        // gateway unauthenticated (401). The httpOnly session cookie is set
        // independently by the identity service for cookie-capable requests.
        const okBody = await res.json().catch(() => null);
        stashPlatformToken(extractSessionToken(okBody));
        window.location.href = next;
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setState({
        phase: 'error',
        error:
          body.error ??
          (res.status === 503
            ? 'Identity service is not wired yet.'
            : `Login failed (${res.status}).`),
      });
    } catch (error) {
      console.error('Login submit failed:', error);
      setState({
        phase: 'error',
        error: 'Could not reach the identity service.',
      });
    }
  }

  return (
    <div className="w-full max-w-sm platform-card">
      <div className="flex items-center gap-3 mb-6">
        <Logomark size={36} variant="premium" />
        <div>
          <div className="text-lg font-display text-foreground">BossNyumba</div>
          <div className="text-xs uppercase tracking-wider text-neutral-500">
            HQ staff sign-in
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Staff email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>

        {state.phase === 'error' && state.error ? (
          <div role="alert" aria-live="assertive" className="text-xs text-danger">
            {state.error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={state.phase === 'submitting'}
          className="btn-primary w-full"
        >
          {state.phase === 'submitting' ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-xs text-neutral-500 mt-6">
        Staff only. This surface is not reachable without a valid BossNyumba
        platform session.
      </p>
    </div>
  );
}
