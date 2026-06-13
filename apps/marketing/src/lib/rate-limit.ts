/**
 * Per-IP rate limiter for the public BossNyumba marketing API routes.
 *
 * The marketing surfaces are unauthenticated by design (no tenant JWT),
 * so the per-tenant token budget the api-gateway uses does not apply
 * here. These routes ARE genuine abuse vectors though:
 *   - `/api/chat`       — proxies an LLM turn (cost + prompt-injection).
 *   - `/api/pilot-apply`— a lead-capture form (spam / enumeration).
 *   - `/api/perf/web-vitals` — a telemetry sink (flood / cardinality).
 *
 * This is a flat per-IP fixed-window token bucket. In-memory only:
 *   - On the Node runtime it persists for the process lifetime.
 *   - On the Edge runtime it is best-effort per-isolate (the CDN/edge
 *     limiter is the durable bound there); it still throttles a single
 *     hot isolate.
 *
 * Multi-instance deploys should front this with the shared Redis limiter
 * — this module is the in-app first line, not the only one.
 */

interface BucketState {
  readonly count: number;
  readonly resetAt: number;
}

export interface RateLimitOptions {
  /** Bucket namespace so distinct routes do not share headroom. */
  readonly key: string;
  /** Max requests per window (default 30). */
  readonly max?: number;
  /** Window length in ms (default 60_000). */
  readonly windowMs?: number;
}

export interface RateLimitResult {
  readonly ok: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;
  readonly retryAfterSec: number;
}

const buckets = new Map<string, BucketState>();

const GC_INTERVAL_MS = 60_000;
// Periodic GC so the map cannot grow unbounded. `.unref()` keeps the
// timer from holding the event loop open. Guarded for the edge runtime
// where `setInterval` may be absent or unref-less.
if (typeof setInterval === 'function') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }, GC_INTERVAL_MS);
  if (timer && typeof (timer as { unref?: () => void }).unref === 'function') {
    (timer as { unref: () => void }).unref();
  }
}

/**
 * Resolve the caller IP from the standard forwarding headers. Falls
 * back to a constant bucket when no IP is present so a missing header
 * still throttles (fail-closed-ish) rather than bypassing the limit.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get('x-real-ip')?.trim() ??
    req.headers.get('cf-connecting-ip')?.trim() ??
    'unknown'
  );
}

/**
 * Consume one token from the `(key, ip)` bucket. Immutable bucket state:
 * each call replaces the stored record rather than mutating it.
 */
export function checkRateLimit(
  ip: string,
  options: RateLimitOptions,
): RateLimitResult {
  const max = options.max ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  const bucketKey = `${options.key}:${ip}`;

  const current = buckets.get(bucketKey);
  const base =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

  const next: BucketState = { count: base.count + 1, resetAt: base.resetAt };
  buckets.set(bucketKey, next);

  const retryAfterSec = Math.max(1, Math.ceil((next.resetAt - now) / 1000));
  return {
    ok: next.count <= max,
    limit: max,
    remaining: Math.max(0, max - next.count),
    resetAt: next.resetAt,
    retryAfterSec,
  };
}

/** Standard headers for a limit result; spread into a Response. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
  if (!result.ok) headers['Retry-After'] = String(result.retryAfterSec);
  return headers;
}

/** Test helper — clears the bucket map for isolation. */
export function _resetRateLimitForTests(): void {
  buckets.clear();
}
