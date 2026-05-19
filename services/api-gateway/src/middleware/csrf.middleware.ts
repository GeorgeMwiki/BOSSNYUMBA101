/**
 * CSRF middleware (AM-1).
 *
 * Cookie-based auth gives the browser an irresistible reflex: any request
 * to the gateway carries the `bn_session` cookie automatically. Without a
 * second signal, an attacker page at `https://evil.example/` can do:
 *
 *   await fetch('https://api.bossnyumba.com/api/v1/leases', {
 *     method: 'POST', credentials: 'include', body: '...'
 *   })
 *
 * and the browser dutifully attaches the session cookie. SameSite=Lax
 * stops cross-site POST cookie attachment for `fetch()` with arbitrary
 * Content-Types, BUT (a) Lax does NOT stop `<form>`-based attacks because
 * those count as top-level navigations in the browser model, and (b)
 * older browsers don't enforce Lax-by-default.
 *
 * Double-submit cookie pattern:
 *   - On login (and on /auth/csrf), gateway sets a NON-httpOnly cookie
 *     `bn_csrf` containing a cryptographically random token.
 *   - SPA reads `document.cookie` to extract the token and echoes it as
 *     `X-CSRF-Token` on every mutation request.
 *   - Gateway verifies `request.cookie.bn_csrf === request.header['X-CSRF-Token']`.
 *   - An attacker page on a different origin CANNOT read `document.cookie`
 *     for `api.bossnyumba.com` (Same-Origin Policy), so it cannot mint the
 *     matching header. Defence is sound.
 *
 * Belt-and-braces Origin check:
 *   Additionally, mutation requests must carry an `Origin` (or `Referer`)
 *   header that matches `ALLOWED_ORIGINS`. This catches the rare
 *   non-browser caller (e.g. mobile app via WebView) that sends the
 *   cookie but neither Origin nor CSRF header — those are rejected.
 *
 * Exemptions:
 *   - GET / HEAD / OPTIONS — safe methods, no CSRF risk.
 *   - `/api/v1/auth/csrf`  — the bootstrap endpoint that issues the token.
 *   - `/api/v1/auth/login` — the user has no session yet, so no
 *     credential to abuse. CORS + Origin check still applies.
 *   - Bearer-token requests (`Authorization: Bearer …`) — those are
 *     header-based, not cookie-based, so no CSRF risk. The
 *     `X-API-Key` flow likewise.
 */

import { createMiddleware } from 'hono/factory';
import { randomBytes } from 'node:crypto';
import { readCsrfCookie } from './session-cookie';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const EXEMPT_PATHS = new Set([
  '/api/v1/auth/csrf',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh', // refresh uses the refresh cookie + Origin check, not CSRF header
  '/api/v1/health',
  '/api/v1/health/live',
  '/api/v1/health/ready',
]);

/** Generate a 256-bit CSRF token. Hex-encoded for safe cookie/header transit. */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

function resolveAllowedOrigins(): readonly string[] {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (raw) return raw.split(',').map((o) => o.trim()).filter(Boolean);
  if (process.env.NODE_ENV === 'production') {
    // Fail closed in production — the gateway's CORS check has the same
    // requirement, so the consistency is intentional.
    return [];
  }
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
  ];
}

function originAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  const allowed = resolveAllowedOrigins();
  return allowed.includes(origin);
}

/**
 * CSRF protection for cookie-authed mutation requests.
 *
 * Logic:
 *   1. Safe methods + exempt paths skip outright.
 *   2. Bearer / API-key auth skips (header-based, immune to CSRF).
 *   3. For everything else: require Origin (or Referer) to match
 *      whitelist AND require `X-CSRF-Token` to equal the cookie value.
 *
 * Constant-time comparison prevents a timing-channel attack on the
 * 256-bit token.
 */
export const csrfMiddleware = createMiddleware(async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (SAFE_METHODS.has(method)) {
    await next();
    return;
  }

  // Exact-path exemptions. The path is the *gateway-relative* path
  // (includes the /api/v1 prefix because Hono is mounted under it).
  const path = new URL(c.req.url).pathname;
  if (EXEMPT_PATHS.has(path)) {
    await next();
    return;
  }

  // Bearer / API-key auth → no CSRF risk, skip.
  const authHeader = c.req.header('Authorization');
  const apiKey = c.req.header('X-API-Key');
  if ((authHeader && authHeader.startsWith('Bearer ')) || apiKey) {
    await next();
    return;
  }

  // Origin check. Browsers always send Origin on cross-origin requests
  // AND on same-origin POST/PUT/PATCH/DELETE. Some same-origin tests
  // omit it — we accept a matching Referer as a fallback.
  const origin = c.req.header('Origin') ?? c.req.header('origin');
  const referer = c.req.header('Referer') ?? c.req.header('referer');
  const refererOrigin = referer ? safeUrlOrigin(referer) : undefined;
  const candidateOrigin = origin ?? refererOrigin;

  if (!candidateOrigin || !originAllowed(candidateOrigin)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'CSRF_ORIGIN_REJECTED',
          message: 'Origin header missing or not allowed for state-changing request',
        },
      },
      403
    );
  }

  // Double-submit cookie check.
  const cookieToken = readCsrfCookie(c);
  const headerToken = c.req.header('X-CSRF-Token') ?? c.req.header('x-csrf-token');

  if (!cookieToken || !headerToken) {
    return c.json(
      {
        success: false,
        error: {
          code: 'CSRF_TOKEN_MISSING',
          message: 'CSRF token cookie and header are both required',
        },
      },
      403
    );
  }

  if (!constantTimeEqual(cookieToken, headerToken)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'CSRF_TOKEN_MISMATCH',
          message: 'CSRF token cookie does not match X-CSRF-Token header',
        },
      },
      403
    );
  }

  await next();
});

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Timing-safe string equality. `crypto.timingSafeEqual` requires equal-
 * length inputs; differing lengths short-circuit to false (the comparison
 * cost is unobservable to an attacker because they don't control the
 * cookie value).
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function safeUrlOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/** Test helper — exposes `originAllowed` so the regression suite can assert it. */
export const __testing = {
  originAllowed,
  constantTimeEqual,
};
