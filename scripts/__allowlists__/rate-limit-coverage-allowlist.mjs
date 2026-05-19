/**
 * Rate-limit coverage allow-list.
 *
 * Mutating route files that legitimately skip an in-handler rate limit.
 * Each entry MUST justify why.
 *
 * Legitimate categories:
 *   1. The route is wrapped at the edge by gateway middleware that
 *      applies a default limiter (documented in middleware.ts).
 *   2. The route is for a single internal cron / scheduled job — rate
 *      is bounded by the cron schedule itself, not per-request.
 *
 * Keys are paths RELATIVE to the repo root.
 *
 * ── am2 drawdown (2026-05-19) ──
 * All 109 tracked-gap routes that previously lived in this Map now
 * declare a `withRateLimit(...)` posture (Hono routers via
 * `services/api-gateway/src/middleware/rate-limit.ts`; Next.js App
 * Router via per-app `src/lib/with-rate-limit.ts`). The Map is
 * intentionally empty — only architectural-by-design exemptions
 * should be re-added here, with the matching category citation.
 */

export const RATE_LIMIT_ALLOWLIST = new Map([]);
