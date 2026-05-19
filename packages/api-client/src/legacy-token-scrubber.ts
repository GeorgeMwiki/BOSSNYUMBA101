/**
 * Legacy-token scrubber (AM-1).
 *
 * Called once at app boot from each portal's AuthProvider. Detects any
 * residual auth bearer in localStorage/sessionStorage from the pre-AM-1
 * world (`token` / `auth_token` / `customer_token` / `manager_token` /
 * `platform_token` / `customer_user` / `manager_user` / `manager_tenant`)
 * and:
 *
 *   1. POSTs each bearer found to /api/v1/auth/logout-legacy-token so
 *      the gateway can add its jti to the access-token blocklist.
 *      Server-side revocation matters because the bearer's signature is
 *      still valid for its original 1-hour TTL — without blocklisting
 *      an attacker who lifted it via XSS *before* this scrubber runs
 *      could still use it for the next hour.
 *
 *   2. Deletes the keys from localStorage/sessionStorage so subsequent
 *      `localStorage.getItem('auth_token')` calls (in pages we haven't
 *      yet migrated) get null and trigger a clean re-login flow.
 *
 *   3. Emits a console.info (one-shot) so dev/QA see the migration ran.
 *
 * Idempotent: calling repeatedly with no legacy keys is a no-op.
 * SSR-safe: `typeof window === 'undefined'` guard.
 */

const LEGACY_TOKEN_KEYS = [
  'token',
  'auth_token',
  'customer_token',
  'manager_token',
  'platform_token',
  // The Supabase SDK historically wrote here in the admin-platform-portal.
  // We don't unset Supabase's keys — those are managed by its own client —
  // but listing them keeps the audit visible.
  // 'sb-access-token', 'sb-refresh-token',
] as const;

const LEGACY_USER_KEYS = [
  'customer_user',
  'manager_user',
  'manager_tenant',
  'lastActivity',
  'sessionTimeout',
] as const;

interface ScrubResult {
  /** Number of legacy tokens posted to the server for blocklisting. */
  readonly tokensScrubbed: number;
  /** Number of localStorage/sessionStorage keys cleared. */
  readonly keysCleared: number;
}

/**
 * Run the scrubber. Returns a result for tests/logging; production
 * callers can ignore the return value.
 */
export async function scrubLegacyTokens(opts: {
  /** Base URL of the api-gateway, e.g. `/api/v1` or `https://api.example.com/api/v1`. */
  readonly apiBaseUrl: string;
}): Promise<ScrubResult> {
  if (typeof window === 'undefined') {
    return { tokensScrubbed: 0, keysCleared: 0 };
  }

  const storages = [window.localStorage, window.sessionStorage];
  const foundTokens: string[] = [];
  let keysCleared = 0;

  for (const storage of storages) {
    for (const key of LEGACY_TOKEN_KEYS) {
      try {
        const value = storage.getItem(key);
        if (value && value.length > 20) {
          // Heuristic: any value over 20 chars in a token-shaped slot is
          // worth scrubbing. We don't try to validate the JWT shape —
          // the server endpoint accepts (and silently ignores) garbage.
          foundTokens.push(value);
        }
        if (value !== null) {
          storage.removeItem(key);
          keysCleared++;
        }
      } catch {
        // localStorage can throw in Safari private mode / cookie-blocked iframes
      }
    }
    for (const key of LEGACY_USER_KEYS) {
      try {
        if (storage.getItem(key) !== null) {
          storage.removeItem(key);
          keysCleared++;
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (foundTokens.length === 0) {
    return { tokensScrubbed: 0, keysCleared };
  }

  // Post each token to the server for blocklisting. We do this in
  // parallel — the endpoint is idempotent — but we don't await the
  // results past a short timeout so the scrubber never blocks app boot.
  const base = opts.apiBaseUrl.replace(/\/$/, '');
  const url = `${base}/auth/logout-legacy-token`;
  const requests = foundTokens.map((token) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    })
      .catch(() => undefined)
      .finally(() => clearTimeout(timeout));
  });

  await Promise.allSettled(requests);

  // eslint-disable-next-line no-console
  console.info(
    `[am1-scrubber] scrubbed ${foundTokens.length} legacy auth bearer(s) and ${keysCleared} legacy storage key(s) from this device`
  );

  return { tokensScrubbed: foundTokens.length, keysCleared };
}

/**
 * Pure helper exported for tests — checks whether localStorage/sessionStorage
 * contain any legacy auth-bearer keys at all. Does not mutate.
 */
export function hasLegacyTokens(): boolean {
  if (typeof window === 'undefined') return false;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of LEGACY_TOKEN_KEYS) {
      try {
        if (storage.getItem(key) !== null) return true;
      } catch {
        /* ignore */
      }
    }
  }
  return false;
}

/** Test helper — exposed for the regression suite. */
export const __testing = {
  LEGACY_TOKEN_KEYS,
  LEGACY_USER_KEYS,
};
