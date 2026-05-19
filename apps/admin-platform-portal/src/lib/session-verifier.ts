/**
 * Edge-runtime session verifier for the admin-platform middleware.
 *
 * Closes round-3 frontend audit finding **M-4**: previously the middleware
 * admitted any non-empty cookie value (`session.length > 0`). An attacker
 * who knew the cookie NAME could `document.cookie = "bossnyumba_platform_session=x"`
 * and reach the inside of the app shell. Downstream the identity service
 * still re-checked the token on every API call, so the exposure was
 * bounded to "leak page chrome / route layouts / analytics events firing
 * before upstream validation". This module closes that gap.
 *
 * Design:
 *   - Calls `GET {IDENTITY_URL}/sessions/verify` forwarding the cookie.
 *   - Caches the boolean verdict in an in-memory `Map` with a short TTL
 *     so we don't make an identity-service round trip on every navigation.
 *   - On any non-2xx response or fetch error, returns `false`. Better to
 *     bounce a staff user to /login than to fail open.
 *   - Returns `null` (rather than throwing) when `IDENTITY_URL` is unset
 *     in development so local navigation isn't blocked. In production the
 *     env var is required by the `getIdentityBase` helper used elsewhere.
 *
 * Notes:
 *   - The cache key is the cookie value itself (treated as opaque). When
 *     a session is revoked server-side, the cached `true` could survive
 *     for up to `TTL_MS`. `TTL_MS` is set to 30 s to keep that window
 *     small.
 *   - We deliberately do NOT decode or trust any field from the response
 *     body. Only the HTTP status determines admission.
 */

const TTL_MS = 30_000;

type CacheEntry = { readonly valid: boolean; readonly expiresAt: number };
const verdictCache = new Map<string, CacheEntry>();

function resolveIdentityBase(): string | null {
  const raw = process.env.IDENTITY_URL?.trim();
  if (raw && raw.length > 0) return raw.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    // We refuse to fail OPEN in production. Returning null here would
    // admit traffic; instead force the verifier to deny.
    return null;
  }
  // Dev fallback. Mirrors `getIdentityBase()` in lib/proxy.ts.
  return 'http://localhost:4001';
}

export async function verifyPlatformSession(
  cookieValue: string,
  cookieName: string,
): Promise<boolean> {
  if (!cookieValue || cookieValue.length === 0) return false;

  const now = Date.now();
  const cached = verdictCache.get(cookieValue);
  if (cached && cached.expiresAt > now) {
    return cached.valid;
  }

  const base = resolveIdentityBase();
  if (base === null) {
    // Production misconfig (no IDENTITY_URL). Fail closed.
    verdictCache.set(cookieValue, { valid: false, expiresAt: now + TTL_MS });
    return false;
  }

  let valid = false;
  try {
    const res = await fetch(`${base}/sessions/verify`, {
      method: 'GET',
      headers: {
        Cookie: `${cookieName}=${cookieValue}`,
        Accept: 'application/json',
      },
      // Edge runtime: explicitly opt out of cache so we re-verify when
      // the TTL on our Map expires.
      cache: 'no-store',
      // 2-second budget. The middleware runs on every navigation so we
      // cannot afford long blocking.
      signal: AbortSignal.timeout(2000),
    });
    valid = res.ok;
  } catch {
    // Network error / timeout / DNS — fail closed.
    valid = false;
  }

  // Bounded cache: drop random entries when we exceed a soft ceiling to
  // keep the Map from growing unbounded in long-lived edge processes.
  if (verdictCache.size > 1024) {
    const firstKey = verdictCache.keys().next().value;
    if (firstKey !== undefined) verdictCache.delete(firstKey);
  }
  verdictCache.set(cookieValue, { valid, expiresAt: now + TTL_MS });
  return valid;
}

/**
 * Test-only export: clear the verdict cache between runs.
 */
export function __resetSessionVerifierCacheForTests(): void {
  verdictCache.clear();
}
