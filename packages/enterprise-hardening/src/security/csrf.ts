/**
 * CSRF protection (double-submit cookie pattern).
 *
 * Issues a cryptographically-random token bound to a session-scoped secret.
 * The client echoes the token in a header; the server recomputes the HMAC
 * and compares in constant time.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface CsrfConfig {
  /** Server secret used to HMAC the token. */
  readonly secret: string;
  /** Cookie name. Default: bossnyumba_csrf. */
  readonly cookieName?: string;
  /** Header name. Default: x-csrf-token. */
  readonly headerName?: string;
  /** Token byte length. Default: 32. */
  readonly tokenBytes?: number;
}

export interface CsrfTokenPair {
  readonly cookieValue: string;
  readonly headerValue: string;
}

/**
 * Methods that mutate state and therefore require CSRF protection.
 */
export const CSRF_PROTECTED_METHODS = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

/**
 * Issue a fresh CSRF token pair for a session. Send `cookieValue` as a
 * SameSite=strict, HttpOnly=false cookie and return `headerValue` to the
 * client (or set both to the same value if using the double-submit variant).
 */
export function issueCsrfToken(
  sessionId: string,
  config: CsrfConfig
): CsrfTokenPair {
  const random = randomBytes(config.tokenBytes ?? 32).toString('hex');
  const mac = createHmac('sha256', config.secret)
    .update(`${sessionId}.${random}`)
    .digest('hex');
  const token = `${random}.${mac}`;
  return { cookieValue: token, headerValue: token };
}

/**
 * Verify a CSRF token for an incoming request.
 */
export function verifyCsrfToken(
  method: string,
  sessionId: string,
  cookieValue: string | undefined,
  headerValue: string | undefined,
  config: CsrfConfig
): boolean {
  if (!CSRF_PROTECTED_METHODS.has(method.toUpperCase())) {
    return true;
  }
  if (!cookieValue || !headerValue) return false;
  if (cookieValue !== headerValue) return false;

  const parts = cookieValue.split('.');
  if (parts.length !== 2) return false;
  const [random, providedMac] = parts;
  if (!random || !providedMac) return false;
  const expectedMac = createHmac('sha256', config.secret)
    .update(`${sessionId}.${random}`)
    .digest('hex');
  const providedBuf = Buffer.from(providedMac, 'hex');
  const expectedBuf = Buffer.from(expectedMac, 'hex');
  if (providedBuf.length !== expectedBuf.length) return false;
  try {
    return timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}
