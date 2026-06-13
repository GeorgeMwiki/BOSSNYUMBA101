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
 *   3. Validation is delegated to a service-layer Zod schema (the route
 *      file is a thin orchestrator that forwards the body to a typed
 *      endpoint which `.parse()`s it).
 *   4. Scanner false positive — the regex matched a non-HTTP token
 *      (e.g. `Map.delete(`) in a helper module with no routes.
 *
 * NOTE: the 2026-06 `.router.ts` → `.hono.ts`/`.ts` reclaim retired the
 * legacy router files; their stale entries were removed and re-pointed
 * at the live files.
 *
 * Keys are paths RELATIVE to the repo root.
 */

export const ZOD_ALLOWLIST = new Map([
  // ─── Streaming/SSE proxy passthroughs ──────────────────────────────
  [
    'apps/admin-platform-portal/src/app/api/platform/intelligence/thread/[threadId]/message/route.ts',
    'SSE proxy — body forwarded as-is to gateway; upstream validates.',
  ],
  [
    'apps/admin-platform-portal/src/app/api/platform/login/route.ts',
    'login proxy — credentials forwarded to identity service which validates.',
  ],

  // ─── api-gateway: tracked gaps awaiting a boundary Zod schema ───────
  [
    'services/api-gateway/src/routes/bff/estate-manager-app.ts',
    'PENDING: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/bff/owner-portal.ts',
    'PENDING: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/messaging.ts',
    'PENDING: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/scheduling.ts',
    'PENDING: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/tenants.hono.ts',
    'PENDING: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/users.hono.ts',
    'PENDING: add Zod schema; tracked gap from universal scanner pass.',
  ],

  // ─── api-gateway: param/query-only mutations (no body to validate) ──
  [
    'services/api-gateway/src/routes/dsar.hono.ts',
    'POST /:subjectId/rtbf takes NO JSON body — keyed by subjectId path param + dryRun query, RTBF-admin role-gated. The flagged `.delete(` is store.delete(key) on a Map, not an HTTP DELETE.',
  ],
  [
    'services/api-gateway/src/routes/risk-reports.hono.ts',
    'POST /:customerId/generate takes NO body — pure action trigger keyed by the customerId path param.',
  ],
  [
    'services/api-gateway/src/routes/stage/index.ts',
    'POST /nudges/:id/dismiss takes NO body — pure action trigger keyed by the nudge id path param.',
  ],
  [
    'services/api-gateway/src/routes/unit-subdivision.hono.ts',
    'POST / is a 501 NOT_IMPLEMENTED stub (write path pending sovereign four-eye sign-off) — reads no body.',
  ],
  [
    'services/api-gateway/src/routes/webhook-dlq.hono.ts',
    'POST /:id/replay takes NO body — replays a dead-letter keyed by the id path param.',
  ],

  // ─── api-gateway: validation delegated to typed service layer ───────
  [
    'services/api-gateway/src/routes/mcp.hono.ts',
    'JSON-RPC envelope validated in-handler (jsonrpc===2.0 + method:string, -32700/-32600 codes); per-tool args validated by each tool inputSchema. Zod at the route boundary would be unidiomatic for JSON-RPC.',
  ],
  [
    'services/api-gateway/src/routes/training.hono.ts',
    'Thin orchestrator — bodies forwarded to @bossnyumba/ai-copilot/training endpoints which Zod-`.parse()` them (GenerateSchema/PersistSchema/PatchSchema/AssignSchema); JsonBodyError surfaces as 400 via mapErr.',
  ],

  // ─── helper modules the scanner false-positives on ─────────────────
  [
    'services/api-gateway/src/routes/ask/ask-rate-limit.ts',
    'False positive — pure rate-limit helper module (no Hono router); the flagged `.delete(` is buckets.delete(k) on a Map.',
  ],
  [
    'services/api-gateway/src/routes/reports/reports-rate-limit.ts',
    'False positive — pure rate-limit helper module (no Hono router); the flagged `.delete(` is buckets.delete(k) on a Map.',
  ],
]);
