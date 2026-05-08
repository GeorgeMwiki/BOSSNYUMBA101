/**
 * Per-tenant token-budget middleware (Hono).
 *
 * Each tenant has a configurable per-hour token budget. Every request
 * to a Jarvis kernel surface costs an estimated number of tokens; the
 * budget is consumed by accumulating those estimates inside a 60-min
 * sliding window. When the projected consumption would exceed the
 * window's cap, the request is rejected with HTTP 429 and a
 * `Retry-After` header pointing at the earliest moment the window
 * clears enough capacity for the request.
 *
 * Per-tenant isolation: each tenant has its own bucket; one tenant's
 * activity NEVER affects another's budget.
 *
 * Process-local: the in-memory map will not synchronise across
 * api-gateway replicas.
 *
 * TODO(api-gateway, RATE-BUDGET-001): swap the in-memory `buckets`
 *   map for a Redis-backed sliding-window store that mirrors the
 *   approach in `rate-limit-redis.middleware.ts` /
 *   `public-ai-rate-limit.ts`. Concrete next-step:
 *     1. Define a `BudgetStore` port (get/add/expire) and back it
 *        with `ioredis` in production, the in-memory shape in tests.
 *     2. Use a Redis sorted-set keyed `tenant:budget:{tenantId}` with
 *        score = sample timestamp; ZRANGEBYSCORE prunes the window.
 *     3. Apply ZADD + ZREMRANGEBYSCORE inside a Lua script for
 *        atomicity across replicas.
 *     4. Keep the in-memory store as the test seam.
 *
 * Cost-estimate strategy:
 *   - Use `Content-Length` as the upper bound on input characters.
 *   - Estimate tokens at ~4 chars/token (industry approximation).
 *   - When the header is missing, fall back to `defaultEstimateTokens`
 *     so the budget still ticks.
 */

import type { MiddlewareHandler } from 'hono';
import { recordTenantBudgetExceeded } from '../observability/metrics.js';

const CHARS_PER_TOKEN = 4;
const DEFAULT_HOURLY_BUDGET = 1_000_000;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_ESTIMATE_TOKENS = 256;

export interface PerTenantRateBudgetOptions {
  /** Tokens per tenant per window. Default: TENANT_HOURLY_TOKEN_BUDGET env or 1_000_000. */
  readonly hourlyTokenBudget?: number;
  /** Window length in ms. Default: 3_600_000 (1h). */
  readonly windowMs?: number;
  /** Per-request fallback when content-length is missing. */
  readonly defaultEstimateTokens?: number;
  /** Test seam — defaults to `Date.now`. */
  readonly clock?: () => number;
  /** Override the surface tag attached to OTel + 429 metadata. Default: 'jarvis'. */
  readonly surface?: string;
  /**
   * Override extractor for tenantId. Defaults to reading
   * `auth.tenantId` from the Hono context (matches the rest of the
   * gateway's auth middleware).
   */
  readonly tenantIdExtractor?: (c: BudgetCtx) => string | null;
}

interface BudgetCtx {
  req: {
    header(name: string): string | undefined;
  };
  get(key: 'auth' | string): unknown;
  set(key: string, value: unknown): void;
  header(name: string, value: string): void;
  json(body: unknown, status?: number): unknown;
}

interface BudgetEntry {
  /** Sorted list of {at, tokens} samples consumed in the window. */
  samples: Array<{ at: number; tokens: number }>;
  /** Running sum across samples — kept in lock-step. */
  total: number;
}

function defaultTenantIdExtractor(c: BudgetCtx): string | null {
  const auth = c.get('auth') as { tenantId?: string | null } | undefined;
  return auth?.tenantId ?? null;
}

function estimateTokensFromHeaders(
  c: BudgetCtx,
  fallback: number,
): number {
  const len = c.req.header('content-length');
  if (!len) return fallback;
  const n = Number.parseInt(len, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.ceil(n / CHARS_PER_TOKEN);
}

function readEnvBudget(): number {
  const raw = process.env.TENANT_HOURLY_TOKEN_BUDGET?.trim();
  if (!raw) return DEFAULT_HOURLY_BUDGET;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_HOURLY_BUDGET;
  return n;
}

export interface PerTenantRateBudgetMiddleware {
  readonly handler: MiddlewareHandler;
  /** Per-tenant bucket store — exposed for tests + admin diagnostics. */
  readonly buckets: Map<string, BudgetEntry>;
  readonly limits: {
    readonly hourlyTokenBudget: number;
    readonly windowMs: number;
  };
  /** Test seam: returns the projected remaining tokens for a tenant. */
  remaining(tenantId: string): number;
}

/**
 * Build a per-tenant rate-budget middleware. Apply only to Jarvis
 * kernel routes — the auth middleware must run first so `tenantId` is
 * present on the context.
 */
export function createPerTenantRateBudgetMiddleware(
  options: PerTenantRateBudgetOptions = {},
): PerTenantRateBudgetMiddleware {
  const hourlyTokenBudget = options.hourlyTokenBudget ?? readEnvBudget();
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const fallbackEstimate =
    options.defaultEstimateTokens ?? DEFAULT_ESTIMATE_TOKENS;
  const clock = options.clock ?? Date.now;
  const surface = options.surface ?? 'jarvis';
  const tenantIdExtractor =
    options.tenantIdExtractor ?? defaultTenantIdExtractor;

  const buckets = new Map<string, BudgetEntry>();

  function pruneExpired(entry: BudgetEntry, now: number): void {
    while (entry.samples.length > 0 && now - entry.samples[0].at >= windowMs) {
      entry.total -= entry.samples[0].tokens;
      entry.samples.shift();
    }
    if (entry.total < 0) entry.total = 0;
  }

  function projectRetryAfterSeconds(entry: BudgetEntry, now: number): number {
    if (entry.samples.length === 0) return 1;
    const oldest = entry.samples[0]!;
    const ms = Math.max(0, windowMs - (now - oldest.at));
    return Math.max(1, Math.ceil(ms / 1000));
  }

  const handler: MiddlewareHandler = async (c, next) => {
    const now = clock();
    const tenantId = tenantIdExtractor(c as unknown as BudgetCtx);
    if (!tenantId) {
      // Unauthenticated / platform-only paths slip through this gate —
      // the upstream auth middleware decides whether they're allowed
      // at all.
      await next();
      return;
    }

    let entry = buckets.get(tenantId);
    if (!entry) {
      entry = { samples: [], total: 0 };
      buckets.set(tenantId, entry);
    }
    pruneExpired(entry, now);

    const cost = estimateTokensFromHeaders(
      c as unknown as BudgetCtx,
      fallbackEstimate,
    );
    const projected = entry.total + cost;

    if (projected > hourlyTokenBudget) {
      const retryAfterSec = projectRetryAfterSeconds(entry, now);
      try {
        recordTenantBudgetExceeded({ surface });
      } catch {
        // metrics must never break a request
      }
      c.header('Retry-After', String(retryAfterSec));
      c.header('X-RateLimit-Limit', String(hourlyTokenBudget));
      c.header('X-RateLimit-Remaining', String(Math.max(0, hourlyTokenBudget - entry.total)));
      return c.json(
        {
          success: false,
          error: {
            code: 'TENANT_TOKEN_BUDGET_EXCEEDED',
            message: `Tenant has exceeded its hourly token budget (${hourlyTokenBudget}).`,
            retryAfter: retryAfterSec,
          },
        },
        429,
      );
    }

    entry.samples.push({ at: now, tokens: cost });
    entry.total += cost;

    c.header('X-RateLimit-Limit', String(hourlyTokenBudget));
    c.header(
      'X-RateLimit-Remaining',
      String(Math.max(0, hourlyTokenBudget - entry.total)),
    );

    await next();
  };

  return {
    handler,
    buckets,
    limits: { hourlyTokenBudget, windowMs },
    remaining(tenantId: string): number {
      const entry = buckets.get(tenantId);
      if (!entry) return hourlyTokenBudget;
      pruneExpired(entry, clock());
      return Math.max(0, hourlyTokenBudget - entry.total);
    },
  };
}

/** Default shared instance — process-wide budget map keyed by tenant. */
let sharedInstance: PerTenantRateBudgetMiddleware | null = null;
export function getSharedPerTenantRateBudget(): PerTenantRateBudgetMiddleware {
  if (!sharedInstance) sharedInstance = createPerTenantRateBudgetMiddleware();
  return sharedInstance;
}

/** Test seam — drop the cached shared instance. */
export function __resetSharedPerTenantRateBudgetForTests(): void {
  sharedInstance = null;
}
