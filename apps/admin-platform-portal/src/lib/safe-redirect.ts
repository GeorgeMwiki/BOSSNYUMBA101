/**
 * Safe-redirect validator.
 *
 * Closes round-3 finding C-2 (CRITICAL): `?next=` was forwarded
 * verbatim to `window.location.href` so an attacker could craft
 * `/login?next=https://evil-bossnyumba.com/phish` and harvest staff
 * sessions post-authentication.
 *
 * Allow-list rules (must ALL pass):
 *   1. Path MUST start with `/`
 *   2. Path MUST NOT start with `//` (protocol-relative URL)
 *   3. Path MUST NOT start with `/\` (back-slash bypass)
 *   4. Path MUST NOT contain a scheme (`http:`, `https:`, `data:`, `javascript:`, etc.)
 *   5. Path MUST NOT contain a CR/LF (header-injection)
 *
 * Any input that fails the allow-list falls back to the supplied
 * default (`/` for HQ login).
 *
 * The function is intentionally string-based (no `new URL()`) so it
 * works identically on the server (middleware) and client
 * (LoginForm). Browsers normalise `\` to `/` in URL parsing, which
 * is why we explicitly reject the back-slash form.
 */

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Validate a candidate redirect target.
 *
 * @param next - raw value from `?next=` (already URL-decoded by URLSearchParams)
 * @param fallback - the safe default to use when `next` fails validation
 * @returns either `next` (if safe) or `fallback`
 */
export function safeRedirectTarget(
  next: string | null | undefined,
  fallback: string = '/',
): string {
  if (typeof next !== 'string' || next.length === 0) {
    return fallback;
  }

  // CR/LF is never legitimate in a same-origin path.
  if (next.includes('\r') || next.includes('\n')) {
    return fallback;
  }

  // Reject schemes (http:, https:, data:, javascript:, file:, etc.).
  if (SCHEME_RE.test(next)) {
    return fallback;
  }

  // Must start with `/` (same-origin absolute path).
  if (next.charAt(0) !== '/') {
    return fallback;
  }

  // Reject protocol-relative URLs (`//evil.com/path`).
  if (next.charAt(1) === '/') {
    return fallback;
  }

  // Reject back-slash bypass (`/\evil.com/path`) — some legacy browsers
  // normalise this to a protocol-relative URL.
  if (next.charAt(1) === '\\') {
    return fallback;
  }

  return next;
}

/**
 * Predicate form for tests / call-sites that only need a yes/no answer.
 */
export function isSafeRedirectTarget(next: string | null | undefined): boolean {
  if (typeof next !== 'string' || next.length === 0) return false;
  return safeRedirectTarget(next, '__INVALID__') !== '__INVALID__';
}
