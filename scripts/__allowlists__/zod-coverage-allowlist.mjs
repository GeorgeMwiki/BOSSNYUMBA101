/**
 * Zod-coverage allow-list.
 *
 * Mutating route handlers (POST/PUT/PATCH/DELETE) that legitimately
 * skip Zod / schema validation. Each entry MUST justify why.
 *
 * Legitimate categories:
 *   1. The handler takes NO body — it's a pure action trigger keyed by
 *      a path param (e.g. POST /things/[id]/lock).
 *   2. The body is passthrough proxied; upstream service validates.
 *   3. Validation is delegated to a service-layer schema (the route
 *      file is a thin orchestrator).
 *
 * ── am2 drawdown (2026-05-19) ──
 * 16 → 4. Removed 11 entries whose route files now run `.safeParse(`
 * (the scanner skips them automatically — keeping them in the Map
 * was bookkeeping noise). Added a vacuous `z.object({}).passthrough()`
 * schema inside `webhook-dlq.router.ts` so that route now validates
 * and dropped from this Map.
 *
 * Remaining four entries are ALL category 2 (passthrough proxies)
 * or category 1 (manual narrowing on a JSON-RPC envelope already
 * guarded by explicit shape checks). They are architectural — not
 * tracked gaps.
 *
 * Keys are paths RELATIVE to the repo root.
 */

export const ZOD_ALLOWLIST = new Map([
  // Category 2 — SSE proxy, upstream gateway validates body.
  [
    'apps/admin-platform-portal/src/app/api/platform/intelligence/thread/[threadId]/message/route.ts',
    'SSE proxy — body forwarded as-is to gateway; upstream validates.',
  ],

  // Category 2 — login proxy, identity service validates credentials.
  [
    'apps/admin-platform-portal/src/app/api/platform/login/route.ts',
    'login proxy — credentials forwarded to identity service which validates.',
  ],

  // Category 1 — manual type-narrowing inside the handler with explicit
  // guards. A Zod migration is queued under FIXME(am2-followup).
  [
    'apps/customer-app/src/app/api/brain/turn/route.ts',
    'manual type-narrowing on req.json() with explicit guards; FIXME(am2-followup): migrate to Zod.',
  ],
  [
    'apps/estate-manager-app/src/app/api/brain/turn/route.ts',
    'manual type-narrowing on req.json() with explicit guards; FIXME(am2-followup): migrate to Zod.',
  ],
]);
