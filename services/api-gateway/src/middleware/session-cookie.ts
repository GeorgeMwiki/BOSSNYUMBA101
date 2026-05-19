/**
 * Session-cookie helpers — AM-1 httpOnly cookie auth migration.
 *
 * Closes round-3 frontend bug-sweep H-1 (bearer-in-localStorage XSS exfil).
 * The audit identified that every portal stored its JWT in `localStorage`
 * under `token`/`auth_token`/`customer_token`/`manager_token`. A single XSS
 * sink (FW-B1 C-1 — customer-app blog markdown — was patched, but the class
 * remains) reads `localStorage.getItem(...)` and POSTs the bearer to an
 * attacker server. The bearer is then a full account takeover.
 *
 * Defense-in-depth fix: move all session bearers into httpOnly + Secure +
 * SameSite=Lax cookies that JavaScript cannot read. The browser still
 * attaches them on every request to the api-gateway (via
 * `credentials: 'include'`), but XSS can no longer exfiltrate them. The
 * portals retain a short-lived in-memory CSRF token for state-changing
 * requests (see `csrf-store.ts`).
 *
 * Cookie scheme:
 *   - `bn_session`   — signed access JWT, 1h TTL  (httpOnly, Secure, SameSite=Lax)
 *   - `bn_refresh`   — signed refresh JWT, 7d TTL (httpOnly, Secure, SameSite=Lax)
 *   - `bn_csrf`      — public CSRF token, 24h TTL (NOT httpOnly — JS must read it)
 *
 * Why SameSite=Lax (not Strict): Strict breaks the standard top-level
 * navigation-from-email flow ("click magic link → land on dashboard
 * already signed in"). Lax still blocks CSRF because cross-site POST/PUT/
 * PATCH/DELETE never send the cookie, and we additionally require the
 * CSRF header (defence-in-depth) on every mutation.
 *
 * Why a separate access vs refresh cookie: the access cookie rotates
 * every hour (limits blast radius); the refresh cookie is the long-lived
 * credential and is ONLY presented to `/auth/refresh` and `/auth/logout`
 * (the `path` attribute would restrict this in theory, but browsers'
 * coverage of `path` for credentials is shaky — instead the server
 * verifies the refresh JWT against `JWT_REFRESH_SECRET`, distinct from
 * the access secret, so an attacker cannot use an access token as a
 * refresh token even if they obtain one).
 */

import type { Context } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';

export const SESSION_COOKIE_NAME = 'bn_session';
export const REFRESH_COOKIE_NAME = 'bn_refresh';
export const CSRF_COOKIE_NAME = 'bn_csrf';

/** Default TTLs (seconds). Override via env where appropriate. */
const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour — must match generateToken in middleware/auth.ts
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const CSRF_TTL_SECONDS = 60 * 60 * 24; // 24 hours — UI re-fetches if expired

/**
 * Cookie attribute set used for all three cookies. Secure is force-on in
 * production (any non-`development` value), force-off in tests so the
 * supertest/Node fetch flow can read them back without HTTPS, and
 * controlled by `COOKIE_SECURE` env in dev (defaults to false for the
 * local plain-HTTP gateway).
 */
function isSecure(): boolean {
  const env = (process.env.NODE_ENV ?? 'development').toLowerCase();
  if (env === 'test') return false;
  if (env === 'production') return true;
  // Dev/staging: explicit override or default to insecure (plain HTTP).
  return (process.env.COOKIE_SECURE ?? 'false').toLowerCase() === 'true';
}

/**
 * Cookie domain. Unset in dev (browser uses the current host); set in
 * production so the cookie spans api.bossnyumba.com + the portal hosts.
 * The leading dot lets sub-domains share it (`.bossnyumba.com`). Absence
 * is fine — the browser falls back to the response host.
 */
function cookieDomain(): string | undefined {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  return domain && domain.length > 0 ? domain : undefined;
}

interface CookieOpts {
  readonly httpOnly: boolean;
  readonly path: string;
  readonly maxAge: number;
  readonly sameSite: 'Lax' | 'Strict' | 'None';
  readonly secure: boolean;
  readonly domain?: string;
}

function baseOpts(maxAge: number, httpOnly: boolean): CookieOpts {
  return {
    httpOnly,
    path: '/',
    maxAge,
    sameSite: 'Lax',
    secure: isSecure(),
    domain: cookieDomain(),
  };
}

// ---------------------------------------------------------------------------
// Setters
// ---------------------------------------------------------------------------

/**
 * Set the short-lived access-token cookie. Called from /auth/login and
 * /auth/refresh after a fresh access JWT is minted. The body of the JWT
 * still contains userId/tenantId/role/permissions/jti so the existing
 * `authMiddleware` works unchanged once we add the cookie-fallback read.
 */
export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE_NAME, token, baseOpts(ACCESS_TTL_SECONDS, true));
}

/**
 * Set the long-lived refresh-token cookie. Only `/auth/refresh` and
 * `/auth/logout` ever read this. Refresh JWTs are signed with a distinct
 * secret (`JWT_REFRESH_SECRET`) so they cannot be substituted for an
 * access token.
 */
export function setRefreshCookie(c: Context, token: string): void {
  setCookie(c, REFRESH_COOKIE_NAME, token, baseOpts(REFRESH_TTL_SECONDS, true));
}

/**
 * Set the CSRF token cookie. NOT httpOnly: the SPA must be able to read
 * it from JavaScript and echo it as `X-CSRF-Token` on every mutation
 * request. CSRF protection works because an attacker on a different
 * origin cannot read `document.cookie` for `bn_csrf` (different-origin
 * scripts can't read cookies even when SameSite is Lax — that only
 * controls whether the cookie is *sent* on cross-site navigations).
 *
 * NOTE: We use SameSite=Lax (not Strict) on the CSRF cookie so the user
 * can land on the app via a top-level click and the page can read the
 * token immediately. The actual cross-site protection comes from
 * (a) requiring the header, (b) the attacker-origin being unable to
 * read the same-origin cookie, (c) `Origin` header verification.
 */
export function setCsrfCookie(c: Context, token: string): void {
  setCookie(c, CSRF_COOKIE_NAME, token, baseOpts(CSRF_TTL_SECONDS, false));
}

// ---------------------------------------------------------------------------
// Clearers — used by /auth/logout. Pass through the same domain/secure/
// path attributes so the browser actually overwrites the cookie. Without
// matching attributes the browser leaves the old cookie in place AND
// adds a new empty one (cookies are keyed by name+domain+path).
// ---------------------------------------------------------------------------

function clearOpts(httpOnly: boolean) {
  return {
    httpOnly,
    path: '/',
    secure: isSecure(),
    domain: cookieDomain(),
    sameSite: 'Lax' as const,
  };
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, clearOpts(true));
}

export function clearRefreshCookie(c: Context): void {
  deleteCookie(c, REFRESH_COOKIE_NAME, clearOpts(true));
}

export function clearCsrfCookie(c: Context): void {
  deleteCookie(c, CSRF_COOKIE_NAME, clearOpts(false));
}

// ---------------------------------------------------------------------------
// Getters
// ---------------------------------------------------------------------------

export function readSessionCookie(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME);
}

export function readRefreshCookie(c: Context): string | undefined {
  return getCookie(c, REFRESH_COOKIE_NAME);
}

export function readCsrfCookie(c: Context): string | undefined {
  return getCookie(c, CSRF_COOKIE_NAME);
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

export function clearAllAuthCookies(c: Context): void {
  clearSessionCookie(c);
  clearRefreshCookie(c);
  clearCsrfCookie(c);
}

/** TTL constants exported so tests can assert exact expiries. */
export const COOKIE_TTLS = {
  access: ACCESS_TTL_SECONDS,
  refresh: REFRESH_TTL_SECONDS,
  csrf: CSRF_TTL_SECONDS,
} as const;
