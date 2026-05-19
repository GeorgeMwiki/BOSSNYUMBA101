/**
 * `withRateLimit` — per-route, per-tenant, per-method Hono middleware.
 *
 * Designed as a tiny Higher-Order Function so route files can declare
 * their rate-limit posture with a single line at top-of-file:
 *
 *   router.use('*', withRateLimit({ key: 'customers', max: 120, window: '1m' }));
 *
 * Semantics:
 *
 *   - The limiter keys on `${tenantId}:${key}:${method}` so that a
 *     burst on POST /customers does not consume the quota for PATCH
 *     /customers or for the same path under another tenant.
 *   - When `tenantId` is absent (public route, pre-auth), the limiter
 *     keys on the client IP instead, so anonymous traffic is still
 *     bounded.
 *   - The store is in-memory and process-local. A Redis-backed
 *     `BudgetStore` port can replace it later — same shape as
 *     `per-tenant-rate-budget.ts` (TODO RATE-BUDGET-001).
 *   - On overflow returns `429` with `Retry-After` and a structured
 *     error envelope matching the rest of the gateway's `success: false`
 *     pattern.
 *
 * Why a new file (and not extending `rate-limit.middleware.ts`):
 * the existing file is Express-flavoured (req/res/next) and serves
 * the legacy Express mount; this file is Hono-native and is the
 * canonical wrapper for the Hono sub-routers under
 * `services/api-gateway/src/routes/**`.
 */

import type { MiddlewareHandler } from 'hono';

const DEFAULT_MAX = 120;
const DEFAULT_WINDOW_MS = 60_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const STORE = new Map<string, Bucket>();

// Best-effort GC. unref() so the timer never blocks process exit.
const GC_INTERVAL_MS = 60_000;
const gc = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of STORE) {
    if (now >= bucket.resetAt) STORE.delete(key);
  }
}, GC_INTERVAL_MS);
gc.unref?.();

export interface WithRateLimitOptions {
  /** Route-key portion of the bucket key. Required; should be stable per router. */
  readonly key: string;
  /** Max requests per window. Default 120. */
  readonly max?: number;
  /**
   * Window length. Accepts a number-of-ms OR a short tag:
   * `'1s'`, `'10s'`, `'30s'`, `'1m'`, `'5m'`, `'15m'`, `'1h'`.
   * Default `'1m'`.
   */
  readonly window?: number | string;
  /** Test seam — defaults to `Date.now`. */
  readonly clock?: () => number;
  /** Test seam — alternative bucket store (used by unit tests). */
  readonly store?: Map<string, Bucket>;
}

function parseWindowMs(input: number | string | undefined): number {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
    return input;
  }
  if (typeof input !== 'string') return DEFAULT_WINDOW_MS;
  const m = /^(\d+)\s*(ms|s|m|h)$/.exec(input.trim());
  if (!m) return DEFAULT_WINDOW_MS;
  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_WINDOW_MS;
  switch (m[2]) {
    case 'ms':
      return n;
    case 's':
      return n * 1000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    default:
      return DEFAULT_WINDOW_MS;
  }
}

function readTenantId(c: {
  get(k: string): unknown;
  req: { header(name: string): string | undefined };
}): string | null {
  const auth = c.get('auth') as { tenantId?: string | null } | undefined;
  if (auth?.tenantId) return String(auth.tenantId);
  const headerTenant = c.req.header('x-tenant-id');
  if (headerTenant) return headerTenant;
  return null;
}

function readClientIp(c: {
  req: { header(name: string): string | undefined };
}): string {
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return c.req.header('x-real-ip') ?? 'unknown';
}

/**
 * Build a per-tenant, per-route, per-method rate-limit middleware.
 *
 * Apply at the top of a sub-router:
 *   ```ts
 *   import { withRateLimit } from '../middleware/rate-limit.js';
 *   router.use('*', withRateLimit({ key: 'customers', max: 120, window: '1m' }));
 *   ```
 */
export function withRateLimit(
  options: WithRateLimitOptions,
): MiddlewareHandler {
  const key = options.key;
  if (!key || typeof key !== 'string') {
    throw new Error('withRateLimit: `key` is required and must be a string.');
  }
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = parseWindowMs(options.window);
  const clock = options.clock ?? Date.now;
  const store = options.store ?? STORE;

  return async (c, next) => {
    const now = clock();
    const tenantId = readTenantId(c as Parameters<typeof readTenantId>[0]);
    const principal =
      tenantId ?? `ip:${readClientIp(c as Parameters<typeof readClientIp>[0])}`;
    const method = c.req.method.toUpperCase();
    const bucketKey = `${principal}:${key}:${method}`;

    let bucket = store.get(bucketKey);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      store.set(bucketKey, bucket);
    }
    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      c.header('Retry-After', String(retryAfterSec));
      return c.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded for ${key}.${method}. Try again in ${retryAfterSec}s.`,
            retryAfter: retryAfterSec,
          },
        },
        429,
      );
    }

    await next();
  };
}

/** Test seam — clear the global bucket store. */
export function __resetRateLimitStoreForTests(): void {
  STORE.clear();
}
