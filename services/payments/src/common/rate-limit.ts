/**
 * Lightweight in-process per-tenant rate limiter.
 *
 * Week-0 goal: protect the STK-push endpoint from accidental or malicious
 * bursts on a single instance with zero external dependencies. The algorithm
 * is a fixed-window counter per key -- small, fast, and adequate for the
 * default policy of 10 requests / 60s.
 *
 * For multi-instance production deployments a shared store (Redis with
 * INCR + EXPIRE or `rate-limiter-flexible`) is REQUIRED so that a burst
 * hitting two pods is still counted against the same bucket. The interface
 * is intentionally narrow so a Redis adapter can drop in without touching
 * call sites.
 *
 * Tunables are read fresh from env on each limiter construction so that
 * configuration changes (secret rotation adjacent) can roll out without a
 * redeploy when callers build the limiter per-request. When used as a
 * module-level singleton, restart picks up new env values.
 */

export interface RateLimiter {
  /**
   * Attempt to consume one token for `key`. Returns an object describing
   * whether the request is allowed and, if not, when the bucket resets.
   */
  check(key: string): RateLimitResult;
  /** Drop all buckets (tests). */
  reset(): void;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Number of hits observed in the current window, including this one. */
  count: number;
  /** Maximum hits allowed in the window. */
  limit: number;
  /** Unix-ms timestamp at which the current window expires. */
  resetAt: number;
  /** Milliseconds until the current window expires. */
  retryAfterMs: number;
}

export interface FixedWindowOptions {
  /** Requests per window. Default: 10. */
  limit?: number;
  /** Window size in milliseconds. Default: 60_000. */
  windowMs?: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Read limiter defaults from environment. Exported so callers and tests can
 * introspect the policy that will be applied.
 */
export function readRateLimitEnv(): Required<FixedWindowOptions> {
  const limit = Number.parseInt(
    process.env.MPESA_STK_RATE_LIMIT ?? '10',
    10
  );
  const windowMs = Number.parseInt(
    process.env.MPESA_STK_RATE_WINDOW_MS ?? '60000',
    10
  );
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000,
  };
}

export class FixedWindowRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(opts: FixedWindowOptions = {}) {
    const env = readRateLimitEnv();
    this.limit = opts.limit ?? env.limit;
    this.windowMs = opts.windowMs ?? env.windowMs;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        count: 1,
        limit: this.limit,
        resetAt,
        retryAfterMs: this.windowMs,
      };
    }

    existing.count += 1;
    const allowed = existing.count <= this.limit;
    return {
      allowed,
      count: existing.count,
      limit: this.limit,
      resetAt: existing.resetAt,
      retryAfterMs: existing.resetAt - now,
    };
  }

  reset(): void {
    this.buckets.clear();
  }
}

/**
 * Module-level singleton used by the STK-push flow. Tests that want a clean
 * state should call `defaultStkRateLimiter.reset()` in `beforeEach`.
 */
export const defaultStkRateLimiter = new FixedWindowRateLimiter();
