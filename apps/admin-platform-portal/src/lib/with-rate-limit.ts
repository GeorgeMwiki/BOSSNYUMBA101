/**
 * `withRateLimit` — App-Router-flavoured per-route rate-limit HOF for
 * Next.js. Mirrors the Hono `withRateLimit` in
 * `services/api-gateway/src/middleware/rate-limit.ts` so the scanner
 * recognises both surfaces under the same pattern.
 *
 * Usage:
 *   import { withRateLimit } from '@/lib/with-rate-limit';
 *
 *   async function handler(req: NextRequest) { ... }
 *
 *   export const POST = withRateLimit(handler, {
 *     key: 'platform-login',
 *     max: 30,
 *     window: '1m',
 *   });
 *
 * Per-tenant key sourced from `req.headers.get('x-tenant-id')`. If
 * absent, falls back to the client IP read from
 * `x-forwarded-for` / `x-real-ip`. Storage is process-local and resets
 * each cold start — a Redis-backed store can replace it later.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const DEFAULT_MAX = 60;
const DEFAULT_WINDOW_MS = 60_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const STORE = new Map<string, Bucket>();

export interface WithRateLimitOptions {
  readonly key: string;
  readonly max?: number;
  readonly window?: number | string;
  readonly clock?: () => number;
}

function parseWindowMs(input: number | string | undefined): number {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) return input;
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

function readPrincipal(req: NextRequest): string {
  const t = req.headers.get('x-tenant-id');
  if (t) return `tenant:${t}`;
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return `ip:${fwd.split(',')[0].trim()}`;
  const real = req.headers.get('x-real-ip');
  if (real) return `ip:${real}`;
  return 'ip:unknown';
}

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<Response> | Response;

/**
 * Wrap a Next.js App-Router handler with a rate-limit check.
 */
export function withRateLimit<H extends RouteHandler>(
  handler: H,
  options: WithRateLimitOptions,
): H {
  if (!options.key) {
    throw new Error('withRateLimit: `key` is required.');
  }
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = parseWindowMs(options.window);
  const clock = options.clock ?? Date.now;

  return (async (req: NextRequest, ctx?: unknown) => {
    const now = clock();
    const principal = readPrincipal(req);
    const method = req.method.toUpperCase();
    const bucketKey = `${principal}:${options.key}:${method}`;
    let bucket = STORE.get(bucketKey);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      STORE.set(bucketKey, bucket);
    }
    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded for ${options.key}.${method}.`,
            retryAfter: retryAfterSec,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(max),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    const response = await handler(req, ctx);
    if (response instanceof NextResponse || response instanceof Response) {
      const remaining = Math.max(0, max - bucket.count);
      response.headers.set('X-RateLimit-Limit', String(max));
      response.headers.set('X-RateLimit-Remaining', String(remaining));
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    }
    return response;
  }) as H;
}

/** Test seam — clear the global bucket store. */
export function __resetRateLimitStoreForTests(): void {
  STORE.clear();
}
